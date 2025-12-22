/**
 * MC4.2: Validações de domínio financeiro
 */

/**
 * Valida se um valor monetário é válido (positivo)
 */
export function validateAmount(amount: number): void {
  if (amount <= 0) {
    throw new Error("Valor deve ser maior que zero")
  }
  
  if (!isFinite(amount)) {
    throw new Error("Valor inválido (não é um número finito)")
  }
}

/**
 * Valida se uma data é válida
 */
export function validateDate(date: Date | string): void {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) {
    throw new Error("Data inválida")
  }
}

/**
 * Valida se um range de datas é válido
 */
export function validateDateRange(startDate: Date | string, endDate: Date | string | null): void {
  validateDate(startDate)
  
  if (endDate) {
    validateDate(endDate)
    
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate
    
    if (end < start) {
      throw new Error("Data final deve ser posterior à data inicial")
    }
  }
}

/**
 * Valida status de commitment
 */
export function validateCommitmentStatus(status: string): void {
  const validStatuses = ['planned', 'active', 'completed', 'cancelled']
  if (!validStatuses.includes(status)) {
    throw new Error(`Status inválido: ${status}. Deve ser um de: ${validStatuses.join(', ')}`)
  }
}

/**
 * Valida status de schedule
 */
export function validateScheduleStatus(status: string): void {
  const validStatuses = ['planned', 'realized', 'cancelled']
  if (!validStatuses.includes(status)) {
    throw new Error(`Status inválido: ${status}. Deve ser um de: ${validStatuses.join(', ')}`)
  }
}

/**
 * Valida tipo de commitment
 */
export function validateCommitmentType(type: string): void {
  const validTypes = ['expense', 'revenue']
  if (!validTypes.includes(type)) {
    throw new Error(`Tipo inválido: ${type}. Deve ser 'expense' ou 'revenue'`)
  }
}

/**
 * Valida tipo de recorrência
 */
export function validateRecurrence(recurrence: string): void {
  const validRecurrences = ['none', 'monthly', 'quarterly', 'yearly', 'custom']
  if (!validRecurrences.includes(recurrence)) {
    throw new Error(`Recorrência inválida: ${recurrence}. Deve ser um de: ${validRecurrences.join(', ')}`)
  }
}

/**
 * Valida se uma string não está vazia
 */
export function validateNotEmpty(value: string, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} não pode estar vazio`)
  }
}

