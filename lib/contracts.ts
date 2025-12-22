/**
 * MC4.3: Gerenciamento de Contratos/Projetos
 * 
 * Funções básicas para contratos (expansão futura)
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { validateAmount, validateDateRange, validateNotEmpty } from "@/lib/utils/validation"
import { parseDateISO } from "@/lib/utils/dates"
import { generateContractSchedules, listSchedulesByContract } from "./schedules"
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
}

export type CreateContractInput = {
  counterpartyEntityId: string
  title: string
  description?: string | null
  totalValue: number
  currency?: string
  startDate: string | Date
  endDate?: string | Date | null
}

export type UpdateContractInput = {
  title?: string
  description?: string | null
  status?: 'draft' | 'active' | 'completed' | 'cancelled'
  endDate?: string | Date | null
}

/**
 * Cria um novo contrato
 */
export async function createContract(input: CreateContractInput): Promise<Contract> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Validações
  validateNotEmpty(input.title, "Título")
  validateAmount(input.totalValue)
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
  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({
      workspace_id: workspace.id,
      counterparty_entity_id: input.counterpartyEntityId,
      title: input.title,
      description: input.description || null,
      total_value: input.totalValue,
      currency: input.currency || 'BRL',
      status: 'draft',
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate ? endDate.toISOString().split('T')[0] : null,
    })
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
      const schedules = await generateContractSchedules(contract.id, {
        recurrence: 'monthly',
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
