/**
 * MC4.2: Análise de Forecast (Previsão Financeira)
 * 
 * Responsável por fornecer visão futura sem tocar no caixa
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { formatDateISO, parseDateISO } from "@/lib/utils/dates"
import { sumAmounts } from "@/lib/utils/money"

export type ForecastByMonth = {
  month: string // YYYY-MM
  expenses: number
  revenues: number
  net: number
}

export type ForecastByCategory = {
  category: string | null
  type: 'expense' | 'revenue'
  total: number
  scheduleCount: number
}

export type ForecastVsReal = {
  month: string // YYYY-MM
  plannedExpenses: number
  realizedExpenses: number
  plannedRevenues: number
  realizedRevenues: number
  expensesGap: number
  revenuesGap: number
}

/**
 * Obtém forecast por mês dentro de um range
 */
export async function getForecastByMonth(
  startDate: string | Date,
  endDate: string | Date
): Promise<ForecastByMonth[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const start = typeof startDate === 'string' ? startDate : formatDateISO(startDate)
  const end = typeof endDate === 'string' ? endDate : formatDateISO(endDate)
  
  // Buscar schedules planned/realized no período, agrupados por mês
  const { data: schedules, error } = await supabase
    .from("financial_schedules")
    .select(`
      due_date,
      amount,
      status,
      financial_commitments!inner (
        type
      )
    `)
    .eq("workspace_id", workspace.id)
    .gte("due_date", start)
    .lte("due_date", end)
    .in("status", ['planned', 'realized'])
    .order("due_date", { ascending: true })
  
  if (error) {
    throw new Error(`Erro ao buscar forecast: ${error.message}`)
  }
  
  // Agrupar por mês (YYYY-MM)
  const monthMap = new Map<string, { expenses: number[]; revenues: number[] }>()
  
  for (const schedule of schedules || []) {
    const scheduleDate = parseDateISO(schedule.due_date as string)
    const monthKey = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}`
    
    const commitment = (schedule as any).financial_commitments
    const type = commitment?.type
    
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { expenses: [], revenues: [] })
    }
    
    const monthData = monthMap.get(monthKey)!
    const amount = Number(schedule.amount)
    
    if (type === 'expense') {
      monthData.expenses.push(amount)
    } else if (type === 'revenue') {
      monthData.revenues.push(amount)
    }
  }
  
  // Converter para array e calcular totais
  const forecast: ForecastByMonth[] = []
  
  for (const [month, data] of monthMap.entries()) {
    forecast.push({
      month,
      expenses: sumAmounts(data.expenses),
      revenues: sumAmounts(data.revenues),
      net: sumAmounts(data.revenues) - sumAmounts(data.expenses),
    })
  }
  
  // Ordenar por mês
  forecast.sort((a, b) => a.month.localeCompare(b.month))
  
  return forecast
}

/**
 * Obtém forecast agrupado por categoria
 */
export async function getForecastByCategory(): Promise<ForecastByCategory[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar schedules planned/realized, agrupados por categoria e tipo
  const { data: schedules, error } = await supabase
    .from("financial_schedules")
    .select(`
      amount,
      status,
      financial_commitments!inner (
        type,
        category
      )
    `)
    .eq("workspace_id", workspace.id)
    .in("status", ['planned', 'realized'])
  
  if (error) {
    throw new Error(`Erro ao buscar forecast por categoria: ${error.message}`)
  }
  
  // Agrupar por categoria e tipo
  const categoryMap = new Map<string, { type: 'expense' | 'revenue'; amounts: number[] }>()
  
  for (const schedule of schedules || []) {
    const commitment = (schedule as any).financial_commitments
    const category = commitment?.category || null
    const type = commitment?.type
    const amount = Number(schedule.amount)
    
    const key = `${category || '__SEM_CATEGORIA__'}_${type}`
    
    if (!categoryMap.has(key)) {
      categoryMap.set(key, { type: type as 'expense' | 'revenue', amounts: [] })
    }
    
    categoryMap.get(key)!.amounts.push(amount)
  }
  
  // Converter para array
  const forecast: ForecastByCategory[] = []
  
  for (const [key, data] of categoryMap.entries()) {
    const [categoryStr] = key.split('_')
    const category = categoryStr === '__SEM_CATEGORIA__' ? null : categoryStr
    
    forecast.push({
      category,
      type: data.type,
      total: sumAmounts(data.amounts),
      scheduleCount: data.amounts.length,
    })
  }
  
  // Ordenar por total descendente
  forecast.sort((a, b) => b.total - a.total)
  
  return forecast
}

/**
 * Compara forecast (planned) vs realizado (realized)
 */
export async function getForecastVsReal(
  startDate: string | Date,
  endDate: string | Date
): Promise<ForecastVsReal[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const start = typeof startDate === 'string' ? startDate : formatDateISO(startDate)
  const end = typeof endDate === 'string' ? endDate : formatDateISO(endDate)
  
  // Buscar schedules no período
  const { data: schedules, error } = await supabase
    .from("financial_schedules")
    .select(`
      due_date,
      amount,
      status,
      financial_commitments!inner (
        type
      )
    `)
    .eq("workspace_id", workspace.id)
    .gte("due_date", start)
    .lte("due_date", end)
    .in("status", ['planned', 'realized'])
    .order("due_date", { ascending: true })
  
  if (error) {
    throw new Error(`Erro ao buscar forecast vs real: ${error.message}`)
  }
  
  // Agrupar por mês e status
  const monthMap = new Map<string, {
    plannedExpenses: number[]
    realizedExpenses: number[]
    plannedRevenues: number[]
    realizedRevenues: number[]
  }>()
  
  for (const schedule of schedules || []) {
    const scheduleDate = parseDateISO(schedule.due_date as string)
    const monthKey = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}`
    
    const commitment = (schedule as any).financial_commitments
    const type = commitment?.type
    const status = schedule.status
    const amount = Number(schedule.amount)
    
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        plannedExpenses: [],
        realizedExpenses: [],
        plannedRevenues: [],
        realizedRevenues: [],
      })
    }
    
    const monthData = monthMap.get(monthKey)!
    
    if (type === 'expense') {
      if (status === 'planned') {
        monthData.plannedExpenses.push(amount)
      } else if (status === 'realized') {
        monthData.realizedExpenses.push(amount)
      }
    } else if (type === 'revenue') {
      if (status === 'planned') {
        monthData.plannedRevenues.push(amount)
      } else if (status === 'realized') {
        monthData.realizedRevenues.push(amount)
      }
    }
  }
  
  // Converter para array
  const forecastVsReal: ForecastVsReal[] = []
  
  for (const [month, data] of monthMap.entries()) {
    const plannedExpenses = sumAmounts(data.plannedExpenses)
    const realizedExpenses = sumAmounts(data.realizedExpenses)
    const plannedRevenues = sumAmounts(data.plannedRevenues)
    const realizedRevenues = sumAmounts(data.realizedRevenues)
    
    forecastVsReal.push({
      month,
      plannedExpenses,
      realizedExpenses,
      plannedRevenues,
      realizedRevenues,
      expensesGap: realizedExpenses - plannedExpenses,
      revenuesGap: realizedRevenues - plannedRevenues,
    })
  }
  
  // Ordenar por mês
  forecastVsReal.sort((a, b) => a.month.localeCompare(b.month))
  
  return forecastVsReal
}

