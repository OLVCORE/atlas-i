/**
 * MC7.1: Account Balances (Cash Position)
 * 
 * Calcula saldo atual por conta e consolidado por tipo
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export type AccountCurrentBalance = {
  account_id: string
  as_of: string // ISO date
  current_balance: number
}

export type AccountBalanceDetail = {
  account_id: string
  name: string
  type: string
  entity_id: string
  initial_balance: number
  initial_balance_date: string | null
  current_balance: number
}

export type CashPositionSummary = {
  by_account: AccountBalanceDetail[]
  totals: {
    checking_total: number
    investment_total: number
    grand_total: number
  }
  as_of: string // ISO date
}

/**
 * Calcula saldo atual de uma conta específica até uma data
 * 
 * @param accountId ID da conta
 * @param asOf Data de referência (default: hoje)
 */
export async function getAccountCurrentBalance(
  accountId: string,
  asOf?: Date
): Promise<AccountCurrentBalance> {
  const supabase = await createClient()
  const asOfDate = asOf || new Date()
  const asOfISO = asOfDate.toISOString().split('T')[0]

  // Buscar saldo inicial da conta
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("opening_balance, opening_balance_as_of")
    .eq("id", accountId)
    .single()

  if (accountError) {
    throw new Error(`Erro ao buscar conta: ${accountError.message}`)
  }

  const initialBalance = Number(account.opening_balance || 0)

  // Buscar transactions até asOf (incluindo o dia)
  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("account_id", accountId)
    .lte("date", asOfISO)
    .is("reversed_by_id", null) // Ignorar transações revertidas

  if (txError) {
    throw new Error(`Erro ao buscar transações: ${txError.message}`)
  }

  // Calcular saldo: income soma, expense subtrai
  const transactionsBalance = (transactions || []).reduce((sum, tx) => {
    const amount = Math.abs(Number(tx.amount || 0))
    if (tx.type === "income") {
      return sum + amount
    } else if (tx.type === "expense") {
      return sum - amount
    }
    return sum
  }, 0)

  const currentBalance = initialBalance + transactionsBalance

  return {
    account_id: accountId,
    as_of: asOfISO,
    current_balance: currentBalance,
  }
}

/**
 * Calcula resumo de posição de caixa consolidado
 * 
 * @param entityId Opcional: filtrar por entidade
 * @param asOf Data de referência (default: hoje)
 */
export async function getCashPositionSummary(
  entityId?: string,
  asOf?: Date
): Promise<CashPositionSummary> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  const asOfDate = asOf || new Date()
  const asOfISO = asOfDate.toISOString().split('T')[0]

  // Buscar contas do workspace (filtrar por entity se informado)
  let accountsQuery = supabase
    .from("accounts")
    .select("id, name, type, entity_id, opening_balance, opening_balance_as_of")
    .eq("workspace_id", workspace.id)
    .in("type", ["checking", "investment"])

  if (entityId) {
    accountsQuery = accountsQuery.eq("entity_id", entityId)
  }

  const { data: accounts, error: accountsError } = await accountsQuery

  if (accountsError) {
    throw new Error(`Erro ao buscar contas: ${accountsError.message}`)
  }

  if (!accounts || accounts.length === 0) {
    return {
      by_account: [],
      totals: {
        checking_total: 0,
        investment_total: 0,
        grand_total: 0,
      },
      as_of: asOfISO,
    }
  }

  // Buscar todas as transactions das contas até asOf em uma única query (agregação eficiente)
  const accountIds = accounts.map((a) => a.id)

  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("account_id, type, amount")
    .in("account_id", accountIds)
    .lte("date", asOfISO)
    .is("reversed_by_id", null)

  if (txError) {
    throw new Error(`Erro ao buscar transações: ${txError.message}`)
  }

  // Agregar transactions por account_id
  const transactionsByAccount = new Map<string, number>()
  ;(transactions || []).forEach((tx) => {
    const accountId = tx.account_id
    const amount = Math.abs(Number(tx.amount || 0))
    const current = transactionsByAccount.get(accountId) || 0

    if (tx.type === "income") {
      transactionsByAccount.set(accountId, current + amount)
    } else if (tx.type === "expense") {
      transactionsByAccount.set(accountId, current - amount)
    }
  })

  // Calcular saldo atual por conta
  const by_account: AccountBalanceDetail[] = accounts.map((account) => {
    const initialBalance = Number(account.opening_balance || 0)
    const transactionsBalance = transactionsByAccount.get(account.id) || 0
    const currentBalance = initialBalance + transactionsBalance

    return {
      account_id: account.id,
      name: account.name,
      type: account.type,
      entity_id: account.entity_id,
      initial_balance: initialBalance,
      initial_balance_date: account.opening_balance_as_of,
      current_balance: currentBalance,
    }
  })

  // Calcular totais por tipo
  let checking_total = 0
  let investment_total = 0

  by_account.forEach((acc) => {
    if (acc.type === "checking") {
      checking_total += acc.current_balance
    } else if (acc.type === "investment") {
      investment_total += acc.current_balance
    }
  })

  const grand_total = checking_total + investment_total

  return {
    by_account,
    totals: {
      checking_total,
      investment_total,
      grand_total,
    },
    as_of: asOfISO,
  }
}

