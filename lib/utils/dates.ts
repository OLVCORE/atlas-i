/**
 * MC4.2: Utilitários para manipulação de datas e recorrências
 */

export type RecurrenceType = 'none' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

/**
 * Adiciona n meses a uma data
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * Adiciona n trimestres (3 meses) a uma data
 */
export function addQuarters(date: Date, quarters: number): Date {
  return addMonths(date, quarters * 3)
}

/**
 * Adiciona n anos a uma data
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() + years)
  return result
}

/**
 * Retorna o primeiro dia do mês de uma data
 */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Retorna o último dia do mês de uma data
 */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/**
 * Retorna o mesmo dia do próximo mês (ou último dia do mês se não existir)
 */
export function sameDayNextMonth(date: Date): Date {
  const nextMonth = new Date(date)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  
  // Se o dia não existe no próximo mês (ex: 31/jan -> 31/fev), usar último dia
  if (nextMonth.getDate() !== date.getDate()) {
    return endOfMonth(nextMonth)
  }
  
  return nextMonth
}

/**
 * Gera datas recorrentes baseado no tipo de recorrência
 * 
 * @param startDate Data inicial
 * @param endDate Data final (opcional, se não fornecido, gera apenas uma data)
 * @param recurrence Tipo de recorrência
 * @returns Array de datas
 */
export function generateRecurrenceDates(
  startDate: Date,
  endDate: Date | null,
  recurrence: RecurrenceType
): Date[] {
  if (recurrence === 'none') {
    return [startDate]
  }
  
  if (!endDate) {
    return [startDate]
  }
  
  const dates: Date[] = []
  let currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate))
    
    switch (recurrence) {
      case 'monthly':
        currentDate = sameDayNextMonth(currentDate)
        break
      case 'quarterly':
        currentDate = addMonths(currentDate, 3)
        break
      case 'yearly':
        currentDate = addYears(currentDate, 1)
        break
      default:
        // Para 'custom', não gera automaticamente - deve ser gerado manualmente
        return dates
    }
  }
  
  return dates
}

/**
 * Calcula o número de períodos entre duas datas baseado na recorrência
 */
export function countPeriods(startDate: Date, endDate: Date, recurrence: RecurrenceType): number {
  if (recurrence === 'none') {
    return 1
  }
  
  if (endDate < startDate) {
    return 0
  }
  
  const dates = generateRecurrenceDates(startDate, endDate, recurrence)
  return dates.length
}

/**
 * Valida se uma data está dentro de um range
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date | null): boolean {
  if (date < startDate) {
    return false
  }
  
  if (endDate && date > endDate) {
    return false
  }
  
  return true
}

/**
 * Formata data para formato ISO (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Parse de data ISO (YYYY-MM-DD) para Date
 */
export function parseDateISO(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

