/**
 * MC3.1: Normalização de dados de transações externas
 * Remove ruído comum e padroniza descrições para matching
 */

/**
 * Normaliza descrição de transação removendo ruído comum
 * Mantém rastreabilidade mas padroniza para matching
 */
export function normalizeDescription(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return ''
  }

  let normalized = raw.trim()

  // Converter para maiúsculas
  normalized = normalized.toUpperCase()

  // Remover espaços múltiplos
  normalized = normalized.replace(/\s+/g, ' ')

  // Tokens comuns de ruído (remover prefixos/sufixos comuns)
  const noisePatterns = [
    /^COMPRA\s+CARTAO\s+/i,
    /^DEB\s+AUT\s+/i,
    /^DEBITO\s+AUTOMATICO\s+/i,
    /^PAG\s+RECORRENTE\s+/i,
    /^TED\s+/i,
    /^DOC\s+/i,
    /^PIX\s+/i,
    /\s+DEBITO\s*$/i,
    /\s+CREDITO\s*$/i,
    /\s+PAGAMENTO\s*$/i,
    /\s+RECEBIMENTO\s*$/i,
  ]

  for (const pattern of noisePatterns) {
    normalized = normalized.replace(pattern, ' ').trim()
  }

  // Remover caracteres especiais repetidos
  normalized = normalized.replace(/[^\w\s]+/g, ' ')

  // Remover espaços múltiplos novamente
  normalized = normalized.replace(/\s+/g, ' ').trim()

  return normalized
}

/**
 * Extrai tokens significativos de uma descrição para matching
 */
export function extractTokens(description: string): string[] {
  const normalized = normalizeDescription(description)
  const tokens = normalized.split(/\s+/).filter(token => token.length >= 3)
  return tokens
}

/**
 * Calcula similaridade simples entre duas descrições normalizadas
 * Retorna valor entre 0 e 1
 */
export function calculateSimilarity(desc1: string, desc2: string): number {
  const tokens1 = new Set(extractTokens(desc1))
  const tokens2 = new Set(extractTokens(desc2))

  if (tokens1.size === 0 && tokens2.size === 0) {
    return 1.0
  }

  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0.0
  }

  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)))
  const union = new Set([...tokens1, ...tokens2])

  return intersection.size / union.size
}

