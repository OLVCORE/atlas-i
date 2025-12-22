/**
 * MC3.1: Gerenciamento de External Transactions (transações externas ingeridas)
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { normalizeDescription } from "./normalize"

export type ExternalTransaction = {
  id: string
  workspace_id: string
  entity_id: string
  external_account_id: string
  external_tx_id: string
  posted_at: string
  amount: number
  direction: 'in' | 'out'
  description_raw: string
  description_norm: string | null
  balance_after: number | null
  category_hint: string | null
  raw: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Lista transações externas
 */
export async function listExternalTransactions(
  externalAccountId?: string,
  startDate?: string,
  endDate?: string
): Promise<ExternalTransaction[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  let query = supabase
    .from("external_transactions")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("posted_at", { ascending: false })
    .order("created_at", { ascending: false })

  if (externalAccountId) {
    query = query.eq("external_account_id", externalAccountId)
  }

  if (startDate) {
    query = query.gte("posted_at", startDate)
  }

  if (endDate) {
    query = query.lte("posted_at", endDate)
  }

  const { data: transactions, error } = await query

  if (error) {
    throw new Error(`Erro ao listar transações externas: ${error.message}`)
  }

  return transactions || []
}

/**
 * Insere ou atualiza transação externa (deduplicação determinística)
 */
export async function upsertExternalTransaction(
  entityId: string,
  externalAccountId: string,
  externalTxId: string,
  postedAt: string,
  amount: number,
  direction: 'in' | 'out',
  descriptionRaw: string,
  balanceAfter?: number,
  categoryHint?: string,
  raw?: Record<string, any>
): Promise<ExternalTransaction> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const descriptionNorm = normalizeDescription(descriptionRaw)

  // Tentar buscar existente
  const { data: existing } = await supabase
    .from("external_transactions")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("external_account_id", externalAccountId)
    .eq("external_tx_id", externalTxId)
    .maybeSingle()

  const transactionData = {
    workspace_id: workspace.id,
    entity_id: entityId,
    external_account_id: externalAccountId,
    external_tx_id: externalTxId,
    posted_at: postedAt,
    amount: Math.abs(amount),
    direction,
    description_raw: descriptionRaw,
    description_norm: descriptionNorm,
    balance_after: balanceAfter || null,
    category_hint: categoryHint || null,
    raw: raw || {},
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    // Atualizar
    const { data: transaction, error } = await supabase
      .from("external_transactions")
      .update(transactionData)
      .eq("id", existing.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erro ao atualizar transação externa: ${error.message}`)
    }

    return transaction
  } else {
    // Inserir
    const { data: transaction, error } = await supabase
      .from("external_transactions")
      .insert(transactionData)
      .select()
      .single()

    if (error) {
      throw new Error(`Erro ao inserir transação externa: ${error.message}`)
    }

    return transaction
  }
}

