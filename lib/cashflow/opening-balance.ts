/**
 * MC7.1: Opening Balance para projeções de cashflow
 * 
 * Calcula saldo consolidado em uma data de referência (geralmente início do período)
 */

import { getCashPositionSummary } from "@/lib/accounts/balances"
import { formatDateISO, parseDateISO } from "@/lib/utils/dates"

export type OpeningBalanceResult = {
  opening_balance: number
  opening_date: string // ISO date
}

/**
 * Calcula opening balance consolidado até o início do mês do período
 * 
 * @param entityId Opcional: filtrar por entidade
 * @param asOfMonthStart Data do primeiro dia do mês (YYYY-MM-01)
 */
export async function getOpeningBalance(
  entityId: string | undefined,
  asOfMonthStart: string // YYYY-MM-01
): Promise<OpeningBalanceResult> {
  // Validar formato
  const monthRegex = /^\d{4}-\d{2}-01$/
  if (!monthRegex.test(asOfMonthStart)) {
    throw new Error(`Data inválida. Formato esperado: YYYY-MM-01. Recebido: ${asOfMonthStart}`)
  }

  // Calcular data anterior ao início do mês (último dia do mês anterior)
  const monthDate = parseDateISO(asOfMonthStart)
  if (!monthDate) {
    throw new Error(`Data inválida: ${asOfMonthStart}`)
  }

  // Subtrair 1 dia para obter o último dia do mês anterior
  const previousDay = new Date(monthDate)
  previousDay.setDate(previousDay.getDate() - 1)

  // Buscar cash position até o dia anterior
  const cashPosition = await getCashPositionSummary(entityId, previousDay)

  return {
    opening_balance: cashPosition.totals.grand_total,
    opening_date: previousDay.toISOString().split('T')[0],
  }
}

