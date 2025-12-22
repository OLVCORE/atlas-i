/**
 * MC3.1: Lógica de Reconciliação (matching entre transações externas e internas)
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { listExternalTransactions } from "./external-transactions"
import { calculateSimilarity } from "./normalize"

export type ReconciliationLink = {
  id: string
  workspace_id: string
  external_transaction_id: string
  internal_transaction_id: string
  match_type: 'exact' | 'heuristic' | 'manual'
  confidence: number | null
  evidence: Record<string, any>
  created_at: string
}

type Transaction = {
  id: string
  entity_id: string
  date: string
  amount: number
  description: string
}

/**
 * Busca transações internas candidatas para reconciliação
 */
async function findCandidateInternalTransactions(
  entityId: string,
  externalDate: string,
  externalAmount: number,
  direction: 'in' | 'out'
): Promise<Transaction[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Buscar transações próximas (mesma entidade, data próxima, valor próximo)
  const dateStart = new Date(externalDate)
  dateStart.setDate(dateStart.getDate() - 2)
  const dateEnd = new Date(externalDate)
  dateEnd.setDate(dateEnd.getDate() + 2)

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id, entity_id, date, amount, description")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .gte("date", dateStart.toISOString().split("T")[0])
    .lte("date", dateEnd.toISOString().split("T")[0])

  if (error) {
    throw new Error(`Erro ao buscar transações candidatas: ${error.message}`)
  }

  if (!transactions) {
    return []
  }

  // Filtrar por valor e direção
  const amountThreshold = 0.01 // 1 centavo de tolerância
  const externalAbsAmount = Math.abs(externalAmount)

  return transactions.filter((tx) => {
    const txAbsAmount = Math.abs(Number(tx.amount))
    const amountMatch = Math.abs(txAbsAmount - externalAbsAmount) <= amountThreshold

    // Verificar direção (in = income positivo, out = expense negativo)
    const directionMatch =
      (direction === 'in' && Number(tx.amount) > 0) ||
      (direction === 'out' && Number(tx.amount) < 0)

    return amountMatch && directionMatch
  })
}

/**
 * Sugere matches para uma transação externa
 */
export async function suggestReconciliationMatches(
  externalTransactionId: string
): Promise<Array<{ transaction: Transaction; confidence: number; evidence: Record<string, any> }>> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Buscar transação externa
  const { data: externalTx, error: externalError } = await supabase
    .from("external_transactions")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("id", externalTransactionId)
    .single()

  if (externalError || !externalTx) {
    throw new Error("Transação externa não encontrada")
  }

  // Verificar se já está reconciliada
  const { data: existingLink } = await supabase
    .from("reconciliation_links")
    .select("internal_transaction_id")
    .eq("workspace_id", workspace.id)
    .eq("external_transaction_id", externalTransactionId)
    .maybeSingle()

  if (existingLink) {
    return [] // Já reconciliada
  }

  // Buscar candidatos
  const candidates = await findCandidateInternalTransactions(
    externalTx.entity_id,
    externalTx.posted_at,
    externalTx.amount,
    externalTx.direction
  )

  // Calcular confiança para cada candidato
  const matches = candidates.map((candidate) => {
    const dateMatch = candidate.date === externalTx.posted_at
    const amountMatch = Math.abs(Math.abs(Number(candidate.amount)) - externalTx.amount) < 0.01

    let similarity = 0
    if (externalTx.description_norm && candidate.description) {
      similarity = calculateSimilarity(externalTx.description_norm, candidate.description)
    }

    // Calcular confiança combinada
    let confidence = 0
    if (dateMatch && amountMatch) {
      confidence = 0.7 // Base
      if (similarity > 0.5) {
        confidence = 0.9 // Alta confiança com descrição similar
      } else if (similarity > 0.3) {
        confidence = 0.8 // Boa confiança
      }
    } else if (amountMatch) {
      confidence = 0.5 // Valor exato mas data diferente
    }

    const evidence = {
      date_match: dateMatch,
      amount_match: amountMatch,
      similarity,
      candidate_date: candidate.date,
      candidate_amount: candidate.amount,
      candidate_description: candidate.description,
      external_date: externalTx.posted_at,
      external_amount: externalTx.amount,
      external_description: externalTx.description_raw,
    }

    return {
      transaction: candidate,
      confidence,
      evidence,
    }
  })

  // Ordenar por confiança
  return matches.filter((m) => m.confidence > 0.5).sort((a, b) => b.confidence - a.confidence)
}

/**
 * Cria link de reconciliação
 */
export async function createReconciliationLink(
  externalTransactionId: string,
  internalTransactionId: string,
  matchType: 'exact' | 'heuristic' | 'manual',
  confidence?: number,
  evidence?: Record<string, any>
): Promise<ReconciliationLink> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  // Verificar se já existe link para esta transação externa
  const { data: existing } = await supabase
    .from("reconciliation_links")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("external_transaction_id", externalTransactionId)
    .maybeSingle()

  if (existing) {
    throw new Error("Transação externa já está reconciliada")
  }

  const { data: link, error } = await supabase
    .from("reconciliation_links")
    .insert({
      workspace_id: workspace.id,
      external_transaction_id: externalTransactionId,
      internal_transaction_id: internalTransactionId,
      match_type: matchType,
      confidence: confidence !== undefined ? confidence : null,
      evidence: evidence || {},
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar link de reconciliação: ${error.message}`)
  }

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "reconciliation.reconcile",
    resource_type: "reconciliation_link",
    resource_id: link.id,
    metadata: { external_transaction_id: externalTransactionId, internal_transaction_id: internalTransactionId, match_type: matchType },
  })

  return link
}

/**
 * Remove link de reconciliação
 */
export async function removeReconciliationLink(externalTransactionId: string): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const { data: link } = await supabase
    .from("reconciliation_links")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("external_transaction_id", externalTransactionId)
    .maybeSingle()

  if (!link) {
    return
  }

  const { error } = await supabase
    .from("reconciliation_links")
    .delete()
    .eq("id", link.id)

  if (error) {
    throw new Error(`Erro ao remover link de reconciliação: ${error.message}`)
  }

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "reconciliation.unreconcile",
    resource_type: "reconciliation_link",
    resource_id: link.id,
    metadata: { external_transaction_id: externalTransactionId },
  })
}

