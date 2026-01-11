/**
 * MC14: Gerenciamento de Notas de Débito
 * 
 * Funções para criar, gerenciar e reconciliar notas de débito
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { validateAmount, validateNotEmpty } from "@/lib/utils/validation"
import { formatDateISO, parseDateISO } from "@/lib/utils/dates"
import { listSchedulesByContract, type ContractSchedule } from "./schedules"

export type DebitNote = {
  id: string
  workspace_id: string
  contract_id: string
  number: string
  sequence_number: number
  issued_date: string
  due_date: string
  paid_at: string | null
  total_amount: number
  currency: string
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
  description: string | null
  linked_transaction_id: string | null
  created_at: string
  updated_at: string
}

export type DebitNoteItem = {
  id: string
  workspace_id: string
  debit_note_id: string
  contract_schedule_id: string
  amount: number
  currency: string
  description: string | null
  created_at: string
}

export type DebitNoteWithItems = DebitNote & {
  items: DebitNoteItem[]
}

export type CreateDebitNoteInput = {
  contractId: string
  scheduleIds: string[] // Múltiplos schedules para incluir na nota
  issuedDate?: string | Date
  dueDate?: string | Date
  description?: string
  expenses?: Array<{ description?: string | null; amount: number }>
  discounts?: Array<{ description?: string | null; amount: number }>
}

/**
 * Gera o próximo número sequencial de nota de débito
 * Formato: ND-YYYY-NNN (ex: ND-2026-001)
 */
export async function generateNextDebitNoteNumber(): Promise<{ number: string; sequenceNumber: number }> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Obter ano atual
  const currentYear = new Date().getFullYear()
  
  // Buscar último número do ano atual
  const { data: lastNote, error } = await supabase
    .from("debit_notes")
    .select("sequence_number")
    .eq("workspace_id", workspace.id)
    .like("number", `ND-${currentYear}-%`)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .single()
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = nenhum resultado
    throw new Error(`Erro ao buscar último número: ${error.message}`)
  }
  
  // Calcular próximo número
  const nextSequence = lastNote?.sequence_number ? lastNote.sequence_number + 1 : 1
  const number = `ND-${currentYear}-${String(nextSequence).padStart(3, '0')}`
  
  return { number, sequenceNumber: nextSequence }
}

/**
 * Cria uma nova nota de débito a partir de schedules
 */
export async function createDebitNote(input: CreateDebitNoteInput): Promise<DebitNoteWithItems> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Validações
  validateNotEmpty(input.contractId, "Contrato")
  if (!input.scheduleIds || input.scheduleIds.length === 0) {
    throw new Error("É necessário selecionar pelo menos um schedule")
  }
  
  // Buscar schedules
  const { data: schedules, error: schedulesError } = await supabase
    .from("contract_schedules")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("contract_id", input.contractId)
    .in("id", input.scheduleIds)
    .eq("status", "planned") // Apenas schedules não realizados
    .eq("type", "receivable") // Apenas recebíveis
  
  if (schedulesError) {
    throw new Error(`Erro ao buscar schedules: ${schedulesError.message}`)
  }
  
  if (!schedules || schedules.length === 0) {
    throw new Error("Nenhum schedule válido encontrado")
  }
  
  if (schedules.length !== input.scheduleIds.length) {
    throw new Error("Alguns schedules não foram encontrados ou não são válidos")
  }
  
  // Verificar se os schedules já têm nota de débito
  const { data: existingItems, error: existingError } = await supabase
    .from("debit_note_items")
    .select("contract_schedule_id")
    .in("contract_schedule_id", input.scheduleIds)
    .limit(1)
  
  if (existingError) {
    throw new Error(`Erro ao verificar schedules existentes: ${existingError.message}`)
  }
  
  if (existingItems && existingItems.length > 0) {
    throw new Error("Um ou mais schedules já possuem nota de débito")
  }
  
  // Calcular valor total
  const totalAmount = schedules.reduce((sum, s) => sum + Number(s.amount), 0)
  validateAmount(totalAmount)
  
  // Determinar datas
  const issuedDate = input.issuedDate 
    ? (typeof input.issuedDate === 'string' ? parseDateISO(input.issuedDate) : input.issuedDate)
    : new Date()
  
  // Vencimento = maior due_date dos schedules
  const dueDate = schedules.reduce((max, s) => {
    const sDate = parseDateISO(s.due_date)
    return sDate > max ? sDate : max
  }, parseDateISO(schedules[0].due_date))
  
  // Gerar número da nota
  const { number, sequenceNumber } = await generateNextDebitNoteNumber()
  
  // Criar nota de débito
  const { data: debitNote, error: noteError } = await supabase
    .from("debit_notes")
    .insert({
      workspace_id: workspace.id,
      contract_id: input.contractId,
      number,
      sequence_number: sequenceNumber,
      issued_date: formatDateISO(issuedDate),
      due_date: formatDateISO(dueDate),
      total_amount: totalAmount,
      currency: 'BRL',
      status: 'draft',
      description: input.description || null,
    })
    .select()
    .single()
  
  if (noteError) {
    throw new Error(`Erro ao criar nota de débito: ${noteError.message}`)
  }
  
  // Criar itens da nota
  const itemsToInsert = schedules.map(schedule => ({
    workspace_id: workspace.id,
    debit_note_id: debitNote.id,
    contract_schedule_id: schedule.id,
    amount: Number(schedule.amount),
    currency: 'BRL',
    description: schedule.due_date ? `Item - ${schedule.due_date}` : null,
  }))
  
  const { data: items, error: itemsError } = await supabase
    .from("debit_note_items")
    .insert(itemsToInsert)
    .select()
  
  if (itemsError) {
    // Rollback: deletar nota criada
    await supabase
      .from("debit_notes")
      .delete()
      .eq("id", debitNote.id)
      .eq("workspace_id", workspace.id)
    
    throw new Error(`Erro ao criar itens da nota: ${itemsError.message}`)
  }
  
  return {
    ...debitNote,
    items: items || [],
  }
}

/**
 * Lista notas de débito do workspace
 */
export async function listDebitNotes(filters?: {
  contractId?: string
  status?: 'draft' | 'sent' | 'paid' | 'cancelled'
  year?: number
}): Promise<DebitNoteWithItems[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  let query = supabase
    .from("debit_notes")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("issued_date", { ascending: false })
    .order("sequence_number", { ascending: false })
  
  if (filters?.contractId) {
    query = query.eq("contract_id", filters.contractId)
  }
  
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  
  if (filters?.year) {
    query = query.like("number", `ND-${filters.year}-%`)
  }
  
  const { data: notes, error } = await query
  
  if (error) {
    throw new Error(`Erro ao listar notas de débito: ${error.message}`)
  }
  
  if (!notes || notes.length === 0) {
    return []
  }
  
  // Buscar itens de cada nota
  const { data: items, error: itemsError } = await supabase
    .from("debit_note_items")
    .select("*")
    .in("debit_note_id", notes.map(n => n.id))
  
  if (itemsError) {
    throw new Error(`Erro ao buscar itens: ${itemsError.message}`)
  }
  
  // Agrupar itens por nota
  const itemsByNoteId = (items || []).reduce((acc, item) => {
    if (!acc[item.debit_note_id]) {
      acc[item.debit_note_id] = []
    }
    acc[item.debit_note_id].push(item)
    return acc
  }, {} as Record<string, DebitNoteItem[]>)
  
  return notes.map(note => ({
    ...note,
    items: itemsByNoteId[note.id] || [],
  }))
}

/**
 * Busca uma nota de débito por ID
 */
export async function getDebitNoteById(debitNoteId: string): Promise<DebitNoteWithItems> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const { data: note, error } = await supabase
    .from("debit_notes")
    .select("*")
    .eq("id", debitNoteId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (error || !note) {
    throw new Error("Nota de débito não encontrada")
  }
  
  // Buscar itens
  const { data: items, error: itemsError } = await supabase
    .from("debit_note_items")
    .select("*")
    .eq("debit_note_id", debitNoteId)
  
  if (itemsError) {
    throw new Error(`Erro ao buscar itens: ${itemsError.message}`)
  }
  
  return {
    ...note,
    items: items || [],
  }
}

/**
 * Atualiza status de uma nota de débito
 */
export async function updateDebitNoteStatus(
  debitNoteId: string,
  status: 'draft' | 'sent' | 'paid' | 'cancelled',
  options?: {
    paidAt?: string | Date
    linkedTransactionId?: string
  }
): Promise<DebitNote> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }
  
  if (status === 'paid' && options?.paidAt) {
    updateData.paid_at = typeof options.paidAt === 'string' 
      ? options.paidAt 
      : formatDateISO(options.paidAt)
  }
  
  if (options?.linkedTransactionId) {
    updateData.linked_transaction_id = options.linkedTransactionId
  }
  
  const { data: updated, error } = await supabase
    .from("debit_notes")
    .update(updateData)
    .eq("id", debitNoteId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao atualizar nota de débito: ${error.message}`)
  }
  
  return updated
}

/**
 * Reconcilia uma nota de débito com uma transação
 * Atualiza status da nota e dos schedules vinculados
 */
export async function reconcileDebitNote(
  debitNoteId: string,
  transactionId: string
): Promise<DebitNoteWithItems> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar nota
  const debitNote = await getDebitNoteById(debitNoteId)
  
  if (debitNote.status === 'paid') {
    throw new Error("Nota de débito já está paga")
  }
  
  // Buscar transação
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (txError || !transaction) {
    throw new Error("Transação não encontrada")
  }
  
  if (transaction.type !== 'income') {
    throw new Error("Apenas transações de receita podem ser reconciliadas com notas de débito")
  }
  
  // Atualizar nota de débito
  const updatedNote = await updateDebitNoteStatus(debitNoteId, 'paid', {
    paidAt: transaction.date,
    linkedTransactionId: transactionId,
  })
  
  // Atualizar status dos schedules vinculados
  const scheduleIds = debitNote.items.map(item => item.contract_schedule_id)
  
  const { error: schedulesError } = await supabase
    .from("contract_schedules")
    .update({
      status: 'received',
      linked_transaction_id: transactionId,
    })
    .in("id", scheduleIds)
    .eq("workspace_id", workspace.id)
  
  if (schedulesError) {
    throw new Error(`Erro ao atualizar schedules: ${schedulesError.message}`)
  }
  
  return await getDebitNoteById(debitNoteId)
}

/**
 * Busca notas de débito pendentes para reconciliação automática
 * Matching por valor total (tolerância de centavos) e data (tolerância de 2 dias)
 */
export async function findMatchingDebitNotes(
  transactionAmount: number,
  transactionDate: string | Date
): Promise<DebitNoteWithItems[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const txDate = typeof transactionDate === 'string' ? parseDateISO(transactionDate) : transactionDate
  const txDateStr = formatDateISO(txDate)
  
  // Buscar notas pendentes (sent, não paid)
  // Valor deve corresponder (tolerância de 0.01 centavos)
  // Data deve estar dentro de 2 dias (due_date ± 2 dias)
  const { data: notes, error } = await supabase
    .from("debit_notes")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("status", "sent")
    .is("linked_transaction_id", null)
    .gte("total_amount", transactionAmount - 0.01)
    .lte("total_amount", transactionAmount + 0.01)
    .gte("due_date", new Date(txDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .lte("due_date", new Date(txDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order("due_date", { ascending: false })
  
  if (error) {
    throw new Error(`Erro ao buscar notas para matching: ${error.message}`)
  }
  
  if (!notes || notes.length === 0) {
    return []
  }
  
  // Buscar itens de cada nota
  const { data: items, error: itemsError } = await supabase
    .from("debit_note_items")
    .select("*")
    .in("debit_note_id", notes.map(n => n.id))
  
  if (itemsError) {
    throw new Error(`Erro ao buscar itens: ${itemsError.message}`)
  }
  
  // Agrupar itens por nota
  const itemsByNoteId = (items || []).reduce((acc, item) => {
    if (!acc[item.debit_note_id]) {
      acc[item.debit_note_id] = []
    }
    acc[item.debit_note_id].push(item)
    return acc
  }, {} as Record<string, DebitNoteItem[]>)
  
  return notes.map(note => ({
    ...note,
    items: itemsByNoteId[note.id] || [],
  }))
}
