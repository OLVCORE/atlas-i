/**
 * MC8.4 CP3: Motor Unificado de Cronogramas Financeiros (Operacional)
 * 
 * Funções para criar cronogramas operacionais (não-cartão)
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { formatDateISO, parseDateISO } from "@/lib/utils/dates"
import { divideAmount, sumAmounts, amountsMatch } from "@/lib/utils/money"
import { logAudit } from "@/lib/audit"
import type { FinancialSchedule } from "@/lib/schedules"
import { generateRecurrenceDates } from "@/lib/utils/dates"

export type RecurringMonthlyPlan = {
  mode: 'recurring'
  entityId: string
  type: 'expense' | 'revenue'
  description: string
  monthlyAmount: number
  startDate: string // ISO date YYYY-MM-DD
  endDate: string | null // ISO date YYYY-MM-DD ou null para sem data final
  category?: string | null
  accountId?: string | null
}

export type InstallmentPlan = {
  mode: 'installment'
  entityId: string
  type: 'expense' | 'revenue'
  description: string
  totalAmount: number
  baseDate: string // ISO date YYYY-MM-DD
  installmentType: 'entry_plus_installments' | 'custom_dates'
  // Para entry_plus_installments
  entryAmount?: number
  numberOfInstallments?: number
  installmentIntervalDays?: number
  // Para custom_dates
  customSchedules?: Array<{ date: string; amount: number }>
  category?: string | null
  accountId?: string | null
}

export type OperationalSchedulePlan = RecurringMonthlyPlan | InstallmentPlan

/**
 * Cria schedules customizados (parcelas com datas/valores específicos)
 */
async function createCustomSchedules(
  commitmentId: string,
  customSchedules: Array<{ date: string; amount: number }>
): Promise<FinancialSchedule[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  if (customSchedules.length === 0) {
    throw new Error("Nenhum schedule customizado fornecido")
  }

  // Validar que a soma dos valores está correta (será validado no totalAmount do commitment)
  const schedulesToInsert = customSchedules.map((s) => ({
    commitment_id: commitmentId,
    workspace_id: workspace.id,
    due_date: s.date,
    amount: s.amount,
    status: 'planned' as const,
    linked_transaction_id: null,
  }))

  const { data: schedules, error: insertError } = await supabase
    .from("financial_schedules")
    .insert(schedulesToInsert)
    .select()

  if (insertError) {
    throw new Error(`Erro ao criar schedules customizados: ${insertError.message}`)
  }

  return schedules || []
}

/**
 * Cria commitment operacional com schedules
 * 
 * Para modo recurring: cria commitment mensal e gera 12 meses (ou até endDate se fornecido)
 * Para modo installment: cria commitment com parcelas customizadas
 */
export async function createOperationalCommitmentWithSchedules(
  plan: OperationalSchedulePlan
): Promise<{ commitmentId: string; schedulesCount: number }> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  if (plan.mode === 'recurring') {
    // MODO A: Recorrente Mensal
    const startDate = parseDateISO(plan.startDate)
    
    // Se não tem endDate, limitar a 12 meses
    let endDate: Date
    if (plan.endDate) {
      endDate = parseDateISO(plan.endDate)
    } else {
      // Sem data final: gerar apenas 12 meses
      const endDate12Months = new Date(startDate)
      endDate12Months.setMonth(endDate12Months.getMonth() + 12)
      endDate = endDate12Months
    }

    // Validar que endDate >= startDate
    if (endDate < startDate) {
      throw new Error("Data final deve ser maior ou igual à data inicial")
    }

    // Gerar schedules usando generateRecurrenceDates
    const scheduleDates = generateRecurrenceDates(startDate, endDate, 'monthly')
    
    // Valor total = monthlyAmount * número de meses gerados
    const totalAmount = plan.monthlyAmount * scheduleDates.length
    
    // Cada schedule recebe o valor mensal (não dividir, cada um é o valor mensal)
    const scheduleAmounts = scheduleDates.map(() => plan.monthlyAmount)

    // Criar commitment diretamente com status='active'
    const { data: commitment, error: commitmentError } = await supabase
      .from("financial_commitments")
      .insert({
        workspace_id: workspace.id,
        entity_id: plan.entityId,
        type: plan.type,
        category: plan.category || null,
        description: plan.description,
        total_amount: totalAmount,
        currency: 'BRL',
        status: 'active',
        start_date: plan.startDate,
        end_date: formatDateISO(endDate),
        recurrence: 'monthly',
      })
      .select()
      .single()

    if (commitmentError || !commitment) {
      throw new Error(`Erro ao criar compromisso: ${commitmentError?.message || 'Erro desconhecido'}`)
    }

    // Criar audit log antes de criar schedules
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await logAudit(
        'create',
        'commitment',
        commitment.id,
        null,
        {
          mode: 'recurring',
          total_schedules: scheduleDates.length,
          total_amount: totalAmount,
          monthly_amount: plan.monthlyAmount,
        }
      )
    }

    // Criar schedules
    const schedulesToInsert = scheduleDates.map((date, index) => ({
      commitment_id: commitment.id,
      workspace_id: workspace.id,
      due_date: formatDateISO(date),
      amount: scheduleAmounts[index],
      status: 'planned' as const,
      linked_transaction_id: null,
    }))

    const { data: schedules, error: schedulesError } = await supabase
      .from("financial_schedules")
      .insert(schedulesToInsert)
      .select("id")

    if (schedulesError) {
      throw new Error(`Erro ao criar schedules: ${schedulesError.message}`)
    }

    return {
      commitmentId: commitment.id,
      schedulesCount: scheduleDates.length,
    }
  } else {
    // MODO B: Parcelado / Marcos
    let schedulesToCreate: Array<{ date: string; amount: number }> = []

    if (plan.installmentType === 'entry_plus_installments') {
      // Entrada + parcelas iguais
      if (!plan.entryAmount || !plan.numberOfInstallments || !plan.installmentIntervalDays) {
        throw new Error("Para parcelamento com entrada, informe: valor da entrada, número de parcelas e intervalo")
      }

      const remainingAmount = plan.totalAmount - plan.entryAmount
      if (remainingAmount < 0) {
        throw new Error("Valor da entrada não pode ser maior que o valor total")
      }

      // Dividir o restante entre as parcelas
      const installmentAmounts = divideAmount(remainingAmount, plan.numberOfInstallments)

      // Primeira parcela: entrada (na data base)
      schedulesToCreate.push({
        date: plan.baseDate,
        amount: plan.entryAmount,
      })

      // Próximas parcelas: intervalos de dias
      let currentDate = parseDateISO(plan.baseDate)
      for (let i = 0; i < plan.numberOfInstallments; i++) {
        currentDate = new Date(currentDate)
        currentDate.setDate(currentDate.getDate() + plan.installmentIntervalDays)
        schedulesToCreate.push({
          date: formatDateISO(currentDate),
          amount: installmentAmounts[i],
        })
      }
    } else {
      // Datas customizadas
      if (!plan.customSchedules || plan.customSchedules.length === 0) {
        throw new Error("Para parcelamento customizado, informe as datas e valores")
      }

      schedulesToCreate = plan.customSchedules

      // Validar que a soma = totalAmount
      const sum = sumAmounts(schedulesToCreate.map((s) => s.amount))
      if (!amountsMatch(sum, plan.totalAmount)) {
        throw new Error(`Soma dos valores customizados (${sum}) não confere com valor total (${plan.totalAmount})`)
      }
    }

    // Criar commitment diretamente com status='active' (sem recorrência, pois vamos criar schedules custom)
    const { data: commitment, error: commitmentError } = await supabase
      .from("financial_commitments")
      .insert({
        workspace_id: workspace.id,
        entity_id: plan.entityId,
        type: plan.type,
        category: plan.category || null,
        description: plan.description,
        total_amount: plan.totalAmount,
        currency: 'BRL',
        status: 'active',
        start_date: schedulesToCreate[0].date, // Primeira data
        end_date: schedulesToCreate[schedulesToCreate.length - 1].date, // Última data
        recurrence: 'none', // Sem recorrência, pois são customizados
      })
      .select()
      .single()

    if (commitmentError || !commitment) {
      throw new Error(`Erro ao criar compromisso: ${commitmentError?.message || 'Erro desconhecido'}`)
    }

    // Criar schedules customizados
    const schedules = await createCustomSchedules(commitment.id, schedulesToCreate)

    // Auditoria adicional com metadados (já existe audit log do createCommitment, mas adicionamos metadata)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // logAudit já foi chamado indiretamente, mas vamos garantir metadados específicos
      // Nota: O audit log principal será criado pelo createCommitment (mas não usamos ele aqui)
      // Criar audit log específico para operacional
      await logAudit(
        'create',
        'commitment',
        commitment.id,
        null,
        {
          mode: 'installment',
          installment_type: plan.installmentType,
          total_schedules: schedules.length,
          total_amount: plan.totalAmount,
        }
      )
    }

    return {
      commitmentId: commitment.id,
      schedulesCount: schedules.length,
    }
  }
}

