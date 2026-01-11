/**
 * Detector de transações duplicadas
 * 
 * Compara transações normalizadas com transações existentes
 * usando múltiplos critérios de matching
 */

import type { 
  NormalizedTransaction, 
  DuplicateDetectionResult,
  ImportConfig
} from '../types'

/**
 * Detectar duplicatas em transações normalizadas
 */
export async function detectDuplicates(
  normalizedTransactions: NormalizedTransaction[],
  accountId: string,
  config: ImportConfig,
  existingTransactions: any[] = [] // Transações existentes da conta (buscar externamente)
): Promise<DuplicateDetectionResult[]> {
  // existingTransactions são passadas como parâmetro para evitar dependência circular
  
  return normalizedTransactions.map(transaction => {
    const matches = existingTransactions.filter(existing => 
      isDuplicate(transaction, existing, config)
    )
    
    return {
      transaction,
      isDuplicate: matches.length > 0,
      duplicateIds: matches.map(m => m.id),
      confidence: matches.length > 0 ? calculateConfidence(transaction, matches[0]) : 0,
      reason: matches.length > 0 ? getDuplicateReason(transaction, matches[0]) : undefined
    }
  })
}

/**
 * Verificar se duas transações são duplicatas
 */
function isDuplicate(
  normalized: NormalizedTransaction,
  existing: any, // Transaction do banco
  config: ImportConfig
): boolean {
  // 1. Verificar diferença de data (tolerância configurável)
  const dateDiff = Math.abs(
    (new Date(normalized.date).getTime() - new Date(existing.date).getTime()) / 
    (1000 * 60 * 60 * 24)
  )
  
  if (dateDiff > config.duplicateToleranceDays) {
    return false
  }
  
  // 2. Verificar diferença de valor (tolerância configurável)
  const amountDiff = Math.abs(Math.abs(normalized.amount) - Math.abs(existing.amount))
  if (amountDiff > config.duplicateToleranceAmount) {
    return false
  }
  
  // 3. Verificar similaridade da descrição
  const descriptionSimilarity = calculateSimilarity(
    normalized.description.toLowerCase(),
    existing.description.toLowerCase()
  )
  
  // Similaridade mínima de 70%
  if (descriptionSimilarity < 0.7) {
    return false
  }
  
  return true
}

/**
 * Calcular similaridade entre duas strings (Jaccard similarity simplificado)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  
  // Tokenizar (palavras)
  const tokens1 = new Set(str1.split(/\s+/).filter(t => t.length > 2))
  const tokens2 = new Set(str2.split(/\s+/).filter(t => t.length > 2))
  
  if (tokens1.size === 0 && tokens2.size === 0) return 1.0
  if (tokens1.size === 0 || tokens2.size === 0) return 0.0
  
  // Interseção
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)))
  
  // União
  const union = new Set([...tokens1, ...tokens2])
  
  // Similaridade Jaccard
  return intersection.size / union.size
}

/**
 * Calcular confiança na detecção de duplicata
 */
function calculateConfidence(
  normalized: NormalizedTransaction,
  existing: any
): number {
  let confidence = 0.5 // Base
  
  // Mesma data = +0.3
  if (normalized.date === existing.date.split('T')[0]) {
    confidence += 0.3
  }
  
  // Valor exato = +0.2
  if (Math.abs(Math.abs(normalized.amount) - Math.abs(existing.amount)) < 0.01) {
    confidence += 0.2
  }
  
  // Descrição muito similar = +0.2
  const similarity = calculateSimilarity(normalized.description, existing.description)
  confidence += similarity * 0.2
  
  return Math.min(confidence, 1.0)
}

/**
 * Obter razão da detecção de duplicata
 */
function getDuplicateReason(
  normalized: NormalizedTransaction,
  existing: any
): string {
  const reasons: string[] = []
  
  if (normalized.date === existing.date.split('T')[0]) {
    reasons.push('mesma data')
  }
  
  if (Math.abs(Math.abs(normalized.amount) - Math.abs(existing.amount)) < 0.01) {
    reasons.push('mesmo valor')
  }
  
  const similarity = calculateSimilarity(normalized.description, existing.description)
  if (similarity > 0.8) {
    reasons.push('descrição similar')
  }
  
  return reasons.join(', ')
}
