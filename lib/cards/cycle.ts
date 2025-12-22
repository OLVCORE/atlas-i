/**
 * MC3: Funções determinísticas para cálculo de ciclo de cartão de crédito
 * 
 * - resolveStatementMonth: Determina o mês de competência baseado na data de compra e closing_day
 * - addMonths: Adiciona meses a uma data (mantendo o primeiro dia do mês)
 * - generateInstallments: Divide valor total em parcelas com distribuição de centavos
 */

/**
 * Resolve o mês de competência (statement month) baseado na data de compra e o dia de corte
 * 
 * Regra:
 * - Se day(purchaseDate) <= closingDay => competência do mês do purchaseDate
 * - Se day(purchaseDate) > closingDay => competência do mês seguinte
 * 
 * Retorna: Date com o primeiro dia do mês de competência
 */
export function resolveStatementMonth(purchaseDate: Date, closingDay: number): Date {
  const day = purchaseDate.getDate()
  
  let year = purchaseDate.getFullYear()
  let month = purchaseDate.getMonth()
  
  if (day > closingDay) {
    // Mês seguinte
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }
  
  // Retornar primeiro dia do mês de competência
  return new Date(year, month, 1)
}

/**
 * Adiciona n meses a uma data (mantendo o primeiro dia do mês)
 * 
 * @param monthDate Data base (deve ser primeiro dia do mês)
 * @param n Número de meses a adicionar (pode ser negativo)
 * @returns Date com o primeiro dia do mês resultante
 */
export function addMonths(monthDate: Date, n: number): Date {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  
  const newMonth = month + n
  const newYear = year + Math.floor(newMonth / 12)
  const normalizedMonth = ((newMonth % 12) + 12) % 12
  
  return new Date(newYear, normalizedMonth, 1)
}

/**
 * Divide um valor total em N parcelas, distribuindo centavos de forma justa
 * 
 * Regra:
 * - calcular base = floor(total*100 / installments) em centavos
 * - remainder = total_cents - base*installments
 * - parcelas 1..remainder recebem +1 centavo
 * 
 * @param total Valor total (em reais, ex: 1000.50)
 * @param installments Número de parcelas
 * @returns Array de valores (em reais) que somam exatamente o total
 */
export function generateInstallments(total: number, installments: number): number[] {
  if (installments < 1) {
    throw new Error("Número de parcelas deve ser >= 1")
  }
  
  if (total <= 0) {
    throw new Error("Valor total deve ser > 0")
  }
  
  // Converter para centavos para evitar problemas de ponto flutuante
  const totalCents = Math.round(total * 100)
  
  // Valor base de cada parcela em centavos
  const baseCents = Math.floor(totalCents / installments)
  
  // Resto a distribuir
  const remainder = totalCents - (baseCents * installments)
  
  // Gerar parcelas
  const result: number[] = []
  
  for (let i = 0; i < installments; i++) {
    let parcelCents = baseCents
    // As primeiras 'remainder' parcelas recebem +1 centavo
    if (i < remainder) {
      parcelCents += 1
    }
    
    // Converter de volta para reais
    result.push(parcelCents / 100)
  }
  
  // Validação: garantir que a soma é exata
  const sum = result.reduce((acc, val) => acc + val, 0)
  const sumCents = Math.round(sum * 100)
  
  if (sumCents !== totalCents) {
    throw new Error(`Erro na distribuição de parcelas: soma=${sumCents}, total=${totalCents}`)
  }
  
  return result
}

