import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { logAudit } from "./audit"

export type Transaction = {
  id: string
  workspace_id: string
  entity_id: string
  account_id: string | null
  type: "income" | "expense" | "transfer"
  amount: number
  currency: string
  date: string
  description: string
  status?: "posted" | "reversed"
  reversed_by_id?: string | null
  created_at: string
}

export async function listTransactionsByAccount(accountId: string) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("account_id", accountId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar transactions: ${error.message}`)
  }

  return data || []
}

export async function listTransactionsByEntity(entityId: string) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar transactions: ${error.message}`)
  }

  return data || []
}

export async function createTransaction(
  entityId: string,
  type: "income" | "expense" | "transfer",
  amount: number,
  date: string,
  description: string,
  accountId: string | null = null,
  currency: string = "BRL"
) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      workspace_id: workspace.id,
      entity_id: entityId,
      account_id: accountId,
      type,
      amount: type === "expense" ? -Math.abs(amount) : Math.abs(amount),
      currency,
      date,
      description,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar transaction: ${error.message}`)
  }

  // Gravar audit log
  await logAudit('create', 'transaction', data.id, null, data)

  return data
}

/**
 * MC5: Reverte uma transação
 * 
 * REGRAS:
 * - Nunca editar uma transação realizada
 * - Nunca apagar transação
 * - Reversão = nova transação contábil
 * - Não permite reversão dupla
 */
export async function reverseTransaction(transactionId: string): Promise<Transaction> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Buscar transação original
  const { data: original, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("workspace_id", workspace.id)
    .single()

  if (fetchError || !original) {
    throw new Error("Transação não encontrada")
  }

  // Validar que não está já revertida
  // Como não temos campo status ainda, verificamos se existe outra transação que referencia esta
  const { data: existingReversal, error: reversalCheckError } = await supabase
    .from("transactions")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("reversed_by_id", transactionId)
    .limit(1)

  if (reversalCheckError) {
    throw new Error(`Erro ao verificar reversão existente: ${reversalCheckError.message}`)
  }

  if (existingReversal && existingReversal.length > 0) {
    throw new Error("Esta transação já foi revertida")
  }

  // Criar transação de reversão (valor invertido)
  const reversalAmount = -original.amount
  const reversalDescription = `[REVERSÃO] ${original.description}`

  const { data: reversal, error: reversalError } = await supabase
    .from("transactions")
    .insert({
      workspace_id: workspace.id,
      entity_id: original.entity_id,
      account_id: original.account_id,
      type: original.type,
      amount: reversalAmount,
      currency: original.currency,
      date: original.date,
      description: reversalDescription,
      reversed_by_id: transactionId, // Referência à transação original
    })
    .select()
    .single()

  if (reversalError) {
    throw new Error(`Erro ao criar transação de reversão: ${reversalError.message}`)
  }

  // Gravar audit log da reversão (antes/depois)
  await logAudit('reverse', 'transaction', transactionId, original, {
    ...original,
    reversal_id: reversal.id,
    reversed: true,
  })

  // Gravar audit log da transação de reversão criada
  await logAudit('create', 'transaction', reversal.id, null, reversal)

  return reversal
}

/**
 * Lista todas as transações do workspace (com filtros opcionais)
 */
export async function listAllTransactions(filters?: {
  entityId?: string
  accountId?: string
  type?: "income" | "expense" | "transfer"
  startDate?: string
  endDate?: string
}): Promise<Transaction[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

  if (filters?.entityId) {
    query = query.eq("entity_id", filters.entityId)
  }

  if (filters?.accountId) {
    query = query.eq("account_id", filters.accountId)
  }

  if (filters?.type) {
    query = query.eq("type", filters.type)
  }

  if (filters?.startDate) {
    query = query.gte("date", filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte("date", filters.endDate)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Erro ao listar transactions: ${error.message}`)
  }

  return data || []
}
