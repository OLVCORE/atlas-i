/**
 * MC8: Movimentação Operacional Real
 * 
 * Funções para dar baixa em compromissos e executar transferências
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/audit"

export type PostTransactionFromCommitmentParams = {
  commitment_id?: string
  installment_id?: string
  account_id: string
  amount?: number // Se não informado, usa o valor previsto
  effective_date: string // ISO date (YYYY-MM-DD)
  description?: string
}

export type PostAccountTransferParams = {
  from_account_id: string
  to_account_id: string
  amount: number
  effective_date: string // ISO date (YYYY-MM-DD)
  description?: string
}

/**
 * CP2: Dar baixa em compromisso/installment
 * 
 * Cria uma transaction no ledger vinculada à origem
 */
export async function postTransactionFromCommitment(
  params: PostTransactionFromCommitmentParams
): Promise<{ transaction_id: string }> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  if (!params.commitment_id && !params.installment_id) {
    throw new Error("É necessário informar commitment_id ou installment_id")
  }

  if (!params.account_id) {
    throw new Error("É necessário informar account_id")
  }

  // Validar que a conta pertence ao workspace
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, entity_id")
    .eq("id", params.account_id)
    .eq("workspace_id", workspace.id)
    .single()

  if (accountError || !account) {
    throw new Error("Conta não encontrada ou sem permissão")
  }

  let sourceType: 'commitment' | 'installment'
  let sourceId: string
  let entityId: string
  let amount: number
  let direction: 'in' | 'out'
  let description: string

  // Buscar dados do compromisso ou installment
  if (params.commitment_id) {
    const { data: commitment, error: commitmentError } = await supabase
      .from("financial_commitments")
      .select("id, entity_id, type, description, total_amount")
      .eq("id", params.commitment_id)
      .eq("workspace_id", workspace.id)
      .single()

    if (commitmentError || !commitment) {
      throw new Error("Compromisso não encontrado ou sem permissão")
    }

    // Verificar se já não foi dado baixa (via source_id)
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("source_type", "commitment")
      .eq("source_id", commitment.id)
      .limit(1)
      .single()

    if (existingTx) {
      throw new Error("Este compromisso já possui baixa registrada")
    }

    sourceType = 'commitment'
    sourceId = commitment.id
    entityId = commitment.entity_id
    amount = params.amount ?? Number(commitment.total_amount)
    direction = commitment.type === 'revenue' ? 'in' : 'out'
    description = params.description || commitment.description || `Baixa de compromisso ${commitment.id.slice(0, 8)}`
  } else if (params.installment_id) {
    // Buscar installment (card_installments)
    const { data: installment, error: installmentError } = await supabase
      .from("card_installments")
      .select("id, entity_id, amount, card_purchases!inner(description)")
      .eq("id", params.installment_id)
      .eq("workspace_id", workspace.id)
      .single()

    if (installmentError || !installment) {
      throw new Error("Parcela não encontrada ou sem permissão")
    }

    // Verificar se já não foi dado baixa
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("source_type", "installment")
      .eq("source_id", installment.id)
      .limit(1)
      .single()

    if (existingTx) {
      throw new Error("Esta parcela já possui baixa registrada")
    }

    sourceType = 'installment'
    sourceId = installment.id
    entityId = installment.entity_id
    amount = params.amount ?? Number(installment.amount)
    direction = 'out' // Installments são sempre despesas
    const purchaseDesc = Array.isArray(installment.card_purchases) && installment.card_purchases.length > 0
      ? installment.card_purchases[0].description
      : null
    description = params.description || purchaseDesc || `Baixa de parcela ${installment.id.slice(0, 8)}`
  } else {
    throw new Error("Erro interno: source não identificado")
  }

  // Validar que a conta pertence à mesma entidade
  if (account.entity_id !== entityId) {
    throw new Error("A conta deve pertencer à mesma entidade do compromisso/parcela")
  }

  // Criar transaction
  const transactionType = direction === 'in' ? 'income' : 'expense'
  const transactionAmount = direction === 'in' ? amount : -Math.abs(amount)

  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      workspace_id: workspace.id,
      entity_id: entityId,
      account_id: params.account_id,
      type: transactionType,
      amount: transactionAmount,
      currency: 'BRL',
      date: params.effective_date,
      effective_date: params.effective_date,
      description,
      source_type: sourceType,
      source_id: sourceId,
      direction,
    })
    .select()
    .single()

  if (txError) {
    throw new Error(`Erro ao criar transação: ${txError.message}`)
  }

  // Auditoria: registrar baixa
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    try {
      await logAudit(
        'create',
        'transaction',
        transaction.id,
        null,
        {
          source_type: sourceType,
          source_id: sourceId,
          entity_id: entityId,
          account_id: params.account_id,
          amount: amount,
          direction: direction,
          effective_date: params.effective_date,
          description: description,
        }
      )
    } catch (auditError) {
      // Log mas não falha a operação
      console.error("[settle] Erro ao gravar audit log:", auditError)
    }
  }

  // Revalidar paths relevantes
  revalidatePath("/app/ledger")
  revalidatePath("/app/commitments")
  revalidatePath("/app/installments")
  revalidatePath("/app/cashflow")
  revalidatePath("/app/dashboard")

  return { transaction_id: transaction.id }
}

/**
 * CP3: Transferência entre contas (mesmo entity)
 * 
 * Sempre cria 2 transactions (out da origem, in no destino)
 */
export async function postAccountTransfer(
  params: PostAccountTransferParams
): Promise<{ transaction_ids: [string, string] }> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  if (params.amount <= 0) {
    throw new Error("Valor da transferência deve ser maior que zero")
  }

  // Buscar contas e validar
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, entity_id, workspace_id")
    .in("id", [params.from_account_id, params.to_account_id])
    .eq("workspace_id", workspace.id)

  if (accountsError || !accounts || accounts.length !== 2) {
    throw new Error("Contas não encontradas ou sem permissão")
  }

  const fromAccount = accounts.find(a => a.id === params.from_account_id)
  const toAccount = accounts.find(a => a.id === params.to_account_id)

  if (!fromAccount || !toAccount) {
    throw new Error("Contas não encontradas")
  }

  // Permitir transferências inter-entity (removida validação que bloqueava)

  // Gerar transfer_group_id único
  const transferGroupId = crypto.randomUUID()

  const description = params.description || `Transferência entre contas`

  // Criar transaction de saída (from_account)
  const { data: txOut, error: txOutError } = await supabase
    .from("transactions")
    .insert({
      workspace_id: workspace.id,
      entity_id: fromAccount.entity_id,
      account_id: params.from_account_id,
      type: 'transfer',
      amount: -Math.abs(params.amount), // Negativo (saída)
      currency: 'BRL',
      date: params.effective_date,
      effective_date: params.effective_date,
      description: `${description} (saída)`,
      source_type: 'transfer',
      direction: 'out',
      transfer_group_id: transferGroupId,
    })
    .select()
    .single()

  if (txOutError) {
    throw new Error(`Erro ao criar transação de saída: ${txOutError.message}`)
  }

  // Criar transaction de entrada (to_account)
  const { data: txIn, error: txInError } = await supabase
    .from("transactions")
    .insert({
      workspace_id: workspace.id,
      entity_id: toAccount.entity_id,
      account_id: params.to_account_id,
      type: 'transfer',
      amount: Math.abs(params.amount), // Positivo (entrada)
      currency: 'BRL',
      date: params.effective_date,
      effective_date: params.effective_date,
      description: `${description} (entrada)`,
      source_type: 'transfer',
      direction: 'in',
      transfer_group_id: transferGroupId,
    })
    .select()
    .single()

  if (txInError) {
    // Se falhar, tentar reverter a primeira (rollback manual)
    await supabase
      .from("transactions")
      .delete()
      .eq("id", txOut.id)

    throw new Error(`Erro ao criar transação de entrada: ${txInError.message}`)
  }

  // Auditoria: registrar transferência (usar transfer_group_id como entity_id)
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    try {
      await logAudit(
        'create',
        'transaction',
        transferGroupId,
        null,
        {
          transfer_group_id: transferGroupId,
          from_account_id: params.from_account_id,
          to_account_id: params.to_account_id,
          from_entity_id: fromAccount.entity_id,
          to_entity_id: toAccount.entity_id,
          amount: params.amount,
          effective_date: params.effective_date,
          transaction_ids: [txOut.id, txIn.id],
          is_inter_entity: fromAccount.entity_id !== toAccount.entity_id,
        }
      )
    } catch (auditError) {
      // Log mas não falha a operação
      console.error("[transfer] Erro ao gravar audit log:", auditError)
    }
  }

  // Revalidar paths relevantes
  revalidatePath("/app/ledger")
  revalidatePath("/app/accounts")
  revalidatePath("/app/cashflow")
  revalidatePath("/app/dashboard")

  return { transaction_ids: [txOut.id, txIn.id] }
}

