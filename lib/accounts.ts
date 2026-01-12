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
    .is("deleted_at", null) // Filtrar contas deletadas
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
    .is("deleted_at", null) // Filtrar contas deletadas
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

  // Buscar conta atual (apenas se não estiver deletada)
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null) // Filtrar contas deletadas
    .single()

  if (accountError || !account) {
    throw new Error("Conta não encontrada")
  }

  // IMPORTANTE: O saldo atual deve ser calculado até HOJE (data atual)
  // para que a transação de ajuste seja incluída no cálculo do saldo atual na tabela
  const today = new Date()
  const { getAccountCurrentBalance } = await import("./accounts/balances")
  const currentBalanceData = await getAccountCurrentBalance(accountId, today)
  const currentCalculatedBalance = currentBalanceData.current_balance

  // Calcular diferença entre o saldo desejado e o saldo calculado até hoje
  const difference = newBalance - currentCalculatedBalance

  // IMPORTANTE: Não alteramos opening_balance! 
  // O opening_balance sempre permanece como o saldo inicial original.
  // Para ajustar o saldo atual, criamos uma transação de ajuste.

  if (Math.abs(difference) > 0.01) {
    const { createTransaction } = await import("./transactions")
    try {
      // Criar transação de ajuste com data de HOJE para que seja incluída no cálculo do saldo atual
      const todayISO = today.toISOString().split("T")[0]
      const transactionDescription = description || `Ajuste manual de saldo${balanceDate && balanceDate !== todayISO ? ` (referência: ${balanceDate})` : ""}`
      
      await createTransaction(
        account.entity_id,
        difference > 0 ? "income" : "expense",
        Math.abs(difference),
        todayISO, // Sempre usar data de hoje para que seja incluída no cálculo do saldo atual
        transactionDescription,
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

/**
 * Atualiza uma conta
 * @param accountId ID da conta a ser atualizada
 * @param data Dados a serem atualizados
 */
export async function updateAccount(
  accountId: string,
  data: {
    name?: string
    entity_id?: string
    type?: "checking" | "investment" | "other"
    opening_balance?: number
    opening_balance_as_of?: string
  }
) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const updateData: Record<string, any> = {}
  
  if (data.name !== undefined) updateData.name = data.name
  if (data.entity_id !== undefined) updateData.entity_id = data.entity_id
  if (data.type !== undefined) updateData.type = data.type
  if (data.opening_balance !== undefined) updateData.opening_balance = data.opening_balance
  if (data.opening_balance_as_of !== undefined) updateData.opening_balance_as_of = data.opening_balance_as_of

  const { data: updatedAccount, error } = await supabase
    .from("accounts")
    .update(updateData)
    .eq("id", accountId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null) // Não permitir atualizar contas deletadas
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar account: ${error.message}`)
  }

  return updatedAccount
}

/**
 * Deleta uma conta (soft delete)
 * @param accountId ID da conta a ser deletada
 */
export async function deleteAccount(accountId: string) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Atualizar deleted_at (soft delete)
  const { error } = await supabase
    .from("accounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("workspace_id", workspace.id)

  if (error) {
    throw new Error(`Erro ao deletar account: ${error.message}`)
  }
}
