/**
 * MC4.2: Gerenciamento de Compromissos Financeiros
 * 
 * Responsável pela intenção financeira (forecast/planejamento)
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { validateAmount, validateDateRange, validateCommitmentType, validateCommitmentStatus, validateRecurrence, validateNotEmpty } from "@/lib/utils/validation"
import { generateRecurrenceDates, parseDateISO } from "@/lib/utils/dates"
import { generateSchedules, listSchedulesByCommitment } from "./schedules"
import { logAudit } from "./audit"
import { validateCommitmentTransition, canEditCommitment, canCancelCommitment } from "./governance/state-transitions"

export type Commitment = {
  id: string
  workspace_id: string
  entity_id: string
  type: 'expense' | 'revenue'
  category: string | null
  description: string
  total_amount: number
  currency: string
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  start_date: string
  end_date: string | null
  recurrence: 'none' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
  created_at: string
  updated_at: string
}

export type CreateCommitmentInput = {
  entityId: string
  type: 'expense' | 'revenue'
  category?: string | null
  description: string
  totalAmount: number
  currency?: string
  startDate: string | Date
  endDate?: string | Date | null
  recurrence?: 'none' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
  autoGenerateSchedules?: boolean
}

export type UpdateCommitmentInput = {
  category?: string | null
  description?: string
  status?: 'planned' | 'active' | 'completed' | 'cancelled'
  endDate?: string | Date | null
  recurrence?: 'none' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
}

/**
 * Cria um novo compromisso financeiro
 */
export async function createCommitment(input: CreateCommitmentInput): Promise<Commitment> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Validações
  validateCommitmentType(input.type)
  validateNotEmpty(input.description, "Descrição")
  validateAmount(input.totalAmount)
  validateDateRange(input.startDate, input.endDate || null)
  
  if (input.recurrence) {
    validateRecurrence(input.recurrence)
  }
  
  // Validar que a entidade pertence ao workspace
  const { data: entity, error: entityError } = await supabase
    .from("entities")
    .select("id")
    .eq("id", input.entityId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (entityError || !entity) {
    throw new Error("Entidade não encontrada ou não pertence ao workspace")
  }
  
  const startDate = typeof input.startDate === 'string' ? parseDateISO(input.startDate) : input.startDate
  const endDate = input.endDate ? (typeof input.endDate === 'string' ? parseDateISO(input.endDate) : input.endDate) : null
  
  // Criar compromisso
  const { data: commitment, error } = await supabase
    .from("financial_commitments")
    .insert({
      workspace_id: workspace.id,
      entity_id: input.entityId,
      type: input.type,
      category: input.category || null,
      description: input.description,
      total_amount: input.totalAmount,
      currency: input.currency || 'BRL',
      status: 'planned',
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate ? endDate.toISOString().split('T')[0] : null,
      recurrence: input.recurrence || 'none',
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao criar compromisso: ${error.message}`)
  }
  
  // Gravar audit log
  await logAudit('create', 'commitment', commitment.id, null, commitment)
  
  // Gerar schedules automaticamente (sempre, exceto se explícito false)
  // Se recorrência = none => 1 schedule no start_date com total_amount
  // Se recorrência != none => gerar baseado em end_date ou erro claro se ausente
  if (input.autoGenerateSchedules !== false && commitment.status === 'planned') {
    try {
      // Validar que se recorrência != none, end_date deve existir
      const recurrence = input.recurrence || 'none'
      if (recurrence !== 'none' && !endDate) {
        throw new Error(`Para recorrência "${recurrence}", é necessário informar data final (end_date) ou número de parcelas`)
      }
      
      const schedules = await generateSchedules(commitment.id)
      console.log(`[commitments:create] Schedules gerados: ${schedules.length} schedule(s) criado(s)`)
    } catch (scheduleError: any) {
      // Se falhar, fazer rollback manual (deletar commitment recém-criado)
      console.error("[commitments:create] Erro ao gerar schedules, fazendo rollback...", scheduleError?.message || scheduleError)
      try {
        await supabase
          .from("financial_commitments")
          .delete()
          .eq("id", commitment.id)
          .eq("workspace_id", workspace.id)
      } catch (rollbackError) {
        console.error("[commitments:create] Erro ao fazer rollback:", rollbackError)
      }
      
      const errorMsg = scheduleError?.message || String(scheduleError) || "Erro desconhecido ao gerar cronogramas"
      throw new Error(errorMsg)
    }
  }
  
  return commitment
}

/**
 * Atualiza um compromisso existente
 * 
 * REGRAS:
 * - total_amount NUNCA muda após ativação
 * - status cancelled não permite mais alterações significativas
 */
export async function updateCommitment(
  commitmentId: string,
  changes: UpdateCommitmentInput
): Promise<Commitment> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar compromisso atual
  const { data: current, error: fetchError } = await supabase
    .from("financial_commitments")
    .select("*")
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .single()
  
  if (fetchError || !current) {
    throw new Error("Compromisso não encontrado")
  }
  
  // Validar se pode editar
  if (!canEditCommitment(current.status)) {
    throw new Error(`Não é possível editar um compromisso com status "${current.status}"`)
  }

  // Validar transição de estado se estiver mudando status
  if (changes.status && changes.status !== current.status) {
    // Verificar se há schedules realizados
    const schedules = await listSchedulesByCommitment(commitmentId)
    const hasRealizedSchedules = schedules.some(s => s.status === 'realized')
    
    validateCommitmentTransition(current.status, changes.status, hasRealizedSchedules)
  }
  
  // Validações de campos
  if (changes.description) {
    validateNotEmpty(changes.description, "Descrição")
  }
  
  if (changes.status) {
    validateCommitmentStatus(changes.status)
  }
  
  if (changes.recurrence) {
    validateRecurrence(changes.recurrence)
  }
  
  if (changes.endDate !== undefined && current.start_date) {
    validateDateRange(current.start_date, changes.endDate)
  }
  
  // Montar update
  const updateData: any = {
    updated_at: new Date().toISOString(),
  }
  
  if (changes.category !== undefined) {
    updateData.category = changes.category
  }
  
  if (changes.description) {
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
  
  if (changes.recurrence) {
    updateData.recurrence = changes.recurrence
  }
  
  // Atualizar
  const { data: updated, error } = await supabase
    .from("financial_commitments")
    .update(updateData)
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao atualizar compromisso: ${error.message}`)
  }
  
  // Gravar audit log
  await logAudit('update', 'commitment', commitmentId, current, updated)
  
  return updated
}

/**
 * Cancela um compromisso
 * 
 * REGRAS:
 * - Cancela também todos os schedules não realizados
 */
export async function cancelCommitment(commitmentId: string): Promise<Commitment> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar compromisso
  const { data: commitment, error: fetchError } = await supabase
    .from("financial_commitments")
    .select("*")
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .single()
  
  if (fetchError || !commitment) {
    throw new Error("Compromisso não encontrado")
  }
  
  if (commitment.status === 'cancelled') {
    return commitment
  }
  
  if (commitment.status === 'completed') {
    throw new Error("Não é possível cancelar um compromisso já concluído")
  }
  
  // Atualizar status do compromisso
  const { data: cancelled, error: updateError } = await supabase
    .from("financial_commitments")
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (updateError) {
    throw new Error(`Erro ao cancelar compromisso: ${updateError.message}`)
  }
  
  // Cancelar TODOS os schedules não realizados (cascata)
  const { data: cancelledSchedules } = await supabase
    .from("financial_schedules")
    .update({ status: 'cancelled' })
    .eq("commitment_id", commitmentId)
    .in("status", ['planned'])
    .select()

  console.log(`[commitments:cancel] ${cancelledSchedules?.length || 0} schedule(s) cancelado(s)`)
  
  // Gravar audit log
  await logAudit('cancel', 'commitment', commitmentId, commitment, cancelled)
  
  return cancelled
}

/**
 * Ativa um compromisso (muda de planned para active)
 */
export async function activateCommitment(commitmentId: string): Promise<Commitment> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar compromisso
  const { data: commitment, error: fetchError } = await supabase
    .from("financial_commitments")
    .select("*")
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (fetchError || !commitment) {
    throw new Error("Compromisso não encontrado")
  }
  
  if (commitment.status === 'active') {
    return commitment
  }
  
  if (commitment.status !== 'planned') {
    throw new Error(`Não é possível ativar um compromisso com status '${commitment.status}'`)
  }
  
  // Atualizar status
  const { data: activated, error } = await supabase
    .from("financial_commitments")
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao ativar compromisso: ${error.message}`)
  }
  
  // Gravar audit log
  await logAudit('activate', 'commitment', commitmentId, commitment, activated)
  
  return activated
}

/**
 * Marca um compromisso como concluído
 * 
 * REGRAS:
 * - Exige que todos os schedules estejam realizados ou cancelados
 */
export async function completeCommitment(commitmentId: string): Promise<Commitment> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar compromisso
  const { data: commitment, error: fetchError } = await supabase
    .from("financial_commitments")
    .select("*")
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .single()
  
  if (fetchError || !commitment) {
    throw new Error("Compromisso não encontrado")
  }
  
  if (commitment.status === 'completed') {
    return commitment
  }
  
  // Verificar se há schedules pendentes
  const { data: pendingSchedules, error: schedulesError } = await supabase
    .from("financial_schedules")
    .select("id")
    .eq("commitment_id", commitmentId)
    .eq("status", 'planned')
    .limit(1)
  
  if (schedulesError) {
    throw new Error(`Erro ao verificar schedules: ${schedulesError.message}`)
  }
  
  if (pendingSchedules && pendingSchedules.length > 0) {
    throw new Error("Não é possível concluir um compromisso com schedules pendentes")
  }
  
  // Atualizar status
  const { data: completed, error } = await supabase
    .from("financial_commitments")
    .update({
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq("id", commitmentId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao concluir compromisso: ${error.message}`)
  }
  
  // Gravar audit log
  await logAudit('complete', 'commitment', commitmentId, commitment, completed)
  
  return completed
}

/**
 * Lista compromissos do workspace
 */
export async function listCommitments(filters?: {
  entityId?: string
  type?: 'expense' | 'revenue'
  status?: 'planned' | 'active' | 'completed' | 'cancelled'
  category?: string
}): Promise<Commitment[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  let query = supabase
    .from("financial_commitments")
    .select("*")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  
  if (filters?.entityId) {
    query = query.eq("entity_id", filters.entityId)
  }
  
  if (filters?.type) {
    query = query.eq("type", filters.type)
  }
  
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  
  if (filters?.category) {
    query = query.eq("category", filters.category)
  }
  
  const { data, error } = await query
  
  if (error) {
    throw new Error(`Erro ao listar compromissos: ${error.message}`)
  }
  
  return data || []
}

