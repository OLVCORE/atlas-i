/**
 * Utilitários para validação de CPF
 */

/**
 * Normaliza CPF removendo caracteres não numéricos
 */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "")
}

/**
 * Valida se CPF tem 11 dígitos
 */
export function validateCpfLength(cpf: string): boolean {
  const normalized = normalizeCpf(cpf)
  return normalized.length === 11
}

/**
 * Valida dígitos verificadores do CPF
 */
export function validateCpfChecksum(cpf: string): boolean {
  const normalized = normalizeCpf(cpf)

  if (normalized.length !== 11) {
    return false
  }

  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(normalized)) {
    return false
  }

  // Calcular primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(normalized.charAt(i)) * (10 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(normalized.charAt(9))) {
    return false
  }

  // Calcular segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(normalized.charAt(i)) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(normalized.charAt(10))) {
    return false
  }

  return true
}

/**
 * Valida CPF (comprimento + dígitos verificadores)
 */
export function validateCpf(cpf: string): { valid: boolean; error?: string } {
  if (!cpf || cpf.trim().length === 0) {
    return { valid: false, error: "CPF é obrigatório" }
  }

  if (!validateCpfLength(cpf)) {
    return { valid: false, error: "CPF deve ter 11 dígitos" }
  }

  if (!validateCpfChecksum(cpf)) {
    return { valid: false, error: "CPF inválido" }
  }

  return { valid: true }
}

