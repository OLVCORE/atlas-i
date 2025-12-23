/**
 * MC10: Função compartilhada para sincronizar dados do Pluggy
 * 
 * Pode ser chamada tanto via endpoint HTTP quanto via server action
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { getConnectionById } from "@/lib/connectors/connections"
import { pluggyFetch } from "./http"
import { createSyncRun, finishSyncRunSuccess, finishSyncRunError } from "@/lib/connectors/sync"

type PluggyAccount = {
  id: string
  type: string
  subtype: string
  name: string
  balance: number
  currencyCode: string
  itemId: string
  bankData?: any
  creditData?: any
}

type PluggyTransaction = {
  id: string
  accountId: string
  amount: number
  date: string
  description: string
  category?: string
  type: string
  balance?: number
  direction?: 'in' | 'out'
}

type PluggyAccountsResponse = {
  results: PluggyAccount[]
  page: number
  total: number
  totalPages: number
}

type PluggyTransactionsResponse = {
  results: PluggyTransaction[]
  page: number
  total: number
  totalPages: number
}

export async function syncPluggyConnection(connectionId: string): Promise<{
  accountsUpserted: number
  transactionsUpserted: number
  accountsProcessed: number
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const workspace = await getActiveWorkspace()

  // Buscar conexão
  const { data: connectionData, error: connectionError } = await supabase
    .from("connections")
    .select("id, entity_id, external_connection_id, status, provider_id")
    .eq("workspace_id", workspace.id)
    .eq("id", connectionId)
    .single()

  if (connectionError || !connectionData) {
    throw new Error("Conexão não encontrada")
  }

  if (connectionData.status !== 'active') {
    throw new Error(`Conexão não está ativa (status: ${connectionData.status})`)
  }

  if (!connectionData.external_connection_id) {
    throw new Error("Conexão não possui external_connection_id (itemId do Pluggy)")
  }

  if (!connectionData.entity_id) {
    throw new Error("Conexão não possui entity_id")
  }

  // Buscar provider e validar que é Pluggy
  const { data: providerData, error: providerError } = await supabase
    .from("providers")
    .select(`
      id,
      provider_catalog:catalog_id (
        code
      )
    `)
    .eq("workspace_id", workspace.id)
    .eq("id", connectionData.provider_id)
    .single()

  if (providerError || !providerData) {
    throw new Error("Provider da conexão não encontrado")
  }

  const catalogCode = (providerData as any).provider_catalog?.code
  if (catalogCode !== 'pluggy') {
    throw new Error(`Conexão não é do Pluggy (provider: ${catalogCode || 'desconhecido'})`)
  }

  const itemId = connectionData.external_connection_id
  const entityId = connectionData.entity_id

  // Criar sync run
  const syncRun = await createSyncRun(connectionId)

  let accountsUpserted = 0
  let transactionsUpserted = 0
  let accountsProcessed = 0

  try {
    // 1. Buscar accounts do Pluggy usando o endpoint correto
    const accountsResponse = await pluggyFetch(`/items/${itemId}/accounts`, {
      method: 'GET',
    })

    const accountsData = (await accountsResponse.json()) as PluggyAccountsResponse
    const pluggyAccounts = accountsData.results || []

    console.log(`[pluggy:sync] Found ${pluggyAccounts.length} accounts for item ${itemId}`)

    // 2. Para cada account, fazer upsert na tabela accounts
    for (const pluggyAccount of pluggyAccounts) {
      const accountType = mapPluggyAccountType(pluggyAccount.type, pluggyAccount.subtype)

      // Verificar se account já existe (por external_id) - usando constraint UNIQUE
      const { data: existingAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("entity_id", entityId)
        .eq("external_id", pluggyAccount.id)
        .eq("source", "pluggy")
        .maybeSingle()

      const accountData = {
        workspace_id: workspace.id,
        entity_id: entityId,
        name: pluggyAccount.name || `Conta ${pluggyAccount.type}`,
        type: accountType,
        currency: pluggyAccount.currencyCode || 'BRL',
        opening_balance: pluggyAccount.balance || 0,
        opening_balance_date: new Date().toISOString().split('T')[0],
        source: 'pluggy',
        external_id: pluggyAccount.id,
      }

      let internalAccountId: string

      if (existingAccount) {
        // Update
        const { error: updateError } = await supabase
          .from("accounts")
          .update({
            name: accountData.name,
            type: accountData.type,
            currency: accountData.currency,
            opening_balance: accountData.opening_balance,
          })
          .eq("id", existingAccount.id)

        if (updateError) {
          throw new Error(`Erro ao atualizar account ${existingAccount.id}: ${updateError.message}`)
        }

        internalAccountId = existingAccount.id
        accountsUpserted++
      } else {
        // Insert com ON CONFLICT handling via constraint UNIQUE
        const { data: newAccount, error: insertError } = await supabase
          .from("accounts")
          .insert(accountData)
          .select("id")
          .maybeSingle()

        if (insertError) {
          // Se erro for de constraint unique violation, tentar buscar e atualizar
          if (insertError.code === '23505') {
            const { data: conflictAccount } = await supabase
              .from("accounts")
              .select("id")
              .eq("workspace_id", workspace.id)
              .eq("entity_id", entityId)
              .eq("external_id", pluggyAccount.id)
              .eq("source", "pluggy")
              .maybeSingle()

            if (conflictAccount) {
              const { error: updateError } = await supabase
                .from("accounts")
                .update({
                  name: accountData.name,
                  type: accountData.type,
                  currency: accountData.currency,
                  opening_balance: accountData.opening_balance,
                })
                .eq("id", conflictAccount.id)

              if (updateError) {
                throw new Error(`Erro ao atualizar account após conflito: ${updateError.message}`)
              }

              internalAccountId = conflictAccount.id
              accountsUpserted++
            } else {
              throw new Error(`Erro ao inserir account ${pluggyAccount.id}: conflito de constraint mas account não encontrado`)
            }
          } else {
            throw new Error(`Erro ao inserir account ${pluggyAccount.id}: ${insertError.message}`)
          }
        } else if (newAccount) {
          internalAccountId = newAccount.id
          accountsUpserted++
        } else {
          throw new Error(`Erro ao inserir account ${pluggyAccount.id}: nenhum registro retornado`)
        }
      }

      // 3. Buscar transactions para esta account (últimos 90 dias)
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 90)
      const fromDateStr = fromDate.toISOString().split('T')[0]
      const toDateStr = new Date().toISOString().split('T')[0]

      try {
        const transactionsResponse = await pluggyFetch(
          `/items/${itemId}/transactions?from=${fromDateStr}&to=${toDateStr}&accountId=${pluggyAccount.id}`,
          { method: 'GET' }
        )

        const transactionsData = (await transactionsResponse.json()) as PluggyTransactionsResponse
        const pluggyTransactions = transactionsData.results || []

        console.log(`[pluggy:sync] Found ${pluggyTransactions.length} transactions for account ${pluggyAccount.id}`)

        // 4. Para cada transaction, fazer upsert na tabela transactions
        for (const pluggyTx of pluggyTransactions) {
          const transactionType = mapPluggyTransactionType(pluggyTx.type, pluggyTx.direction)


          // Verificar se transaction já existe (por external_id) - usando constraint UNIQUE
          const { data: existingTx } = await supabase
            .from("transactions")
            .select("id")
            .eq("workspace_id", workspace.id)
            .eq("entity_id", entityId)
            .eq("external_id", pluggyTx.id)
            .eq("source", "pluggy")
            .maybeSingle()

          const amount = Math.abs(pluggyTx.amount)
          const transactionData = {
            workspace_id: workspace.id,
            entity_id: entityId,
            account_id: internalAccountId,
            type: transactionType,
            amount: amount,
            currency: pluggyAccount.currencyCode || 'BRL',
            date: pluggyTx.date,
            description: pluggyTx.description || 'Transação Pluggy',
            source: 'pluggy',
            external_id: pluggyTx.id,
          }

          if (existingTx) {
            // Update
            const { error: updateError } = await supabase
              .from("transactions")
              .update({
                type: transactionData.type,
                amount: transactionData.amount,
                date: transactionData.date,
                description: transactionData.description,
                account_id: transactionData.account_id,
              })
              .eq("id", existingTx.id)

            if (updateError) {
              console.error(`[pluggy:sync] Error updating transaction ${existingTx.id}:`, updateError)
            } else {
              transactionsUpserted++
            }
          } else {
            // Insert com ON CONFLICT handling via constraint UNIQUE
            const { error: insertError } = await supabase
              .from("transactions")
              .insert(transactionData)

            if (insertError) {
              // Se erro for de constraint unique violation, tentar update
              if (insertError.code === '23505') {
                const { data: conflictTx } = await supabase
                  .from("transactions")
                  .select("id")
                  .eq("workspace_id", workspace.id)
                  .eq("entity_id", entityId)
                  .eq("external_id", pluggyTx.id)
                  .eq("source", "pluggy")
                  .maybeSingle()

                if (conflictTx) {
                  const { error: updateError } = await supabase
                    .from("transactions")
                    .update({
                      type: transactionData.type,
                      amount: transactionData.amount,
                      date: transactionData.date,
                      description: transactionData.description,
                      account_id: transactionData.account_id,
                    })
                    .eq("id", conflictTx.id)

                  if (!updateError) {
                    transactionsUpserted++
                  }
                }
              } else {
                console.error(`[pluggy:sync] Error inserting transaction ${pluggyTx.id}:`, insertError)
              }
            } else {
              transactionsUpserted++
            }
          }
        }
      } catch (txError) {
        console.error(`[pluggy:sync] Error fetching transactions for account ${pluggyAccount.id}:`, txError)
        // Continuar com próxima account
      }

      accountsProcessed++
    }

    // Atualizar last_sync_at da conexão e limpar erro
    await supabase
      .from("connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)

    // Finalizar sync run com sucesso
    await finishSyncRunSuccess(syncRun.id, accountsUpserted, 0, transactionsUpserted)

    return {
      accountsUpserted,
      transactionsUpserted,
      accountsProcessed,
    }
  } catch (syncError) {
    const errorMessage = syncError instanceof Error ? syncError.message : "Erro desconhecido"
    console.error('[pluggy:sync] Sync error:', {
      message: errorMessage,
      connectionId,
      itemId,
      userId: user.id,
      workspaceId: workspace.id,
    })

    // Atualizar last_error da conexão
    await supabase
      .from("connections")
      .update({
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)

    await finishSyncRunError(syncRun.id, errorMessage)

    throw syncError
  }
}

function mapPluggyAccountType(pluggyType: string, subtype?: string): 'checking' | 'investment' | 'other' {
  const typeLower = pluggyType.toLowerCase()
  const subtypeLower = subtype?.toLowerCase() || ''

  if (typeLower.includes('investment') || subtypeLower.includes('investment')) {
    return 'investment'
  }

  if (typeLower.includes('checking') || typeLower.includes('current') || subtypeLower.includes('checking')) {
    return 'checking'
  }

  return 'other'
}

function mapPluggyTransactionType(pluggyType: string, direction?: 'in' | 'out'): 'income' | 'expense' | 'transfer' {
  const typeLower = pluggyType.toLowerCase()

  if (direction === 'in') {
    return 'income'
  }

  if (direction === 'out') {
    return 'expense'
  }

  if (typeLower.includes('transfer') || typeLower.includes('transferência')) {
    return 'transfer'
  }

  if (typeLower.includes('income') || typeLower.includes('receita') || typeLower.includes('credit')) {
    return 'income'
  }

  if (typeLower.includes('expense') || typeLower.includes('despesa') || typeLower.includes('debit')) {
    return 'expense'
  }

  return 'expense'
}

