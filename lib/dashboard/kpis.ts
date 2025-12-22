/**
 * MC7: Dashboard Executivo - KPIs derivados
 * 
 * Reutiliza getMonthlyCashflowMatrix como base e deriva KPIs do dataset mensal
 */

import { getMonthlyCashflowMatrix, type MonthlyCashflowMonth, type MonthlyCashflowMetadata } from "@/lib/cashflow/monthly"
import { getCashPositionSummary } from "@/lib/accounts/balances"

export type ExecutiveDashboardKPIs = {
  hasData: boolean
  current_month?: {
    planned_net: number
    realised_net: number
    planned_cum: number
    realised_cum: number
    planned_cum_adj?: number // opening_balance + planned_cum
    realised_cum_adj?: number // opening_balance + realised_cum
  }
  month_totals?: {
    planned_income: number
    planned_expense: number
    realised_income: number
    realised_expense: number
  }
  deltas?: {
    income_delta: number
    expense_delta: number
  }
  worst_point?: {
    min_cum_balance: number
    min_cum_month: string | null
  }
  worst_projected_point?: {
    min_projected_balance: number
    min_projected_month: string | null
  }
  cash_today?: {
    starting_balance: number
    as_of_date: string | null
    checking_total?: number
    investment_total?: number
  }
  trend?: {
    next_3_months_planned_net: number[]
  }
}

export type ExecutiveDashboardFilters = {
  from_month: string // YYYY-MM-01
  to_month: string // YYYY-MM-01
  entity_id?: string
  account_id?: string
  show?: 'both' | 'planned' | 'realised'
}

/**
 * Calcula KPIs executivos derivados do dataset mensal
 */
export async function getExecutiveDashboardKPIs(
  filters: ExecutiveDashboardFilters
): Promise<ExecutiveDashboardKPIs> {
  // Buscar dataset mensal (uma única chamada)
  const matrix = await getMonthlyCashflowMatrix({
    from_month: filters.from_month,
    to_month: filters.to_month,
    entity_id: filters.entity_id,
    account_id: filters.account_id,
  })

  // Se não houver dados, retornar indicador
  if (!matrix.months || matrix.months.length === 0) {
    return {
      hasData: false,
    }
  }

  const months = matrix.months
  const today = new Date()
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0].slice(0, 7) + '-01'

  // Encontrar mês atual (ou primeiro mês do período se atual não estiver no range)
  const currentMonth = months.find(m => m.month_start === currentMonthStart) || months[0]

  // Calcular totais do período
  const month_totals = {
    planned_income: months.reduce((sum, m) => sum + m.planned_income, 0),
    planned_expense: months.reduce((sum, m) => sum + m.planned_expense, 0),
    realised_income: months.reduce((sum, m) => sum + m.realised_income, 0),
    realised_expense: months.reduce((sum, m) => sum + m.realised_expense, 0),
  }

  // Calcular deltas (realised - planned)
  const deltas = {
    income_delta: month_totals.realised_income - month_totals.planned_income,
    expense_delta: month_totals.realised_expense - month_totals.planned_expense,
  }

  // Buscar cash position atual (hoje)
  // Nota: account_id não é aplicado ao cash position (é consolidado)
  const cashPosition = await getCashPositionSummary(filters.entity_id)

  // Worst point (ajustado com opening balance)
  const worst_point = matrix.metadata.min_cum_balance_adj !== null && matrix.metadata.min_cum_balance_adj !== undefined
    ? {
        min_cum_balance: matrix.metadata.min_cum_balance_adj,
        min_cum_month: matrix.metadata.min_cum_month,
      }
    : matrix.metadata.min_cum_balance !== null
    ? {
        min_cum_balance: matrix.metadata.min_cum_balance,
        min_cum_month: matrix.metadata.min_cum_month,
      }
    : undefined

  // Worst projected point (ajustado com opening balance)
  const worst_projected_point = worst_point
    ? {
        min_projected_balance: worst_point.min_cum_balance,
        min_projected_month: worst_point.min_cum_month,
      }
    : undefined

  // Cash today (posição atual)
  const cash_today = {
    starting_balance: cashPosition.totals.grand_total,
    as_of_date: cashPosition.as_of,
    checking_total: cashPosition.totals.checking_total,
    investment_total: cashPosition.totals.investment_total,
  }

  // Trend: próximos 3 meses (se houver)
  const currentMonthIndex = months.findIndex(m => m.month_start === currentMonthStart)
  const next3Months = currentMonthIndex >= 0
    ? months.slice(currentMonthIndex + 1, currentMonthIndex + 4)
    : months.slice(0, 3)
  
  const trend = {
    next_3_months_planned_net: next3Months.map(m => m.planned_net),
  }

  return {
    hasData: true,
    current_month: {
      planned_net: currentMonth.planned_net,
      realised_net: currentMonth.realised_net,
      planned_cum: currentMonth.planned_cum,
      realised_cum: currentMonth.realised_cum,
      planned_cum_adj: currentMonth.planned_cum_adj,
      realised_cum_adj: currentMonth.realised_cum_adj,
    },
    month_totals,
    deltas,
    worst_point,
    worst_projected_point,
    cash_today,
    trend,
  }
}

