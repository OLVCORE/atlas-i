import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export type AccountListItem = {
  id: string
  workspace_id: string
  entity_id: string
  name: string
  type: "checking" | "investment" | "other"
  opening_balance: number
  opening_balance_as_of: string | null
  opening_balance_date?: string | null // Campo alternativo usado em algumas migrations
  currency: string
  created_at: string
}

/**
 * Lista contas do workspace, opcionalmente filtradas por entidade.
 * Se entityId for fornecido, retorna apenas contas daquela entidade.
 * Se entityId for null/undefined, retorna todas as contas (consolidado).
 */
export async function listAccounts({
  workspaceId,
  entityId,
}: {
  workspaceId: string
  entityId?: string | null
}): Promise<AccountListItem[]> {
  const supabase = await createClient()

  let query = supabase
    .from("accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true })

  // Filtrar por entity_id se fornecido
  if (entityId) {
    query = query.eq("entity_id", entityId)
  }

  // Filtrar deleted_at se existir na tabela
  // Nota: Se a coluna não existir, o RLS já deve tratar isso
  // Mas vamos garantir que não mostramos deletados
  const { data, error } = await query

  if (error) {
    throw new Error(`Erro ao listar accounts: ${error.message}`)
  }

  // Filtrar deleted_at manualmente se necessário (caso RLS não cubra)
  const accounts = (data || []).filter((acc: any) => !acc.deleted_at)

  return accounts as AccountListItem[]
}

