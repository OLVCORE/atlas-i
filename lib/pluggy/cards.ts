/**
 * MC11: Processamento automático de cartões de crédito do Pluggy
 * 
 * Funções para:
 * - Criar cards internos a partir de contas do Pluggy
 * - Processar transações de cartão
 * - Criar card_purchases e card_installments automaticamente
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { createCard, getCardById } from "@/lib/cards/purchases"
import { createCardPurchaseAndSchedule } from "@/lib/cards/purchases"
import { parseInstallmentInfo, groupTransactionsByPurchase, extractMerchant } from "./parsing"
import { resolveStatementMonth } from "@/lib/cards/cycle"

type PluggyAccount = {
  id: string
  type: string
  subtype: string
  name: string
  balance: number
  currencyCode: string
  creditData?: {
    level?: string
    availableCredit?: number
    totalCredit?: number
    minimumPayment?: number
    dueDate?: string
    closingDate?: string
  }
}

type PluggyTransaction = {
  id: string
  accountId: string
  amount: number
  date: string
  description: string
  type: string
  direction?: 'in' | 'out'
}

/**
 * Detecta se uma conta do Pluggy é um cartão de crédito
 */
export function isCreditCardAccount(account: PluggyAccount): boolean {
  const typeLower = account.type.toLowerCase()
  const subtypeLower = account.subtype?.toLowerCase() || ''
  
  return (
    typeLower.includes('credit') ||
    typeLower.includes('cartão') ||
    typeLower.includes('card') ||
    subtypeLower.includes('credit') ||
    subtypeLower.includes('cartão') ||
    subtypeLower.includes('card') ||
    !!account.creditData
  )
}

/**
 * Cria ou retorna card interno a partir de conta do Pluggy
 */
export async function getOrCreateCardFromPluggyAccount(
  pluggyAccount: PluggyAccount,
  entityId: string,
  connectionId: string
): Promise<{ cardId: string; isNew: boolean }> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Verificar se já existe card mapeado para esta conta do Pluggy
  // Usar external_account_map para mapear
  const { data: existingMap } = await supabase
    .from("external_account_map")
    .select(`
      internal_card_id,
      external_accounts!inner (
        external_account_id
      )
    `)
    .eq("workspace_id", workspace.id)
    .eq("external_accounts.external_account_id", pluggyAccount.id)
    .maybeSingle()

  if (existingMap?.internal_card_id) {
    // Verificar se card ainda existe
    const card = await getCardById(existingMap.internal_card_id)
    if (card) {
      return { cardId: card.id, isNew: false }
    }
  }

  // Extrair informações do cartão do Pluggy
  const creditData = pluggyAccount.creditData || {}
  
  // Tentar extrair closing_day e due_day da data de vencimento
  // Se não disponível, usar valores padrão
  let closingDay = 10 // Padrão
  let dueDay = 20 // Padrão

  if (creditData.closingDate) {
    const closingDate = new Date(creditData.closingDate)
    closingDay = closingDate.getDate()
  }

  if (creditData.dueDate) {
    const dueDate = new Date(creditData.dueDate)
    dueDay = dueDate.getDate()
  }

  // Extrair brand do nome (ex: "VISA", "MASTERCARD")
  const nameUpper = pluggyAccount.name.toUpperCase()
  let brand: string | undefined
  if (nameUpper.includes('VISA')) brand = 'Visa'
  else if (nameUpper.includes('MASTER')) brand = 'Mastercard'
  else if (nameUpper.includes('ELO')) brand = 'Elo'
  else if (nameUpper.includes('AMEX') || nameUpper.includes('AMERICAN')) brand = 'American Express'

  // Criar card interno
  const card = await createCard(
    entityId,
    pluggyAccount.name || `Cartão ${pluggyAccount.type}`,
    closingDay,
    dueDay,
    brand,
    true
  )

  // Criar mapeamento external_account → card
  // Primeiro, buscar ou criar external_account
  if (connectionId) {
    // Buscar ou criar external_account
    let { data: externalAccount } = await supabase
      .from("external_accounts")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("connection_id", connectionId)
      .eq("external_account_id", pluggyAccount.id)
      .maybeSingle()

    if (!externalAccount) {
      // Criar external_account
      const { data: newExternalAccount, error: createError } = await supabase
        .from("external_accounts")
        .insert({
          workspace_id: workspace.id,
          entity_id: entityId,
          connection_id: connectionId,
          external_account_id: pluggyAccount.id,
          display_name: pluggyAccount.name || `Cartão ${pluggyAccount.type}`,
          type: 'credit_card',
          currency: pluggyAccount.currencyCode || 'BRL',
          status: 'active',
          raw: pluggyAccount as any,
        })
        .select("id")
        .single()

      if (!createError && newExternalAccount) {
        externalAccount = newExternalAccount
      }
    }

    if (externalAccount) {
      // Criar mapeamento
      await supabase
        .from("external_account_map")
        .upsert({
          workspace_id: workspace.id,
          external_account_id: externalAccount.id,
          internal_card_id: card.id,
          mapping_status: 'mapped',
        }, {
          onConflict: 'external_account_id',
        })
    }
  }

  return { cardId: card.id, isNew: true }
}

/**
 * Processa transações de cartão do Pluggy e cria card_purchases e card_installments
 */
export async function processCardTransactions(
  cardId: string,
  entityId: string,
  transactions: PluggyTransaction[]
): Promise<{
  purchasesCreated: number
  installmentsCreated: number
}> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Filtrar apenas transações de saída (despesas)
  const expenseTransactions = transactions.filter(
    tx => tx.direction === 'out' || tx.amount < 0
  )

  if (expenseTransactions.length === 0) {
    return { purchasesCreated: 0, installmentsCreated: 0 }
  }

  // Agrupar transações por compra
  const groupedPurchases = groupTransactionsByPurchase(
    expenseTransactions.map(tx => ({
      id: tx.id,
      description: tx.description,
      amount: Math.abs(tx.amount),
      date: tx.date,
    }))
  )

  let purchasesCreated = 0
  let installmentsCreated = 0

  // Buscar card para obter closing_day
  const card = await getCardById(cardId)
  if (!card) {
    throw new Error(`Card ${cardId} não encontrado`)
  }

  // Processar cada grupo de compra
  for (const group of groupedPurchases) {
    if (group.transactions.length === 0) continue

    // Ordenar transações por data
    group.transactions.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const firstTransaction = group.transactions[0]
    const purchaseDate = new Date(firstTransaction.date)
    
    // Calcular mês de competência inicial
    const initialMonth = resolveStatementMonth(purchaseDate, card.closing_day)

    try {
      // Criar card_purchase e card_installments
      const { purchase, installments } = await createCardPurchaseAndSchedule(
        cardId,
        entityId,
        purchaseDate,
        group.totalAmount,
        group.installments,
        group.merchant || undefined,
        firstTransaction.description || undefined,
        initialMonth
      )

      purchasesCreated++
      installmentsCreated += installments.length

      // Vincular transações do Pluggy às parcelas criadas
      // Ordenar parcelas por installment_number
      const sortedInstallments = installments.sort((a, b) => 
        a.installment_number - b.installment_number
      )

      for (const tx of group.transactions) {
        const installmentInfo = parseInstallmentInfo(tx.description)
        if (installmentInfo.currentInstallment) {
          const installment = sortedInstallments.find(
            inst => inst.installment_number === installmentInfo.currentInstallment
          )

          if (installment) {
            // Buscar transaction interna correspondente
            const { data: internalTx } = await supabase
              .from("transactions")
              .select("id")
              .eq("workspace_id", workspace.id)
              .eq("entity_id", entityId)
              .eq("source", "pluggy")
              .eq("external_id", tx.id)
              .maybeSingle()

            if (internalTx) {
              // Vincular installment à transaction
              await supabase
                .from("card_installments")
                .update({
                  posted_transaction_id: internalTx.id,
                  status: 'posted',
                })
                .eq("id", installment.id)
            }
          }
        }
      }
    } catch (error) {
      console.error(`[pluggy:cards] Erro ao processar compra ${group.purchaseId}:`, error)
      // Continuar com próxima compra
    }
  }

  // Processar transações únicas (não parceladas)
  const processedTxIds = new Set(
    groupedPurchases.flatMap(g => g.transactions.map(t => t.id))
  )

  const singleTransactions = expenseTransactions.filter(
    tx => !processedTxIds.has(tx.id)
  )

  // Para transações únicas, criar compra à vista (1 parcela)
  for (const tx of singleTransactions) {
    const installmentInfo = parseInstallmentInfo(tx.description)
    
    // Se não é parcela, criar compra à vista
    if (!installmentInfo.isInstallment) {
      try {
        const purchaseDate = new Date(tx.date)
        const initialMonth = resolveStatementMonth(purchaseDate, card.closing_day)

        const { purchase, installments } = await createCardPurchaseAndSchedule(
          cardId,
          entityId,
          purchaseDate,
          Math.abs(tx.amount),
          1, // 1 parcela (à vista)
          extractMerchant(tx.description) || undefined,
          tx.description || undefined,
          initialMonth
        )

        purchasesCreated++
        installmentsCreated += installments.length

        // Vincular transaction do Pluggy à parcela
        if (installments.length > 0) {
          const { data: internalTx } = await supabase
            .from("transactions")
            .select("id")
            .eq("workspace_id", workspace.id)
            .eq("entity_id", entityId)
            .eq("source", "pluggy")
            .eq("external_id", tx.id)
            .maybeSingle()

          if (internalTx) {
            await supabase
              .from("card_installments")
              .update({
                posted_transaction_id: internalTx.id,
                status: 'posted',
              })
              .eq("id", installments[0].id)
          }
        }
      } catch (error) {
        console.error(`[pluggy:cards] Erro ao processar transação única ${tx.id}:`, error)
      }
    }
  }

  return { purchasesCreated, installmentsCreated }
}

// extractMerchant já está em parsing.ts, não precisa duplicar

