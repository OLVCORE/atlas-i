/**
 * MC3: Funções para gerenciar parcelas e integrar com Ledger
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { createTransaction } from "@/lib/transactions"

export type CardInstallment = {
  id: string
  workspace_id: string
  entity_id: string
  card_id: string
  purchase_id: string
  installment_number: number
  competence_month: string
  amount: number
  status: 'scheduled' | 'posted' | 'canceled'
  posted_transaction_id: string | null
  created_at: string
}

export type CardPurchase = {
  id: string
  merchant: string | null
  description: string | null
}

/**
 * Calcula a data de vencimento (due date) para uma parcela baseada no mês de competência e due_day
 */
export function getDueDateForCompetenceMonth(competenceMonth: string, dueDay: number): Date {
  const monthDate = new Date(competenceMonth)
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  
  // Usar o due_day do mês (garantir que não exceda o último dia do mês)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  const day = Math.min(dueDay, lastDayOfMonth)
  
  return new Date(year, month, day)
}

/**
 * Lista parcelas por cartão e período
 */
export async function listInstallmentsByCardAndPeriod(
  cardId?: string,
  startMonth?: string,
  endMonth?: string,
  status?: 'scheduled' | 'posted' | 'canceled'
): Promise<CardInstallment[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  let query = supabase
    .from("card_installments")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("competence_month", { ascending: true })
    .order("installment_number", { ascending: true })

  if (cardId) {
    query = query.eq("card_id", cardId)
  }

  if (startMonth) {
    query = query.gte("competence_month", startMonth)
  }

  if (endMonth) {
    query = query.lte("competence_month", endMonth)
  }

  if (status) {
    query = query.eq("status", status)
  }

  const { data: installments, error } = await query

  if (error) {
    throw new Error(`Erro ao listar parcelas: ${error.message}`)
  }

  return installments || []
}

/**
 * Lista parcelas por entidade e período
 */
export async function listInstallmentsByEntityAndPeriod(
  entityId: string,
  startMonth?: string,
  endMonth?: string,
  status?: 'scheduled' | 'posted' | 'canceled'
): Promise<CardInstallment[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  let query = supabase
    .from("card_installments")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .order("competence_month", { ascending: true })
    .order("installment_number", { ascending: true })

  if (startMonth) {
    query = query.gte("competence_month", startMonth)
  }

  if (endMonth) {
    query = query.lte("competence_month", endMonth)
  }

  if (status) {
    query = query.eq("status", status)
  }

  const { data: installments, error } = await query

  if (error) {
    throw new Error(`Erro ao listar parcelas: ${error.message}`)
  }

  return installments || []
}

/**
 * Busca uma parcela por ID
 */
export async function getInstallmentById(installmentId: string): Promise<CardInstallment | null> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: installment, error } = await supabase
    .from("card_installments")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("id", installmentId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar parcela: ${error.message}`)
  }

  return installment
}

/**
 * Busca o cartão relacionado a uma parcela para obter o due_day
 */
async function getCardForInstallment(cardId: string) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: card, error } = await supabase
    .from("cards")
    .select("due_day")
    .eq("workspace_id", workspace.id)
    .eq("id", cardId)
    .single()

  if (error) {
    throw new Error(`Erro ao buscar cartão: ${error.message}`)
  }

  return card
}

/**
 * Busca dados da compra relacionada para obter merchant/description
 */
async function getPurchaseForInstallment(purchaseId: string): Promise<CardPurchase | null> {
  const supabase = await createClient()

  const { data: purchase, error } = await supabase
    .from("card_purchases")
    .select("id, merchant, description")
    .eq("id", purchaseId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar compra: ${error.message}`)
  }

  return purchase
}

/**
 * Posta uma parcela no Ledger (cria transaction e vincula)
 */
export async function postInstallmentToLedger(
  installmentId: string,
  accountId?: string,
  description?: string
): Promise<string> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  // Buscar parcela
  const installment = await getInstallmentById(installmentId)
  if (!installment) {
    throw new Error("Parcela não encontrada")
  }

  if (installment.status === 'posted') {
    throw new Error("Parcela já foi postada no ledger")
  }

  if (installment.status === 'canceled') {
    throw new Error("Não é possível postar uma parcela cancelada")
  }

  // Buscar cartão para obter due_day
  const card = await getCardForInstallment(installment.card_id)
  
  // Calcular data de vencimento
  const dueDate = getDueDateForCompetenceMonth(installment.competence_month, card.due_day)

  // Buscar compra para obter merchant/description padrão
  const purchase = await getPurchaseForInstallment(installment.purchase_id)
  
  // Definir descrição
  const finalDescription = description || 
    purchase?.description || 
    purchase?.merchant || 
    `Parcela ${installment.installment_number}`

  // Criar transaction (expense = valor negativo no padrão do MC2)
  const transaction = await createTransaction(
    installment.entity_id,
    'expense',
    Math.abs(installment.amount), // createTransaction já aplica o sinal negativo para expense
    dueDate.toISOString().split("T")[0],
    finalDescription,
    accountId || null
  )
  
  const transactionId = transaction.id

  // Atualizar parcela
  const { error: updateError } = await supabase
    .from("card_installments")
    .update({
      status: 'posted',
      posted_transaction_id: transactionId,
    })
    .eq("id", installmentId)

  if (updateError) {
    // Rollback: deletar transaction criada
    await supabase.from("transactions").delete().eq("id", transactionId)
    throw new Error(`Erro ao atualizar parcela: ${updateError.message}`)
  }

  // Auditoria
  await supabase.from("card_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "installment.posted",
    resource_type: "installment",
    resource_id: installmentId,
    metadata: { transaction_id: transactionId },
  })

  return transactionId
}

