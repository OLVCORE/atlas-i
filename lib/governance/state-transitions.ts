/**
 * MC5: Validações de Estados e Transições
 * 
 * Centraliza regras de governança para estados e transições válidas
 */

export type CommitmentStatus = 'planned' | 'active' | 'completed' | 'cancelled'
export type ScheduleStatus = 'planned' | 'realized' | 'cancelled'
export type ContractStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type TransactionStatus = 'posted' | 'reversed'

/**
 * Valida se uma transição de estado de commitment é permitida
 */
export function validateCommitmentTransition(
  currentStatus: CommitmentStatus,
  newStatus: CommitmentStatus,
  hasRealizedSchedules: boolean = false
): void {
  // Não pode mudar de cancelled
  if (currentStatus === 'cancelled') {
    throw new Error("Não é possível alterar um compromisso cancelado")
  }

  // Não pode mudar de completed
  if (currentStatus === 'completed') {
    throw new Error("Não é possível alterar um compromisso concluído")
  }

  // Não pode cancelar se já tiver schedules realizados
  if (newStatus === 'cancelled' && hasRealizedSchedules) {
    throw new Error("Não é possível cancelar compromisso com schedules já realizados")
  }
}

/**
 * Valida se uma transição de estado de schedule é permitida
 */
export function validateScheduleTransition(
  currentStatus: ScheduleStatus,
  newStatus: ScheduleStatus
): void {
  // Não pode mudar de cancelled
  if (currentStatus === 'cancelled') {
    throw new Error("Não é possível alterar um schedule cancelado")
  }

  // Não pode voltar de realized para planned
  if (currentStatus === 'realized' && newStatus === 'planned') {
    throw new Error("Não é possível reverter schedule já realizado. Use desvincular transaction para remover o vínculo.")
  }
}

/**
 * Valida se uma transição de estado de contract é permitida
 */
export function validateContractTransition(
  currentStatus: ContractStatus,
  newStatus: ContractStatus,
  hasRealizedSchedules: boolean = false
): void {
  // Não pode mudar de cancelled
  if (currentStatus === 'cancelled') {
    throw new Error("Não é possível alterar um contrato cancelado")
  }

  // Não pode mudar de completed
  if (currentStatus === 'completed') {
    throw new Error("Não é possível alterar um contrato concluído")
  }

  // Não pode cancelar se já tiver schedules realizados
  if (newStatus === 'cancelled' && hasRealizedSchedules) {
    throw new Error("Não é possível cancelar contrato com schedules já realizados")
  }
}

/**
 * Valida se pode editar um item baseado em seu estado
 */
export function canEditCommitment(status: CommitmentStatus): boolean {
  return status === 'planned' || status === 'active'
}

export function canEditSchedule(status: ScheduleStatus): boolean {
  return status === 'planned'
}

export function canEditContract(status: ContractStatus): boolean {
  return status === 'draft' || status === 'active'
}

/**
 * Valida se pode cancelar um item baseado em seu estado
 */
export function canCancelCommitment(status: CommitmentStatus, hasRealizedSchedules: boolean): boolean {
  if (status === 'cancelled' || status === 'completed') {
    return false
  }
  return !hasRealizedSchedules
}

export function canCancelSchedule(status: ScheduleStatus): boolean {
  return status === 'planned'
}

export function canCancelContract(status: ContractStatus, hasRealizedSchedules: boolean): boolean {
  if (status === 'cancelled' || status === 'completed') {
    return false
  }
  return !hasRealizedSchedules
}

