/**
 * MC6: Fluxo de Caixa Mensal (Monthly Cashflow Matrix)
 * 
 * Fonte de verdade: função SQL get_monthly_cashflow_matrix
 * Retorna dataset mensal agregado para renderização em matriz tipo planilha
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { formatDateISO } from "@/lib/utils/dates"
import { getOpeningBalance } from "./opening-balance"

export type MonthlyCashflowMonth = {
  month_start: string // YYYY-MM-01
  planned_income: number
  planned_expense: number
  planned_net: number
  realised_income: number
  realised_expense: number
  realised_net: number
  planned_cum: number
  realised_cum: number
  planned_cum_adj?: number // opening_balance + planned_cum
  realised_cum_adj?: number // opening_balance + realised_cum
  planned_projected_cum?: number // deprecated: usar planned_cum_adj
  realised_projected_cum?: number // deprecated: usar realised_cum_adj
}

export type MonthlyCashflowMetadata = {
  min_cum_balance: number | null
  min_cum_month: string | null // YYYY-MM-01
  opening_balance?: number
  opening_date?: string | null
  min_cum_balance_adj?: number | null // min_cum_balance + opening_balance
  starting_balance?: number // deprecated: usar opening_balance
  starting_balance_as_of?: string | null // deprecated: usar opening_date
  min_projected_balance?: number | null // deprecated: usar min_cum_balance_adj
  min_projected_month?: string | null
}

export type MonthlyCashflowMatrix = {
  months: MonthlyCashflowMonth[]
  metadata: MonthlyCashflowMetadata
}

export type MonthlyCashflowFilters = {
  from_month: string // YYYY-MM-01
  to_month: string // YYYY-MM-01
  entity_id?: string
  account_id?: string
}

/**
 * Retorna matriz mensal de fluxo de caixa
 * 
 * @param filters Filtros de período, entidade e conta
 */
export async function getMonthlyCashflowMatrix(
  filters: MonthlyCashflowFilters
): Promise<MonthlyCashflowMatrix> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Validar formato de datas (deve ser YYYY-MM-01)
  const fromMonthRegex = /^\d{4}-\d{2}-01$/
  const toMonthRegex = /^\d{4}-\d{2}-01$/
  
  if (!fromMonthRegex.test(filters.from_month)) {
    throw new Error(`Data inicial inválida. Formato esperado: YYYY-MM-01. Recebido: ${filters.from_month}`)
  }
  
  if (!toMonthRegex.test(filters.to_month)) {
    throw new Error(`Data final inválida. Formato esperado: YYYY-MM-01. Recebido: ${filters.to_month}`)
  }

  // Chamar função SQL
  const { data, error } = await supabase.rpc('get_monthly_cashflow_matrix', {
    p_workspace_id: workspace.id,
    p_from_month: filters.from_month,
    p_to_month: filters.to_month,
    p_entity_id: filters.entity_id || null,
    p_account_id: filters.account_id || null,
  })

  if (error) {
    throw new Error(`Erro ao calcular fluxo de caixa mensal: ${error.message}`)
  }

  if (!data || !data.months) {
    return {
      months: [],
      metadata: {
        min_cum_balance: null,
        min_cum_month: null,
      },
    }
  }

  // Buscar opening balance (saldo consolidado até o início do período)
  const openingBalanceResult = await getOpeningBalance(filters.entity_id, filters.from_month)

  // Normalizar tipos numéricos (PostgreSQL retorna strings para numeric)
  // E calcular cum_adj (opening_balance + cum)
  const months: MonthlyCashflowMonth[] = data.months.map((m: any) => {
    const plannedCum = Number(m.planned_cum || 0)
    const realisedCum = Number(m.realised_cum || 0)
    return {
      month_start: m.month_start,
      planned_income: Number(m.planned_income || 0),
      planned_expense: Number(m.planned_expense || 0),
      planned_net: Number(m.planned_net || 0),
      realised_income: Number(m.realised_income || 0),
      realised_expense: Number(m.realised_expense || 0),
      realised_net: Number(m.realised_net || 0),
      planned_cum: plannedCum,
      realised_cum: realisedCum,
      planned_cum_adj: openingBalanceResult.opening_balance + plannedCum,
      realised_cum_adj: openingBalanceResult.opening_balance + realisedCum,
      // Mantido para compatibilidade (deprecated)
      planned_projected_cum: openingBalanceResult.opening_balance + plannedCum,
      realised_projected_cum: openingBalanceResult.opening_balance + realisedCum,
    }
  })

  // Calcular min_cum_balance_adj (ajustado com opening balance)
  const minCumBalance = data.metadata?.min_cum_balance ? Number(data.metadata.min_cum_balance) : null
  const minCumBalanceAdj = minCumBalance !== null
    ? minCumBalance + openingBalanceResult.opening_balance
    : null

  const metadata: MonthlyCashflowMetadata = {
    min_cum_balance: minCumBalance,
    min_cum_month: data.metadata?.min_cum_month || null,
    opening_balance: openingBalanceResult.opening_balance,
    opening_date: openingBalanceResult.opening_date,
    min_cum_balance_adj: minCumBalanceAdj,
    // Mantido para compatibilidade (deprecated)
    starting_balance: openingBalanceResult.opening_balance,
    starting_balance_as_of: openingBalanceResult.opening_date,
    min_projected_balance: minCumBalanceAdj,
    min_projected_month: data.metadata?.min_cum_month || null,
  }

  return {
    months,
    metadata,
  }
}

