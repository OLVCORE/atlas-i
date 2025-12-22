/**
 * MC4.3.1-AUTO: Fluxo de Caixa (Cashflow)
 * 
 * Fonte ÚNICA: schedules (não ledger)
 * - Previsto = schedules com status planned (e não cancelled)
 * - Realizado = schedules com linked_transaction_id e status realized/received/paid
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { formatDateISO, parseDateISO } from "@/lib/utils/dates"

export type CashflowEntry = {
  period: string // 'YYYY-MM' para monthly, 'YYYY-MM-DD' para daily
  previsto_entradas: number
  previsto_saidas: number
  saldo_previsto: number
  realizado_entradas: number
  realizado_saidas: number
  saldo_realizado: number
}

export type CashflowResult = {
  entries: CashflowEntry[]
  total_previsto_entradas: number
  total_previsto_saidas: number
  total_saldo_previsto: number
  total_realizado_entradas: number
  total_realizado_saidas: number
  total_saldo_realizado: number
}

/**
 * Calcula fluxo de caixa baseado em schedules
 * 
 * @param options.from Data inicial (YYYY-MM-DD)
 * @param options.to Data final (YYYY-MM-DD)
 * @param options.granularity 'day' | 'month'
 */
export async function getCashflow(options: {
  from: string | Date
  to: string | Date
  granularity: 'day' | 'month'
}): Promise<CashflowResult> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const from = typeof options.from === 'string' ? options.from : formatDateISO(options.from)
  const to = typeof options.to === 'string' ? options.to : formatDateISO(options.to)

  // Buscar financial_schedules (commitments)
  const { data: financialSchedules, error: fsError } = await supabase
    .from("financial_schedules")
    .select(`
      due_date,
      amount,
      status,
      linked_transaction_id,
      financial_commitments!inner (
        type
      )
    `)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .gte("due_date", from)
    .lte("due_date", to)
    .is("deleted_at", null)

  if (fsError) {
    throw new Error(`Erro ao buscar financial_schedules: ${fsError.message}`)
  }

  // Buscar contract_schedules
  const { data: contractSchedules, error: csError } = await supabase
    .from("contract_schedules")
    .select(`
      due_date,
      amount,
      status,
      linked_transaction_id,
      type
    `)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .gte("due_date", from)
    .lte("due_date", to)
    .is("deleted_at", null)

  if (csError) {
    throw new Error(`Erro ao buscar contract_schedules: ${csError.message}`)
  }

  // Agregar por período
  const entriesMap = new Map<string, CashflowEntry>()

  // Processar financial_schedules
  for (const fs of financialSchedules || []) {
    const commitment = (fs as any).financial_commitments
    if (!commitment) continue

    const dueDate = fs.due_date
    const period = options.granularity === 'month' 
      ? dueDate.substring(0, 7) // YYYY-MM
      : dueDate // YYYY-MM-DD

    if (!entriesMap.has(period)) {
      entriesMap.set(period, {
        period,
        previsto_entradas: 0,
        previsto_saidas: 0,
        saldo_previsto: 0,
        realizado_entradas: 0,
        realizado_saidas: 0,
        saldo_realizado: 0,
      })
    }

    const entry = entriesMap.get(period)!
    const amount = Number(fs.amount)
    const isPlanned = fs.status === 'planned' && !fs.linked_transaction_id
    const isRealized = (fs.status === 'realized' || fs.linked_transaction_id) && fs.status !== 'cancelled'

    if (commitment.type === 'revenue') {
      // Receita = entrada
      if (isPlanned) {
        entry.previsto_entradas += amount
      }
      if (isRealized) {
        entry.realizado_entradas += amount
      }
    } else {
      // Despesa = saída
      if (isPlanned) {
        entry.previsto_saidas += amount
      }
      if (isRealized) {
        entry.realizado_saidas += amount
      }
    }
  }

  // Processar contract_schedules
  for (const cs of contractSchedules || []) {
    const dueDate = cs.due_date
    const period = options.granularity === 'month' 
      ? dueDate.substring(0, 7) // YYYY-MM
      : dueDate // YYYY-MM-DD

    if (!entriesMap.has(period)) {
      entriesMap.set(period, {
        period,
        previsto_entradas: 0,
        previsto_saidas: 0,
        saldo_previsto: 0,
        realizado_entradas: 0,
        realizado_saidas: 0,
        saldo_realizado: 0,
      })
    }

    const entry = entriesMap.get(period)!
    const amount = Number(cs.amount)
    const isPlanned = cs.status === 'planned' && !cs.linked_transaction_id
    const isRealized = (cs.status === 'received' || cs.status === 'paid' || cs.linked_transaction_id) && cs.status !== 'cancelled'

    if (cs.type === 'receivable') {
      // Recebível = entrada
      if (isPlanned) {
        entry.previsto_entradas += amount
      }
      if (isRealized) {
        entry.realizado_entradas += amount
      }
    } else {
      // Pagável = saída
      if (isPlanned) {
        entry.previsto_saidas += amount
      }
      if (isRealized) {
        entry.realizado_saidas += amount
      }
    }
  }

  // Calcular saldos e ordenar
  const entries: CashflowEntry[] = Array.from(entriesMap.values())
    .map(entry => ({
      ...entry,
      saldo_previsto: entry.previsto_entradas - entry.previsto_saidas,
      saldo_realizado: entry.realizado_entradas - entry.realizado_saidas,
    }))
    .sort((a, b) => a.period.localeCompare(b.period))

  // Calcular totais
  const total_previsto_entradas = entries.reduce((sum, e) => sum + e.previsto_entradas, 0)
  const total_previsto_saidas = entries.reduce((sum, e) => sum + e.previsto_saidas, 0)
  const total_saldo_previsto = total_previsto_entradas - total_previsto_saidas
  const total_realizado_entradas = entries.reduce((sum, e) => sum + e.realizado_entradas, 0)
  const total_realizado_saidas = entries.reduce((sum, e) => sum + e.realizado_saidas, 0)
  const total_saldo_realizado = total_realizado_entradas - total_realizado_saidas

  return {
    entries,
    total_previsto_entradas,
    total_previsto_saidas,
    total_saldo_previsto,
    total_realizado_entradas,
    total_realizado_saidas,
    total_saldo_realizado,
  }
}

