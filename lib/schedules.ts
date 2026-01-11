/**
 * MC4.2: Gerenciamento de Cronogramas Financeiros (Schedules)
 * 
 * Responsável por gerar e gerenciar os cronogramas de compromissos
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { divideAmount, sumAmounts, amountsMatch } from "@/lib/utils/money"
import { generateRecurrenceDates, parseDateISO, formatDateISO } from "@/lib/utils/dates"
import { validateScheduleStatus } from "@/lib/utils/validation"
import { validateScheduleTransition, canCancelSchedule } from "./governance/state-transitions"
import type { Commitment } from "./commitments"

export type FinancialSchedule = {
  id: string
  commitment_id: string
  workspace_id: string
  due_date: string
  amount: number
  status: 'planned' | 'realized' | 'cancelled'
  linked_transaction_id: string | null
  created_at: string
}

/**
 * Gera schedules para um compromisso
 * 
 * REGRAS CRÍTICAS:
 * - Soma dos schedules = total_amount (exato, centavos tratados)
 * - Datas respeitam start_date, end_date e recurrence
 * - Nunca cria schedules duplicados
 */
export async function generateSchedules(commitmentId: string): Promise<FinancialSchedule[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar compromisso
  const { data: commitment, error: commitmentError } = await supabase
    .from("financial_commitments")
    .select("*")
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (commitmentError || !commitment) {
    throw new Error("Compromisso não encontrado")
  }
  
  // Verificar se já existem schedules
  const { data: existingSchedules, error: existingError } = await supabase
    .from("financial_schedules")
    .select("id")
    .eq("commitment_id", commitmentId)
    .limit(1)
  
  if (existingError) {
    throw new Error(`Erro ao verificar schedules existentes: ${existingError.message}`)
  }
  
  if (existingSchedules && existingSchedules.length > 0) {
    throw new Error("Schedules já existem para este compromisso. Use recalculateSchedules para regenerar.")
  }
  
  // Gerar datas baseado na recorrência
  const startDate = parseDateISO(commitment.start_date)
  const endDate = commitment.end_date ? parseDateISO(commitment.end_date) : null
  
  let dates: Date[]
  
  if (commitment.recurrence === 'none') {
    // Sem recorrência: apenas uma data (start_date)
    dates = [startDate]
  } else if (!endDate) {
    // Recorrência sem end_date: apenas start_date
    dates = [startDate]
  } else {
    // Gerar datas recorrentes
    dates = generateRecurrenceDates(startDate, endDate, commitment.recurrence)
  }
  
  if (dates.length === 0) {
    throw new Error("Nenhuma data gerada para os schedules")
  }
  
  // Dividir o valor total entre as datas
  const amounts = divideAmount(Number(commitment.total_amount), dates.length)
  
  // Validar que a soma é exata
  const totalScheduleAmount = sumAmounts(amounts)
  if (!amountsMatch(totalScheduleAmount, Number(commitment.total_amount))) {
    throw new Error(`Erro na distribuição de valores: esperado ${commitment.total_amount}, calculado ${totalScheduleAmount}`)
  }
  
  // Criar schedules
  const schedulesToInsert = dates.map((date, index) => ({
    commitment_id: commitmentId,
    workspace_id: workspace.id,
    due_date: formatDateISO(date),
    amount: amounts[index],
    status: 'planned' as const,
    linked_transaction_id: null,
  }))
  
  const { data: schedules, error: insertError } = await supabase
    .from("financial_schedules")
    .insert(schedulesToInsert)
    .select()
  
  if (insertError) {
    throw new Error(`Erro ao criar schedules: ${insertError.message}`)
  }
  
  return schedules || []
}

/**
 * Recalcula schedules de um compromisso
 * 
 * REGRAS:
 * - Cancela schedules não realizados
 * - Regenera baseado nos parâmetros atuais do compromisso
 */
export async function recalculateSchedules(commitmentId: string): Promise<FinancialSchedule[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar compromisso
  const { data: commitment, error: commitmentError } = await supabase
    .from("financial_commitments")
    .select("*")
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (commitmentError || !commitment) {
    throw new Error("Compromisso não encontrado")
  }
  
  // Cancelar schedules não realizados
  await supabase
    .from("financial_schedules")
    .update({ status: 'cancelled' })
    .eq("commitment_id", commitmentId)
    .eq("status", 'planned')
  
  // Gerar novos schedules
  return await generateSchedules(commitmentId)
}

/**
 * Cancela um schedule específico
 */
export async function cancelSchedule(scheduleId: string): Promise<FinancialSchedule> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar schedule
  const { data: schedule, error: fetchError } = await supabase
    .from("financial_schedules")
    .select("*")
    .eq("id", scheduleId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (fetchError || !schedule) {
    throw new Error("Schedule não encontrado")
  }
  
  if (!canCancelSchedule(schedule.status)) {
    if (schedule.status === 'cancelled') {
      return schedule
    }
    throw new Error("Não é possível cancelar um schedule já realizado")
  }
  
  // Atualizar status
  const { data: cancelled, error } = await supabase
    .from("financial_schedules")
    .update({ status: 'cancelled' })
    .eq("id", scheduleId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao cancelar schedule: ${error.message}`)
  }
  
  return cancelled
}

/**
 * Marca um schedule como planned (reverte canceled para planned)
 */
export async function markScheduleAsPlanned(scheduleId: string): Promise<FinancialSchedule> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar schedule
  const { data: schedule, error: fetchError } = await supabase
    .from("financial_schedules")
    .select("*")
    .eq("id", scheduleId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (fetchError || !schedule) {
    throw new Error("Schedule não encontrado")
  }
  
  if (schedule.status === 'planned') {
    return schedule
  }
  
  if (schedule.status === 'realized') {
    throw new Error("Não é possível reverter um schedule já realizado")
  }
  
  // Atualizar status
  const { data: updated, error } = await supabase
    .from("financial_schedules")
    .update({ status: 'planned' })
    .eq("id", scheduleId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao marcar schedule como planned: ${error.message}`)
  }
  
  return updated
}

/**
 * Marca um schedule como realizado
 * 
 * REGRAS:
 * - linked_transaction_id só pode ser 1:1 (uma transaction por schedule)
 * - Valida que a transaction existe e pertence ao workspace
 */
export async function markScheduleAsRealized(
  scheduleId: string,
  transactionId: string
): Promise<FinancialSchedule> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from("financial_schedules")
    .select("*")
    .eq("id", scheduleId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (scheduleError || !schedule) {
    throw new Error("Schedule não encontrado")
  }
  
  if (schedule.status === 'realized') {
    // Já está realizado, verificar se é a mesma transaction
    if (schedule.linked_transaction_id === transactionId) {
      return schedule
    }
    throw new Error("Schedule já está vinculado a outra transação")
  }
  
  // Validar que a transaction existe e pertence ao workspace
  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id, amount, type")
    .eq("id", transactionId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (transactionError || !transaction) {
    throw new Error("Transação não encontrada ou não pertence ao workspace")
  }
  
  // Validar que não há outra schedule já vinculada a esta transaction
  const { data: existingLink, error: linkError } = await supabase
    .from("financial_schedules")
    .select("id")
    .eq("linked_transaction_id", transactionId)
    .eq("workspace_id", workspace.id)
    .neq("id", scheduleId)
    .limit(1)
  
  if (linkError) {
    throw new Error(`Erro ao verificar vínculos existentes: ${linkError.message}`)
  }
  
  if (existingLink && existingLink.length > 0) {
    throw new Error("Esta transação já está vinculada a outro schedule")
  }
  
  // Atualizar schedule
  const { data: realized, error: updateError } = await supabase
    .from("financial_schedules")
    .update({
      status: 'realized',
      linked_transaction_id: transactionId,
    })
    .eq("id", scheduleId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (updateError) {
    throw new Error(`Erro ao marcar schedule como realizado: ${updateError.message}`)
  }
  
  return realized
}

/**
 * Lista schedules de um compromisso
 */
export async function listSchedulesByCommitment(commitmentId: string): Promise<FinancialSchedule[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Validar que o compromisso existe e pertence ao workspace
  const { data: commitment, error: commitmentError } = await supabase
    .from("financial_commitments")
    .select("id")
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (commitmentError || !commitment) {
    throw new Error("Compromisso não encontrado")
  }
  
  // Buscar schedules
  const { data: schedules, error } = await supabase
    .from("financial_schedules")
    .select("*")
    .eq("commitment_id", commitmentId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })
  
  if (error) {
    throw new Error(`Erro ao listar schedules: ${error.message}`)
  }
  
  return schedules || []
}

/**
 * Lista schedules por período
 */
export async function listSchedulesByPeriod(
  startDate: string | Date,
  endDate: string | Date,
  filters?: {
    type?: 'expense' | 'revenue'
    status?: 'planned' | 'realized' | 'cancelled'
    entityId?: string
  }
): Promise<FinancialSchedule[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const start = typeof startDate === 'string' ? startDate : formatDateISO(startDate)
  const end = typeof endDate === 'string' ? endDate : formatDateISO(endDate)
  
  // Query base com JOIN para pegar type do commitment
  let query = supabase
    .from("financial_schedules")
    .select(`
      *,
      financial_commitments!inner (
        type,
        entity_id
      )
    `)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .gte("due_date", start)
    .lte("due_date", end)
    .order("due_date", { ascending: true })
  
  if (filters?.type) {
    // Filtrar por type do commitment (via JOIN)
    query = query.eq("financial_commitments.type", filters.type)
  }
  
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  
  const { data, error } = await query
  
  if (error) {
    throw new Error(`Erro ao listar schedules: ${error.message}`)
  }
  
  // Filtrar por entityId se fornecido (não pode fazer direto no JOIN facilmente)
  let schedules = (data || []) as any[]
  
  if (filters?.entityId) {
    schedules = schedules.filter((s: any) => s.financial_commitments?.entity_id === filters.entityId)
  }
  
  // Retornar apenas os campos do schedule (sem o commitment aninhado)
  return schedules.map((s: any) => {
    const { financial_commitments, ...schedule } = s
    return schedule
  })
}

/**
 * Tipo para Contract Schedule
 */
export type ContractSchedule = {
  id: string
  contract_id: string
  workspace_id: string
  type: 'receivable' | 'payable'
  due_date: string
  amount: number
  status: 'planned' | 'received' | 'paid' | 'cancelled'
  linked_transaction_id: string | null
  created_at: string
}

/**
 * Gera schedules para um contrato (suporta recorrência como commitments)
 * 
 * REGRAS:
 * - Soma dos schedules = total_value (exato, centavos tratados)
 * - Datas respeitam start_date, end_date e recurrence
 * - Nunca cria schedules duplicados
 */
export async function generateContractSchedules(
  contractId: string,
  options?: {
    recurrence?: 'none' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
    type?: 'receivable' | 'payable'
  }
): Promise<ContractSchedule[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Buscar contrato
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("workspace_id", workspace.id)
    .single()

  if (contractError || !contract) {
    throw new Error("Contrato não encontrado")
  }

  // Verificar se já existem schedules
  const { data: existingSchedules, error: existingError } = await supabase
    .from("contract_schedules")
    .select("id")
    .eq("contract_id", contractId)
    .limit(1)

  if (existingError) {
    throw new Error(`Erro ao verificar schedules existentes: ${existingError.message}`)
  }

  if (existingSchedules && existingSchedules.length > 0) {
    throw new Error("Schedules já existem para este contrato. Use recalculateContractSchedules para regenerar.")
  }

  // Usar recurrence_period do contrato se disponível, senão usar opção ou padrão
  const contractRecurrence = (contract as any).recurrence_period || options?.recurrence || 'monthly'
  const recurrence = contractRecurrence === 'monthly' ? 'monthly' : contractRecurrence === 'quarterly' ? 'quarterly' : contractRecurrence === 'yearly' ? 'yearly' : (options?.recurrence || 'monthly')
  const scheduleType = options?.type || 'receivable'

  // Gerar datas baseado na recorrência
  const startDate = parseDateISO(contract.start_date)
  const endDate = contract.end_date ? parseDateISO(contract.end_date) : null

  let dates: Date[]

  if (recurrence === 'none') {
    // Sem recorrência: apenas uma data (start_date)
    dates = [startDate]
  } else if (!endDate) {
    // Recorrência sem end_date: apenas start_date
    dates = [startDate]
  } else {
    // Gerar datas recorrentes
    dates = generateRecurrenceDates(startDate, endDate, recurrence)
  }

  if (dates.length === 0) {
    throw new Error("Nenhuma data gerada para os schedules")
  }

  // Calcular valor por schedule
  // Se tiver monthly_value e value_type = monthly, usar monthly_value
  // Senão, dividir total_value entre as datas
  let amounts: number[]
  if ((contract as any).value_type === 'monthly' && (contract as any).monthly_value) {
    // Usar valor mensal fixo para todos os schedules
    const monthlyValue = Number((contract as any).monthly_value)
    amounts = dates.map(() => monthlyValue)
  } else {
    // Dividir o valor total entre as datas
    amounts = divideAmount(Number(contract.total_value), dates.length)
    // Validar que a soma é exata
    const totalScheduleAmount = sumAmounts(amounts)
    if (!amountsMatch(totalScheduleAmount, Number(contract.total_value))) {
      throw new Error(`Erro na distribuição de valores: esperado ${contract.total_value}, calculado ${totalScheduleAmount}`)
    }
  }

  // Criar schedules
  const schedulesToInsert = dates.map((date, index) => ({
    contract_id: contractId,
    workspace_id: workspace.id,
    type: scheduleType,
    due_date: formatDateISO(date),
    amount: amounts[index],
    status: 'planned' as const,
    linked_transaction_id: null,
  }))

  const { data: schedules, error: insertError } = await supabase
    .from("contract_schedules")
    .insert(schedulesToInsert)
    .select()

  if (insertError) {
    throw new Error(`Erro ao criar schedules do contrato: ${insertError.message}`)
  }

  return schedules || []
}

/**
 * Gera um schedule único para um contrato (backward compatibility)
 */
export async function generateContractSchedule(
  contractId: string,
  options: {
    dueDate: string
    amount: number
    type?: 'receivable' | 'payable'
  }
): Promise<ContractSchedule> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Validar que o contrato existe e pertence ao workspace
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, workspace_id")
    .eq("id", contractId)
    .eq("workspace_id", workspace.id)
    .single()

  if (contractError || !contract) {
    throw new Error("Contrato não encontrado ou não pertence ao workspace")
  }

  // Verificar se já existe schedule para este contrato
  const { data: existing, error: existingError } = await supabase
    .from("contract_schedules")
    .select("id")
    .eq("contract_id", contractId)
    .limit(1)

  if (existingError) {
    throw new Error(`Erro ao verificar schedules existentes: ${existingError.message}`)
  }

  if (existing && existing.length > 0) {
    throw new Error("Schedule já existe para este contrato")
  }

  // Criar schedule
  const { data: schedule, error: insertError } = await supabase
    .from("contract_schedules")
    .insert({
      contract_id: contractId,
      workspace_id: workspace.id,
      type: options.type || 'receivable',
      due_date: options.dueDate,
      amount: options.amount,
      status: 'planned',
      linked_transaction_id: null,
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Erro ao criar schedule do contrato: ${insertError.message}`)
  }

  return schedule
}

/**
 * Lista schedules de um contrato
 */
export async function listSchedulesByContract(contractId: string): Promise<ContractSchedule[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Validar que o contrato existe e pertence ao workspace
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id")
    .eq("id", contractId)
    .eq("workspace_id", workspace.id)
    .single()

  if (contractError || !contract) {
    throw new Error("Contrato não encontrado")
  }

  // Buscar schedules
  const { data: schedules, error } = await supabase
    .from("contract_schedules")
    .select("*")
    .eq("contract_id", contractId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })

  if (error) {
    throw new Error(`Erro ao listar schedules do contrato: ${error.message}`)
  }

  return schedules || []
}

