/**
 * MC4.2: Utilitários para cálculos financeiros precisos
 * Precisão absoluta com centavos
 */

/**
 * Arredonda valor para 2 casas decimais (centavos)
 */
export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Converte valor para centavos (inteiro)
 */
export function toCents(value: number): number {
  return Math.round(value * 100)
}

/**
 * Converte centavos para reais
 */
export function fromCents(cents: number): number {
  return cents / 100
}

/**
 * Divide um valor total em N partes, distribuindo centavos de forma justa
 * Similar a generateInstallments do MC3, mas reutilizável
 * 
 * @param total Valor total em reais
 * @param parts Número de partes
 * @returns Array de valores que somam exatamente o total
 */
export function divideAmount(total: number, parts: number): number[] {
  if (parts < 1) {
    throw new Error("Número de partes deve ser >= 1")
  }
  
  if (total <= 0) {
    throw new Error("Valor total deve ser > 0")
  }
  
  // Converter para centavos
  const totalCents = toCents(total)
  
  // Valor base de cada parte em centavos
  const baseCents = Math.floor(totalCents / parts)
  
  // Resto a distribuir
  const remainder = totalCents - (baseCents * parts)
  
  // Gerar partes
  const result: number[] = []
  
  for (let i = 0; i < parts; i++) {
    let partCents = baseCents
    // As primeiras 'remainder' partes recebem +1 centavo
    if (i < remainder) {
      partCents += 1
    }
    
    // Converter de volta para reais
    result.push(fromCents(partCents))
  }
  
  // Validação: garantir que a soma é exata
  const sumCents = toCents(result.reduce((acc, val) => acc + val, 0))
  
  if (sumCents !== totalCents) {
    throw new Error(`Erro na distribuição: soma=${sumCents}, total=${totalCents}`)
  }
  
  return result
}

/**
 * Valida se dois valores monetários são iguais (dentro de tolerância de 1 centavo)
 */
export function amountsMatch(amount1: number, amount2: number, toleranceCents: number = 1): boolean {
  const diffCents = Math.abs(toCents(amount1) - toCents(amount2))
  return diffCents <= toleranceCents
}

/**
 * Soma um array de valores monetários com precisão
 */
export function sumAmounts(amounts: number[]): number {
  const totalCents = amounts.reduce((sum, amount) => sum + toCents(amount), 0)
  return fromCents(totalCents)
}

