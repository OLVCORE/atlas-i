/**
 * Normaliza CNPJ removendo caracteres não numéricos
 */
export function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "")
}

/**
 * Valida se CNPJ tem 14 dígitos
 */
export function validateCnpjLength(cnpj: string): boolean {
  const normalized = normalizeCnpj(cnpj)
  return normalized.length === 14
}

/**
 * Valida dígitos verificadores do CNPJ
 */
export function validateCnpjChecksum(cnpj: string): boolean {
  const normalized = normalizeCnpj(cnpj)

  if (normalized.length !== 14) {
    return false
  }

  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(normalized)) {
    return false
  }

  // Calcular primeiro dígito verificador
  let length = normalized.length - 2
  let numbers = normalized.substring(0, length)
  const digits = normalized.substring(length)
  let sum = 0
  let pos = length - 7

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0))) {
    return false
  }

  // Calcular segundo dígito verificador
  length = length + 1
  numbers = normalized.substring(0, length)
  sum = 0
  pos = length - 7

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1))) {
    return false
  }

  return true
}

/**
 * Valida CNPJ (comprimento + dígitos verificadores)
 */
export function validateCnpj(cnpj: string): { valid: boolean; error?: string } {
  if (!cnpj || cnpj.trim().length === 0) {
    return { valid: false, error: "CNPJ é obrigatório" }
  }

  if (!validateCnpjLength(cnpj)) {
    return { valid: false, error: "CNPJ deve ter 14 dígitos" }
  }

  if (!validateCnpjChecksum(cnpj)) {
    return { valid: false, error: "CNPJ inválido" }
  }

  return { valid: true }
}

