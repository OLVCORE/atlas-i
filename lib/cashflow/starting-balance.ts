/**
 * MC6.2: Starting Balance (Saldo Inicial de Contas)
 * 
 * Calcula saldo inicial consolidado baseado em opening_balance das contas
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export type StartingBalanceResult = {
  startingBalance: number
  asOfDate: string | null // Data mais recente entre as contas (ou null se todas forem null)
}

/**
 * Calcula saldo inicial consolidado baseado em opening_balance das contas
 * 
 * @param filters Filtros opcionais: entityId, accountId
 */
export async function getStartingBalance(filters?: {
  entityId?: string
  accountId?: string
}): Promise<StartingBalanceResult> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  let query = supabase
    .from("accounts")
    .select("opening_balance, opening_balance_as_of")
    .eq("workspace_id", workspace.id)
    .in("type", ["checking", "investment"]) // Apenas contas correntes e investimentos

  if (filters?.entityId) {
    query = query.eq("entity_id", filters.entityId)
  }

  if (filters?.accountId) {
    query = query.eq("id", filters.accountId)
  }

  const { data: accounts, error } = await query

  if (error) {
    throw new Error(`Erro ao buscar saldos iniciais: ${error.message}`)
  }

  if (!accounts || accounts.length === 0) {
    return {
      startingBalance: 0,
      asOfDate: null,
    }
  }

  // Calcular saldo total
  const startingBalance = accounts.reduce((sum, account) => {
    return sum + Number(account.opening_balance || 0)
  }, 0)

  // Encontrar data mais recente (se houver)
  const dates = accounts
    .map((a) => a.opening_balance_as_of)
    .filter((d) => d !== null) as string[]

  const asOfDate = dates.length > 0
    ? dates.sort().reverse()[0] // Data mais recente
    : null

  return {
    startingBalance,
    asOfDate,
  }
}

