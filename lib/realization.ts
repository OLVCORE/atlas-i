/**
 * MC4.2 + MC4.3.1-AUTO: Conciliação Manual e Automática
 * 
 * Responsável por vincular schedules com transactions (realização)
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { amountsMatch } from "@/lib/utils/money"
import { parseDateISO, formatDateISO } from "@/lib/utils/dates"
import { markScheduleAsRealized } from "./schedules"
import { createTransaction } from "./transactions"
import { logAudit } from "./audit"
import type { FinancialSchedule } from "./schedules"
import type { ContractSchedule } from "./schedules"

export type MatchCandidate = {
  scheduleId: string
  transactionId: string
  confidence: number
  evidence: {
    amountMatch: boolean
    dateMatch: boolean
    dateDiffDays: number
    entityMatch: boolean
  }
}

/**
 * Vincula uma transaction a um schedule
 * 
 * REGRAS:
 * - 1 transaction ↔ 1 schedule (1:1)
 * - Valida que transaction e schedule pertencem ao workspace
 */
export async function linkTransactionToSchedule(
  scheduleId: string,
  transactionId: string
): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Usar função existente que já faz todas as validações
  await markScheduleAsRealized(scheduleId, transactionId)
}

/**
 * Remove vínculo entre transaction e schedule
 */
export async function unlinkTransactionFromSchedule(scheduleId: string): Promise<void> {
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
  
  if (schedule.status !== 'realized') {
    throw new Error("Apenas schedules realizados podem ser desvinculados")
  }
  
  // Atualizar schedule para planned e remover vínculo
  const { error: updateError } = await supabase
    .from("financial_schedules")
    .update({
      status: 'planned',
      linked_transaction_id: null,
    })
    .eq("id", scheduleId)
    .eq("workspace_id", workspace.id)
  
  if (updateError) {
    throw new Error(`Erro ao desvincular schedule: ${updateError.message}`)
  }
}

/**
 * Tenta fazer match automático entre schedules e transactions
 * 
 * REGRAS:
 * - Match por valor (tolerância de 1 centavo)
 * - Match por data (tolerância configurável em dias, padrão 7)
 * - Match por entidade (mesma entity_id)
 * - Retorna candidatos com score de confiança
 */
export async function autoMatchSchedules(
  transactions: Array<{ id: string; amount: number; date: string; entity_id: string }>,
  options?: {
    dateToleranceDays?: number
    amountToleranceCents?: number
    onlyUnlinked?: boolean
  }
): Promise<MatchCandidate[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const dateToleranceDays = options?.dateToleranceDays ?? 7
  const amountToleranceCents = options?.amountToleranceCents ?? 1
  const onlyUnlinked = options?.onlyUnlinked ?? true
  
  // Buscar schedules não realizados
  let schedulesQuery = supabase
    .from("financial_schedules")
    .select(`
      id,
      due_date,
      amount,
      status,
      commitment_id,
      financial_commitments!inner (
        entity_id
      )
    `)
    .eq("workspace_id", workspace.id)
    .eq("status", 'planned')
  
  if (onlyUnlinked) {
    schedulesQuery = schedulesQuery.is("linked_transaction_id", null)
  }
  
  const { data: schedules, error: schedulesError } = await schedulesQuery
  
  if (schedulesError) {
    throw new Error(`Erro ao buscar schedules: ${schedulesError.message}`)
  }
  
  // Buscar transactions não vinculadas
  const transactionIds = transactions.map(t => t.id)
  
  // Verificar quais transactions já estão vinculadas
  const { data: linkedTransactions, error: linkedError } = await supabase
    .from("financial_schedules")
    .select("linked_transaction_id")
    .eq("workspace_id", workspace.id)
    .in("linked_transaction_id", transactionIds)
    .not("linked_transaction_id", "is", null)
  
  if (linkedError) {
    throw new Error(`Erro ao verificar transactions vinculadas: ${linkedError.message}`)
  }
  
  const linkedIds = new Set((linkedTransactions || []).map(t => t.linked_transaction_id))
  const availableTransactions = transactions.filter(t => !linkedIds.has(t.id))
  
  // Tentar fazer match
  const candidates: MatchCandidate[] = []
  
  for (const schedule of schedules || []) {
    const scheduleAmount = Number(schedule.amount)
    const scheduleDate = parseDateISO(schedule.due_date as string)
    const commitment = (schedule as any).financial_commitments
    const scheduleEntityId = commitment?.entity_id
    
    for (const transaction of availableTransactions) {
      const transactionAmount = Number(transaction.amount)
      const transactionDate = parseDateISO(transaction.date)
      const transactionEntityId = transaction.entity_id
      
      // Calcular evidências
      const amountMatch = amountsMatch(scheduleAmount, transactionAmount, amountToleranceCents)
      const dateDiff = Math.abs(
        Math.floor((scheduleDate.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24))
      )
      const dateMatch = dateDiff <= dateToleranceDays
      const entityMatch = scheduleEntityId === transactionEntityId
      
      // Calcular confiança (0-100)
      let confidence = 0
      
      if (amountMatch) confidence += 50
      if (dateMatch) confidence += 30
      if (entityMatch) confidence += 20
      
      // Apenas adicionar se houver algum match
      if (confidence > 0) {
        candidates.push({
          scheduleId: schedule.id,
          transactionId: transaction.id,
          confidence,
          evidence: {
            amountMatch,
            dateMatch,
            dateDiffDays: dateDiff,
            entityMatch,
          },
        })
      }
    }
  }
  
  // Ordenar por confiança descendente
  candidates.sort((a, b) => b.confidence - a.confidence)
  
  // Remover duplicatas (mesmo schedule ou mesma transaction)
  const seenSchedules = new Set<string>()
  const seenTransactions = new Set<string>()
  const uniqueCandidates: MatchCandidate[] = []
  
  for (const candidate of candidates) {
    if (!seenSchedules.has(candidate.scheduleId) && !seenTransactions.has(candidate.transactionId)) {
      seenSchedules.add(candidate.scheduleId)
      seenTransactions.add(candidate.transactionId)
      uniqueCandidates.push(candidate)
    }
  }
  
  return uniqueCandidates
}

/**
 * Aplica matches automáticos (vincula schedules com transactions)
 * 
 * REGRAS:
 * - Aplica apenas matches com confiança >= threshold (padrão 80)
 * - Aplica em ordem de confiança (maior primeiro)
 */
export async function applyAutoMatches(
  candidates: MatchCandidate[],
  confidenceThreshold: number = 80
): Promise<number> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Filtrar por threshold
  const validCandidates = candidates.filter(c => c.confidence >= confidenceThreshold)
  
  let appliedCount = 0
  
  // Aplicar matches (em ordem de confiança)
  for (const candidate of validCandidates) {
    try {
      await linkTransactionToSchedule(candidate.scheduleId, candidate.transactionId)
      appliedCount++
    } catch (error) {
      // Se falhar (ex: já vinculado), continua com o próximo
      console.error(`Erro ao aplicar match ${candidate.scheduleId} -> ${candidate.transactionId}:`, error)
    }
  }
  
  return appliedCount
}

/**
 * MC4.3.1-AUTO: Realiza um schedule no Ledger (cria transaction automaticamente)
 * 
 * REGRAS:
 * - Cria transaction com dados do schedule
 * - Vincula schedule à transaction
 * - Atualiza status do schedule (realized/received/paid)
 * - Grava audit log
 */
export async function realizeScheduleToLedger(options: {
  scheduleKind: 'commitment' | 'contract'
  scheduleId: string
  overrideDate?: string | Date
  overrideAccountId?: string | null
}): Promise<{ transactionId: string; scheduleUpdated: boolean }> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  let schedule: FinancialSchedule | ContractSchedule | null = null
  let entityId: string
  let amount: number
  let dueDate: string
  let description: string
  let transactionType: 'income' | 'expense'

  // Buscar schedule baseado no tipo
  if (options.scheduleKind === 'commitment') {
    const { data: fs, error: fsError } = await supabase
      .from("financial_schedules")
      .select(`
        *,
        financial_commitments!inner (
          entity_id,
          type,
          description
        )
      `)
      .eq("id", options.scheduleId)
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .single()

    if (fsError || !fs) {
      throw new Error("Schedule de compromisso não encontrado")
    }

    const commitment = (fs as any).financial_commitments
    if (!commitment) {
      throw new Error("Compromisso associado ao schedule não encontrado")
    }

    schedule = fs as FinancialSchedule
    entityId = commitment.entity_id
    amount = Number(fs.amount)
    dueDate = options.overrideDate 
      ? (typeof options.overrideDate === 'string' ? options.overrideDate : formatDateISO(options.overrideDate))
      : fs.due_date
    description = commitment.description || `Compromisso ${commitment.type === 'expense' ? 'Despesa' : 'Receita'}`
    transactionType = commitment.type === 'expense' ? 'expense' : 'income'

    // Validar que não está já vinculado
    if (fs.linked_transaction_id) {
      throw new Error("Schedule já está vinculado a uma transação")
    }

    if (fs.status === 'realized') {
      throw new Error("Schedule já foi realizado")
    }
  } else {
    // contract_schedules
    const { data: cs, error: csError } = await supabase
      .from("contract_schedules")
      .select(`
        *,
        contracts!inner (
          counterparty_entity_id,
          title
        )
      `)
      .eq("id", options.scheduleId)
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .single()

    if (csError || !cs) {
      throw new Error("Schedule de contrato não encontrado")
    }

    const contract = (cs as any).contracts
    if (!contract) {
      throw new Error("Contrato associado ao schedule não encontrado")
    }

    schedule = cs as ContractSchedule
    entityId = contract.counterparty_entity_id
    amount = Number(cs.amount)
    dueDate = options.overrideDate 
      ? (typeof options.overrideDate === 'string' ? options.overrideDate : formatDateISO(options.overrideDate))
      : cs.due_date
    description = contract.title || "Contrato"
    
    // Determinar tipo baseado em type do schedule
    if (cs.type === 'receivable') {
      transactionType = 'income'
    } else {
      transactionType = 'expense'
    }

    // Validar que não está já vinculado
    if (cs.linked_transaction_id) {
      throw new Error("Schedule já está vinculado a uma transação")
    }

    if (cs.status === 'received' || cs.status === 'paid') {
      throw new Error("Schedule já foi realizado")
    }
  }

  // Criar transaction no Ledger
  const transaction = await createTransaction(
    entityId,
    transactionType,
    amount,
    dueDate,
    description,
    options.overrideAccountId || null,
    'BRL'
  )

  // Vincular schedule à transaction
  if (options.scheduleKind === 'commitment') {
    await markScheduleAsRealized(options.scheduleId, transaction.id)
  } else {
    // contract_schedules: atualizar status baseado em type
    const contractSchedule = schedule as ContractSchedule
    const newStatus = contractSchedule.type === 'receivable' ? 'received' : 'paid'
    const { error: updateError } = await supabase
      .from("contract_schedules")
      .update({
        status: newStatus,
        linked_transaction_id: transaction.id,
      })
      .eq("id", options.scheduleId)
      .eq("workspace_id", workspace.id)

    if (updateError) {
      // Tentar fazer rollback da transaction? Por enquanto só log
      console.error("[realization] Erro ao atualizar contract_schedule após criar transaction:", updateError)
      throw new Error(`Erro ao vincular schedule: ${updateError.message}`)
    }
  }

  // Gravar audit log
  await logAudit(
    'realize',
    options.scheduleKind === 'commitment' ? 'financial_schedule' : 'contract_schedule',
    options.scheduleId,
    {
      status: schedule.status,
      linked_transaction_id: null,
    },
    {
      status: options.scheduleKind === 'commitment' 
        ? 'realized' 
        : ((schedule as ContractSchedule).type === 'receivable' ? 'received' : 'paid'),
      linked_transaction_id: transaction.id,
    }
  )

  return {
    transactionId: transaction.id,
    scheduleUpdated: true,
  }
}

