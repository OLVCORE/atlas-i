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
      opening_balance_as_of: openingBalanceDate,
      currency,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar account: ${error.message}`)
  }

  return data
}

/**
 * Atualiza o saldo atual de uma conta manualmente
 * IMPORTANTE: Não altera o opening_balance! O opening_balance sempre permanece como o saldo inicial original.
 * Para ajustar o saldo atual, cria uma transação de ajuste.
 * 
 * @param accountId ID da conta
 * @param newBalance Novo saldo atual desejado
 * @param balanceDate Data do novo saldo (default: hoje)
 * @param description Descrição opcional do ajuste
 */
export async function updateAccountBalance(
  accountId: string,
  newBalance: number,
  balanceDate: string = new Date().toISOString().split("T")[0],
  description?: string
) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Buscar conta atual
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .eq("workspace_id", workspace.id)
    .single()

  if (accountError || !account) {
    throw new Error("Conta não encontrada")
  }

  // Buscar saldo atual calculado até a data de referência
  const { getAccountCurrentBalance } = await import("./accounts/balances")
  const currentBalanceData = await getAccountCurrentBalance(accountId, new Date(balanceDate))
  const currentCalculatedBalance = currentBalanceData.current_balance

  // Calcular diferença entre o saldo desejado e o saldo calculado
  const difference = newBalance - currentCalculatedBalance

  // IMPORTANTE: Não alteramos opening_balance! 
  // O opening_balance sempre permanece como o saldo inicial original.
  // Para ajustar o saldo atual, criamos uma transação de ajuste.

  if (Math.abs(difference) > 0.01) {
    const { createTransaction } = await import("./transactions")
    try {
      // Criar transação de ajuste para corrigir o saldo atual
      await createTransaction(
        account.entity_id,
        difference > 0 ? "income" : "expense",
        Math.abs(difference),
        balanceDate,
        description || `Ajuste manual de saldo - ${balanceDate}`,
        accountId,
        account.currency
      )
    } catch (txError) {
      throw new Error(`Erro ao criar transação de ajuste: ${txError instanceof Error ? txError.message : 'Erro desconhecido'}`)
    }
  }

  // Retornar a conta (sem alterações no opening_balance)
  return account
}
