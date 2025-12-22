/**
 * MC6: Drill-down de Fluxo de Caixa
 * 
 * Funções para listar itens (schedules/transactions) de um mês específico
 * para exibição no drill-down da matriz mensal
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export type CashflowDrillDownItem = {
  id: string
  date: string
  description: string
  amount: number
  entity_id: string
  entity_name?: string
  source_type: 'schedule_commitment' | 'schedule_contract' | 'transaction'
  source_id: string
  link_url?: string
}

export type CashflowDrillDownResult = {
  items: CashflowDrillDownItem[]
  total: number
}

/**
 * Lista itens previstos (schedules) de um mês específico
 */
export async function listPlannedItemsForMonth(
  monthStart: string, // YYYY-MM-01
  filters?: {
    entity_id?: string
    direction?: 'income' | 'expense'
  }
): Promise<CashflowDrillDownResult> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Validar formato
  if (!/^\d{4}-\d{2}-01$/.test(monthStart)) {
    throw new Error(`Formato de mês inválido. Esperado: YYYY-MM-01. Recebido: ${monthStart}`)
  }

  const monthStartDate = new Date(monthStart + "T00:00:00")
  const monthEndDate = new Date(monthStartDate.getFullYear(), monthStartDate.getMonth() + 1, 0)

  const items: CashflowDrillDownItem[] = []

  // Buscar financial_schedules PLANNED
  let fsQuery = supabase
    .from("financial_schedules")
    .select(`
      id,
      due_date,
      amount,
      commitment_id,
      financial_commitments!inner (
        id,
        type,
        description,
        entity_id,
        entities!inner (
          legal_name
        )
      )
    `)
    .eq("workspace_id", workspace.id)
    .eq("status", "planned")
    .is("linked_transaction_id", null)
    .is("deleted_at", null)
    .gte("due_date", monthStartDate.toISOString().split('T')[0])
    .lte("due_date", monthEndDate.toISOString().split('T')[0])

  if (filters?.entity_id) {
    fsQuery = fsQuery.eq("financial_commitments.entity_id", filters.entity_id)
  }

  const { data: financialSchedules, error: fsError } = await fsQuery

  if (fsError) {
    throw new Error(`Erro ao buscar financial_schedules: ${fsError.message}`)
  }

  // Processar financial_schedules
  for (const fs of financialSchedules || []) {
    const commitment = (fs as any).financial_commitments
    if (!commitment) continue

    const isIncome = commitment.type === 'revenue'
    const isExpense = commitment.type === 'expense'

    // Filtrar por direção se especificado
    if (filters?.direction === 'income' && !isIncome) continue
    if (filters?.direction === 'expense' && !isExpense) continue

    items.push({
      id: fs.id,
      date: fs.due_date,
      description: commitment.description || "Sem descrição",
      amount: Number(fs.amount),
      entity_id: commitment.entity_id,
      entity_name: commitment.entities?.legal_name,
      source_type: 'schedule_commitment',
      source_id: fs.commitment_id,
      link_url: `/app/commitments?highlight=${fs.commitment_id}`,
    })
  }

  // Buscar contract_schedules PLANNED
  let csQuery = supabase
    .from("contract_schedules")
    .select(`
      id,
      due_date,
      amount,
      type,
      contract_id,
      contracts!inner (
        id,
        title,
        counterparty_entity_id
      )
    `)
    .eq("workspace_id", workspace.id)
    .eq("status", "planned")
    .is("linked_transaction_id", null)
    .is("deleted_at", null)
    .gte("due_date", monthStartDate.toISOString().split('T')[0])
    .lte("due_date", monthEndDate.toISOString().split('T')[0])

  if (filters?.entity_id) {
    csQuery = csQuery.eq("contracts.counterparty_entity_id", filters.entity_id)
  }

  const { data: contractSchedules, error: csError } = await csQuery

  if (csError) {
    throw new Error(`Erro ao buscar contract_schedules: ${csError.message}`)
  }

  // Buscar entities para os contratos encontrados
  const contractEntityIds = new Set<string>()
  for (const cs of contractSchedules || []) {
    const contract = (cs as any).contracts
    if (contract?.counterparty_entity_id) {
      contractEntityIds.add(contract.counterparty_entity_id)
    }
  }

  let contractEntitiesMap: Record<string, { legal_name: string }> = {}
  if (contractEntityIds.size > 0) {
    const { data: contractEntities, error: contractEntitiesError } = await supabase
      .from("entities")
      .select("id, legal_name")
      .in("id", Array.from(contractEntityIds))
      .eq("workspace_id", workspace.id)

    if (!contractEntitiesError && contractEntities) {
      for (const entity of contractEntities) {
        contractEntitiesMap[entity.id] = { legal_name: entity.legal_name }
      }
    }
  }

  // Processar contract_schedules
  for (const cs of contractSchedules || []) {
    const contract = (cs as any).contracts
    if (!contract) continue

    const isIncome = cs.type === 'receivable'
    const isExpense = cs.type === 'payable'

    // Filtrar por direção se especificado
    if (filters?.direction === 'income' && !isIncome) continue
    if (filters?.direction === 'expense' && !isExpense) continue

    items.push({
      id: cs.id,
      date: cs.due_date,
      description: contract.title || "Sem descrição",
      amount: Number(cs.amount),
      entity_id: contract.counterparty_entity_id,
      entity_name: contractEntitiesMap[contract.counterparty_entity_id]?.legal_name,
      source_type: 'schedule_contract',
      source_id: cs.contract_id,
      link_url: `/app/contracts?highlight=${cs.contract_id}`,
    })
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0)

  return {
    items: items.sort((a, b) => a.date.localeCompare(b.date)),
    total,
  }
}

/**
 * Lista itens realizados (transactions) de um mês específico
 */
export async function listRealisedItemsForMonth(
  monthStart: string, // YYYY-MM-01
  filters?: {
    entity_id?: string
    account_id?: string
    direction?: 'income' | 'expense'
  }
): Promise<CashflowDrillDownResult> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Validar formato
  if (!/^\d{4}-\d{2}-01$/.test(monthStart)) {
    throw new Error(`Formato de mês inválido. Esperado: YYYY-MM-01. Recebido: ${monthStart}`)
  }

  const monthStartDate = new Date(monthStart + "T00:00:00")
  const monthEndDate = new Date(monthStartDate.getFullYear(), monthStartDate.getMonth() + 1, 0)

  let txQuery = supabase
    .from("transactions")
    .select(`
      id,
      date,
      description,
      amount,
      type,
      entity_id
    `)
    .eq("workspace_id", workspace.id)
    .is("reversed_by_id", null)
    .gte("date", monthStartDate.toISOString().split('T')[0])
    .lte("date", monthEndDate.toISOString().split('T')[0])

  if (filters?.entity_id) {
    txQuery = txQuery.eq("entity_id", filters.entity_id)
  }

  if (filters?.account_id) {
    txQuery = txQuery.eq("account_id", filters.account_id)
  }

  const { data: transactions, error: txError } = await txQuery

  if (txError) {
    throw new Error(`Erro ao buscar transactions: ${txError.message}`)
  }

  // Buscar entities para as transactions
  const txEntityIds = new Set<string>()
  for (const tx of transactions || []) {
    if (tx.entity_id) {
      txEntityIds.add(tx.entity_id)
    }
  }

  let txEntitiesMap: Record<string, { legal_name: string }> = {}
  if (txEntityIds.size > 0) {
    const { data: txEntities, error: txEntitiesError } = await supabase
      .from("entities")
      .select("id, legal_name")
      .in("id", Array.from(txEntityIds))
      .eq("workspace_id", workspace.id)

    if (!txEntitiesError && txEntities) {
      for (const entity of txEntities) {
        txEntitiesMap[entity.id] = { legal_name: entity.legal_name }
      }
    }
  }

  const items: CashflowDrillDownItem[] = []

  for (const tx of transactions || []) {
    const isIncome = tx.type === 'income'
    const isExpense = tx.type === 'expense'

    // Filtrar por direção se especificado
    if (filters?.direction === 'income' && !isIncome) continue
    if (filters?.direction === 'expense' && !isExpense) continue

    // Pular transferências (não são receita nem despesa)
    if (tx.type === 'transfer') continue

    items.push({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: Math.abs(Number(tx.amount)),
      entity_id: tx.entity_id,
      entity_name: txEntitiesMap[tx.entity_id]?.legal_name,
      source_type: 'transaction',
      source_id: tx.id,
      link_url: `/app/ledger?highlight=${tx.id}`,
    })
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0)

  return {
    items: items.sort((a, b) => a.date.localeCompare(b.date)),
    total,
  }
}

