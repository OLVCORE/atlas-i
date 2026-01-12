/**
 * MC4.3: Gerenciamento de Contratos/Projetos
 * 
 * Funções básicas para contratos (expansão futura)
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { validateAmount, validateDateRange, validateNotEmpty } from "@/lib/utils/validation"
import { parseDateISO, generateRecurrenceDates } from "@/lib/utils/dates"
import { generateContractSchedules, listSchedulesByContract, recalculateContractSchedules } from "./schedules"
import { logAudit } from "./audit"
import { validateContractTransition, canEditContract, canCancelContract } from "./governance/state-transitions"

export type Contract = {
  id: string
  workspace_id: string
  counterparty_entity_id: string
  title: string
  description: string | null
  total_value: number
  currency: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  start_date: string
  end_date: string | null
  created_at: string
  updated_at: string
  // Campos opcionais adicionados na migration MC15
  value_type?: 'total' | 'monthly' | 'quarterly' | 'yearly'
  monthly_value?: number | null
  recurrence_period?: 'monthly' | 'quarterly' | 'yearly'
  adjustment_index?: 'NONE' | 'IPCA' | 'IGPM' | 'CDI' | 'MANUAL' | 'CUSTOM'
  adjustment_frequency?: 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  adjustment_percentage?: number | null
  deleted_at?: string | null
}

export type CreateContractInput = {
  counterpartyEntityId: string
  title: string
  description?: string | null
  totalValue: number
  monthlyValue?: number
  valueType?: 'total' | 'monthly' | 'quarterly' | 'yearly'
  recurrencePeriod?: 'monthly' | 'quarterly' | 'yearly'
  adjustmentIndex?: 'NONE' | 'IPCA' | 'IGPM' | 'CDI' | 'MANUAL' | 'CUSTOM'
  adjustmentFrequency?: 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  adjustmentPercentage?: number
  currency?: string
  startDate: string | Date
  endDate?: string | Date | null
}

export type UpdateContractInput = {
  title?: string
  description?: string | null
  status?: 'draft' | 'active' | 'completed' | 'cancelled'
  totalValue?: number
  monthlyValue?: number
  valueType?: 'total' | 'monthly' | 'quarterly' | 'yearly'
  recurrencePeriod?: 'monthly' | 'quarterly' | 'yearly'
  adjustmentIndex?: 'NONE' | 'IPCA' | 'IGPM' | 'CDI' | 'MANUAL' | 'CUSTOM'
  adjustmentFrequency?: 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  adjustmentPercentage?: number
  currency?: string
  startDate?: string | Date
  endDate?: string | Date | null
}

/**
 * Busca um contrato por ID
 */
export async function getContractById(contractId: string): Promise<Contract | null> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data
}

/**
 * Cria um novo contrato
 */
export async function createContract(input: CreateContractInput): Promise<Contract> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Validações
  validateNotEmpty(input.title, "Título")
  // Validar valor baseado no tipo
  if (input.valueType === 'monthly' && input.monthlyValue) {
    validateAmount(input.monthlyValue)
  } else {
    validateAmount(input.totalValue)
  }
  validateDateRange(input.startDate, input.endDate || null)
  
  // Validar que a entidade pertence ao workspace
  const { data: entity, error: entityError } = await supabase
    .from("entities")
    .select("id")
    .eq("id", input.counterpartyEntityId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (entityError || !entity) {
    throw new Error("Entidade não encontrada ou não pertence ao workspace")
  }
  
  const startDate = typeof input.startDate === 'string' ? parseDateISO(input.startDate) : input.startDate
  const endDate = input.endDate ? (typeof input.endDate === 'string' ? parseDateISO(input.endDate) : input.endDate) : null
  
  // Criar contrato
  const contractData: any = {
    workspace_id: workspace.id,
    counterparty_entity_id: input.counterpartyEntityId,
    title: input.title,
    description: input.description || null,
    total_value: input.totalValue,
    currency: input.currency || 'BRL',
    status: 'draft',
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate ? endDate.toISOString().split('T')[0] : null,
  }

  if (input.valueType) {
    contractData.value_type = input.valueType
  }

  if (input.monthlyValue) {
    contractData.monthly_value = input.monthlyValue
  }

  if (input.recurrencePeriod) {
    contractData.recurrence_period = input.recurrencePeriod
  }

  if (input.adjustmentIndex) {
    contractData.adjustment_index = input.adjustmentIndex
  }

  if (input.adjustmentFrequency) {
    contractData.adjustment_frequency = input.adjustmentFrequency
  }

  if (input.adjustmentPercentage !== undefined) {
    contractData.adjustment_percentage = input.adjustmentPercentage
  }

  const { data: contract, error } = await supabase
    .from("contracts")
    .insert(contractData)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao criar contrato: ${error.message}`)
  }

  // Gravar audit log
  await logAudit('create', 'contract', contract.id, null, contract)

  // Gerar schedules automaticamente se end_date existir e for diferente de start_date
  // Por padrão: recorrência mensal se end_date > start_date
  const endDateObj = input.endDate ? (typeof input.endDate === 'string' ? parseDateISO(input.endDate) : input.endDate) : null
  const startDateObj = typeof input.startDate === 'string' ? parseDateISO(input.startDate) : input.startDate
  
  if (endDateObj && endDateObj > startDateObj) {
    try {
      const recurrence = input.recurrencePeriod || 'monthly'
      const schedules = await generateContractSchedules(contract.id, {
        recurrence: recurrence as 'monthly' | 'quarterly' | 'yearly',
        type: 'receivable', // Padrão: recebível
      })
      console.log(`[contracts:create] ${schedules.length} schedule(s) gerado(s) para contrato ${contract.id}`)
    } catch (scheduleError: any) {
      // Se falhar, fazer rollback manual (deletar contrato recém-criado)
      console.error("[contracts:create] Erro ao gerar schedules, fazendo rollback...", scheduleError?.message || scheduleError)
      try {
        await supabase
          .from("contracts")
          .delete()
          .eq("id", contract.id)
          .eq("workspace_id", workspace.id)
      } catch (rollbackError) {
        console.error("[contracts:create] Erro ao fazer rollback:", rollbackError)
      }
      
      const errorMsg = scheduleError?.message || String(scheduleError) || "Erro desconhecido ao gerar cronogramas"
      throw new Error(errorMsg)
    }
  } else if (endDateObj && endDateObj <= startDateObj) {
    // Se end_date <= start_date, não gerar schedules (contrato único)
    console.log(`[contracts:create] Contrato único (end_date <= start_date), não gerando schedules`)
  }

  return contract
}

/**
 * Atualiza um contrato
 */
export async function updateContract(contractId: string, changes: UpdateContractInput): Promise<Contract> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  console.log(`[contracts:update] Iniciando atualização do contrato ${contractId}`)
  console.log(`[contracts:update] Mudanças recebidas:`, JSON.stringify(changes, null, 2))
  
  // Buscar contrato atual
  const { data: current, error: fetchError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .single()
  
  if (fetchError || !current) {
    throw new Error("Contrato não encontrado")
  }
  
  console.log(`[contracts:update] Contrato atual:`, {
    value_type: current.value_type,
    monthly_value: current.monthly_value,
    total_value: current.total_value,
    start_date: current.start_date,
    end_date: current.end_date,
    recurrence_period: current.recurrence_period
  })

  // Validar se pode editar
  if (!canEditContract(current.status)) {
    throw new Error(`Não é possível editar um contrato com status "${current.status}"`)
  }

  // Validar transição de estado se estiver mudando status
  if (changes.status && changes.status !== current.status) {
    // Verificar se há schedules realizados
    const schedules = await listSchedulesByContract(contractId)
    const hasRealizedSchedules = schedules.some(s => s.status === 'received' || s.status === 'paid')
    
    validateContractTransition(current.status, changes.status, hasRealizedSchedules)
  }
  
  // Montar update
  const updateData: any = {
    updated_at: new Date().toISOString(),
  }
  
  if (changes.title) {
    validateNotEmpty(changes.title, "Título")
    updateData.title = changes.title
  }
  
  if (changes.description !== undefined) {
    updateData.description = changes.description
  }
  
  if (changes.status) {
    updateData.status = changes.status
  }

  // Processar monthlyValue primeiro (pode recalcular totalValue)
  if (changes.monthlyValue !== undefined) {
    validateAmount(changes.monthlyValue)
    updateData.monthly_value = changes.monthlyValue
    
    // Se value_type é 'monthly' e monthlyValue foi alterado, recalcular total_value
    const finalValueType = changes.valueType || current.value_type
    if (finalValueType === 'monthly' && changes.monthlyValue) {
      // Calcular total_value baseado no número de períodos do contrato
      const startDate = parseDateISO(current.start_date)
      const endDate = current.end_date ? parseDateISO(current.end_date) : null
      const finalRecurrence = changes.recurrencePeriod || current.recurrence_period || 'monthly'
      
      if (endDate && endDate > startDate) {
        // Calcular número de períodos
        const dates = generateRecurrenceDates(startDate, endDate, finalRecurrence)
        const numberOfPeriods = dates.length
        const newTotalValue = Number(changes.monthlyValue) * numberOfPeriods
        updateData.total_value = newTotalValue
        console.log(`[contracts:update] Recalculando total_value: ${changes.monthlyValue} × ${numberOfPeriods} = ${newTotalValue}`)
      } else {
        // Se não tem endDate, usar apenas 1 período
        updateData.total_value = Number(changes.monthlyValue)
        console.log(`[contracts:update] Recalculando total_value (sem endDate): ${changes.monthlyValue}`)
      }
    }
  }

  // Processar totalValue apenas se não foi calculado automaticamente acima
  if (changes.totalValue !== undefined && !updateData.total_value) {
    validateAmount(changes.totalValue)
    updateData.total_value = changes.totalValue
  }

  if (changes.valueType) {
    updateData.value_type = changes.valueType
    
    // Se mudou para 'monthly' e tem monthlyValue, recalcular total_value
    if (changes.valueType === 'monthly' && (changes.monthlyValue !== undefined || current.monthly_value)) {
      const monthlyValue = changes.monthlyValue !== undefined ? changes.monthlyValue : current.monthly_value
      if (monthlyValue) {
        const startDate = parseDateISO(current.start_date)
        const endDate = current.end_date ? parseDateISO(current.end_date) : null
        const finalRecurrence = changes.recurrencePeriod || current.recurrence_period || 'monthly'
        
        if (endDate && endDate > startDate) {
          const dates = generateRecurrenceDates(startDate, endDate, finalRecurrence)
          const numberOfPeriods = dates.length
          const newTotalValue = Number(monthlyValue) * numberOfPeriods
          updateData.total_value = newTotalValue
          console.log(`[contracts:update] Recalculando total_value após mudança de value_type: ${monthlyValue} × ${numberOfPeriods} = ${newTotalValue}`)
        }
      }
    }
  }

  if (changes.recurrencePeriod) {
    updateData.recurrence_period = changes.recurrencePeriod
    
    // Se tem monthlyValue e mudou recorrência, recalcular total_value
    const finalValueType = changes.valueType || current.value_type
    if (finalValueType === 'monthly' && (changes.monthlyValue !== undefined || current.monthly_value)) {
      const monthlyValue = changes.monthlyValue !== undefined ? changes.monthlyValue : current.monthly_value
      if (monthlyValue) {
        const startDate = parseDateISO(current.start_date)
        const endDate = current.end_date ? parseDateISO(current.end_date) : null
        
        if (endDate && endDate > startDate) {
          const dates = generateRecurrenceDates(startDate, endDate, changes.recurrencePeriod)
          const numberOfPeriods = dates.length
          const newTotalValue = Number(monthlyValue) * numberOfPeriods
          updateData.total_value = newTotalValue
          console.log(`[contracts:update] Recalculando total_value após mudança de recorrência: ${monthlyValue} × ${numberOfPeriods} = ${newTotalValue}`)
        }
      }
    }
  }

  if (changes.adjustmentIndex) {
    updateData.adjustment_index = changes.adjustmentIndex
  }

  if (changes.adjustmentFrequency) {
    updateData.adjustment_frequency = changes.adjustmentFrequency
  }

  if (changes.adjustmentPercentage !== undefined) {
    updateData.adjustment_percentage = changes.adjustmentPercentage
  }

  if (changes.currency) {
    updateData.currency = changes.currency
  }

  if (changes.startDate !== undefined) {
    const startDate = typeof changes.startDate === 'string' ? parseDateISO(changes.startDate) : changes.startDate
    updateData.start_date = startDate.toISOString().split('T')[0]
  }
  
  if (changes.endDate !== undefined) {
    updateData.end_date = changes.endDate 
      ? (typeof changes.endDate === 'string' ? changes.endDate : changes.endDate.toISOString().split('T')[0])
      : null
  }
  
  // Atualizar
  const { data: updated, error } = await supabase
    .from("contracts")
    .update(updateData)
    .eq("id", contractId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao atualizar contrato: ${error.message}`)
  }
  
  // Verificar se precisa recalcular schedules (se valores, datas ou recorrência mudaram)
  const needsScheduleRecalculation = 
    changes.monthlyValue !== undefined ||
    changes.totalValue !== undefined ||
    changes.valueType !== undefined ||
    changes.recurrencePeriod !== undefined ||
    changes.startDate !== undefined ||
    changes.endDate !== undefined
  
  if (needsScheduleRecalculation) {
    try {
      console.log(`[contracts:update] Recalculando schedules do contrato ${contractId}`)
      await recalculateContractSchedules(contractId)
      console.log(`[contracts:update] Schedules recalculados com sucesso`)
    } catch (scheduleError: any) {
      console.error(`[contracts:update] Erro ao recalcular schedules:`, scheduleError?.message || scheduleError)
      // Não falhar a atualização do contrato se o recálculo de schedules falhar
      // Mas logar o erro para debug
    }
  }
  
  // Gravar audit log
  await logAudit('update', 'contract', contractId, current, updated)
  
  return updated
}

/**
 * Cancela um contrato
 */
export async function cancelContract(contractId: string): Promise<Contract> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar contrato
  const { data: contract, error: fetchError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .single()
  
  if (fetchError || !contract) {
    throw new Error("Contrato não encontrado")
  }
  
    // Verificar se há schedules realizados
    const schedules = await listSchedulesByContract(contractId)
    const hasRealizedSchedules = schedules.some((s: any) => s.status === 'received' || s.status === 'paid')
  
  if (!canCancelContract(contract.status, hasRealizedSchedules)) {
    if (contract.status === 'cancelled') {
      return contract
    }
    if (hasRealizedSchedules) {
      throw new Error("Não é possível cancelar contrato com schedules já realizados")
    }
    throw new Error(`Não é possível cancelar um contrato com status "${contract.status}"`)
  }
  
  // Atualizar status do contrato
  const { data: cancelled, error: updateError } = await supabase
    .from("contracts")
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (updateError) {
    throw new Error(`Erro ao cancelar contrato: ${updateError.message}`)
  }
  
  // Cancelar TODOS os schedules não realizados (cascata)
  const { data: cancelledSchedules } = await supabase
    .from("contract_schedules")
    .update({ status: 'cancelled' })
    .eq("contract_id", contractId)
    .in("status", ['planned'])
    .select()

  console.log(`[contracts:cancel] ${cancelledSchedules?.length || 0} schedule(s) cancelado(s)`)
  
  // Gravar audit log
  await logAudit('cancel', 'contract', contractId, contract, cancelled)
  
  return cancelled
}

/**
 * Lista contratos do workspace
 */
export async function listContracts(filters?: {
  counterpartyEntityId?: string
  status?: 'draft' | 'active' | 'completed' | 'cancelled'
}): Promise<Contract[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  let query = supabase
    .from("contracts")
    .select("*")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  
  if (filters?.counterpartyEntityId) {
    query = query.eq("counterparty_entity_id", filters.counterpartyEntityId)
  }
  
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  
  const { data, error } = await query
  
  if (error) {
    throw new Error(`Erro ao listar contratos: ${error.message}`)
  }
  
  return data || []
}

/**
 * Deleta um contrato (soft delete)
 */
export async function deleteContract(contractId: string): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar contrato
  const { data: contract, error: fetchError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .single()
  
  if (fetchError || !contract) {
    throw new Error("Contrato não encontrado")
  }

  // Verificar se pode deletar (apenas draft ou cancelled)
  if (contract.status !== 'draft' && contract.status !== 'cancelled') {
    throw new Error("Apenas contratos em rascunho ou cancelados podem ser deletados")
  }

  const deletedAt = new Date().toISOString()

  // Soft delete: marcar deleted_at no contrato
  const { error } = await supabase
    .from("contracts")
    .update({
      deleted_at: deletedAt,
    })
    .eq("id", contractId)
    .eq("workspace_id", workspace.id)
  
  if (error) {
    throw new Error(`Erro ao deletar contrato: ${error.message}`)
  }

  // Marcar todos os schedules do contrato como deletados também
  const { error: schedulesError } = await supabase
    .from("contract_schedules")
    .update({
      deleted_at: deletedAt,
    })
    .eq("contract_id", contractId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)

  if (schedulesError) {
    console.error(`[contracts:delete] Erro ao marcar schedules como deletados: ${schedulesError.message}`)
    // Não falhar o delete se houver erro nos schedules, mas logar
  }
  
  // Gravar audit log
  await logAudit('delete', 'contract', contractId, contract, null)
}