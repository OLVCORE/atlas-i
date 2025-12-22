import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export async function listAccountsByEntity(entityId: string) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar accounts: ${error.message}`)
  }

  return data || []
}

export async function listAllAccounts() {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar accounts: ${error.message}`)
  }

  return data || []
}

export async function createAccount(
  entityId: string,
  name: string,
  type: "checking" | "investment" | "other",
  openingBalance: number = 0,
  openingBalanceDate: string = new Date().toISOString().split("T")[0],
  currency: string = "BRL"
) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      workspace_id: workspace.id,
      entity_id: entityId,
      name,
      type,
      opening_balance: openingBalance,
      opening_balance_date: openingBalanceDate,
      currency,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar account: ${error.message}`)
  }

  return data
}

