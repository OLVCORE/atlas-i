/**
 * MC9: Motor de Avaliação de Alertas
 * 
 * Avalia condições e propõe alertas baseados nos dados financeiros
 */

import { getMonthlyCashflowMatrix, type MonthlyCashflowFilters } from "@/lib/cashflow/monthly"
import { listSchedulesByPeriod } from "@/lib/schedules"
import { getCashPositionSummary } from "@/lib/accounts/balances"
import { formatDateISO } from "@/lib/utils/dates"

export type ProposedAlert = {
  workspace_id: string
  entity_id?: string | null
  account_id?: string | null
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  fingerprint: string
  context: Record<string, any>
}

type EvaluateAlertsParams = {
  workspaceId: string
  entityId?: string | null
  accountId?: string | null
}

/**
 * Avalia condições e retorna lista de alertas propostos
 */
export async function evaluateAlerts(
  params: EvaluateAlertsParams
): Promise<ProposedAlert[]> {
  const alerts: ProposedAlert[] = []

  // Calcular período: mês atual e próximos 6 meses
  const today = new Date()
  const fromMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const toMonth = new Date(today.getFullYear(), today.getMonth() + 6, 1)
  const fromMonthStr = formatDateISO(fromMonth).slice(0, 7) + '-01'
  const toMonthStr = formatDateISO(toMonth).slice(0, 7) + '-01'

  // Filtros para cashflow
  const cashflowFilters: MonthlyCashflowFilters = {
    from_month: fromMonthStr,
    to_month: toMonthStr,
    entity_id: params.entityId || undefined,
    account_id: params.accountId || undefined,
  }

  try {
    // 1. Cash Negative Forecast
    const matrix = await getMonthlyCashflowMatrix(cashflowFilters)
    const minBalanceAdj = matrix.metadata.min_cum_balance_adj
    if (minBalanceAdj !== null && minBalanceAdj !== undefined && minBalanceAdj < 0) {
      const minBalance = minBalanceAdj
      const minMonth = matrix.metadata.min_cum_month || matrix.metadata.min_projected_month
      const severity: 'warning' | 'critical' = minBalance <= -5000 ? 'critical' : 'warning'
      
      alerts.push({
        workspace_id: params.workspaceId,
        entity_id: params.entityId || null,
        account_id: params.accountId || null,
        type: 'cash_negative',
        severity,
        title: 'Previsão de Caixa Negativo',
        message: `Caixa projetado ficará negativo em ${minMonth ? new Date(minMonth + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'futuro'}. Saldo mínimo projetado: R$ ${Math.abs(minBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        fingerprint: `cash_negative:${params.entityId || 'all'}:${params.accountId || 'all'}:${minMonth || 'unknown'}`,
        context: {
          min_balance: minBalance,
          min_month: minMonth,
          drill: {
            path: '/app/cashflow',
            qs: {
              view: 'monthly',
              from_month: fromMonthStr,
              to_month: toMonthStr,
              ...(params.entityId ? { entity_id: params.entityId } : {}),
              ...(params.accountId ? { account_id: params.accountId } : {}),
            },
          },
        },
      })
    }

    // 2. Worst Point Approaching (próximos 30 dias ou mês atual/próximo)
    if (matrix.metadata.min_cum_month) {
      const minMonthDate = new Date(matrix.metadata.min_cum_month + 'T00:00:00')
      const daysUntilWorst = Math.floor((minMonthDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const worstBalance = matrix.metadata.min_cum_balance_adj || matrix.metadata.min_cum_balance || 0
      
      if (daysUntilWorst >= 0 && daysUntilWorst <= 30) {
        alerts.push({
          workspace_id: params.workspaceId,
          entity_id: params.entityId || null,
          account_id: params.accountId || null,
          type: 'worst_point_soon',
          severity: 'warning',
          title: 'Pior Ponto de Caixa Aproximando-se',
          message: `O pior ponto projetado do fluxo de caixa ocorrerá em ${minMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} (em ${daysUntilWorst} dias). Saldo mínimo: R$ ${Math.abs(worstBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
          fingerprint: `worst_point_soon:${params.entityId || 'all'}:${params.accountId || 'all'}:${matrix.metadata.min_cum_month}`,
          context: {
            min_month: matrix.metadata.min_cum_month,
            min_balance: worstBalance,
            days_until: daysUntilWorst,
            drill: {
              path: '/app/cashflow',
              qs: {
                view: 'monthly',
                from_month: fromMonthStr,
                to_month: toMonthStr,
                ...(params.entityId ? { entity_id: params.entityId } : {}),
                ...(params.accountId ? { account_id: params.accountId } : {}),
              },
            },
          },
        })
      }
    }

    // 3. Schedules Due Soon (próximos 7 dias)
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    const sevenDaysStr = formatDateISO(sevenDaysFromNow)
    const todayStr = formatDateISO(today)

    const schedulesDueSoon = await listSchedulesByPeriod(
      todayStr,
      sevenDaysStr,
      {
        status: 'planned',
        entityId: params.entityId || undefined,
      }
    )

    if (schedulesDueSoon.length > 0) {
      const totalDueAmount = schedulesDueSoon.reduce((sum, s) => sum + Number(s.amount), 0)
      const threshold = 10000 // R$ 10.000
      const severity: 'warning' | 'critical' = totalDueAmount >= threshold ? 'critical' : 'warning'
      const dateBucket = formatDateISO(today).slice(0, 7) // YYYY-MM

      alerts.push({
        workspace_id: params.workspaceId,
        entity_id: params.entityId || null,
        account_id: null,
        type: 'schedules_due_soon',
        severity,
        title: 'Parcelas Vencendo em Breve',
        message: `${schedulesDueSoon.length} parcela(s) vence(m) nos próximos 7 dias. Valor total: R$ ${totalDueAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        fingerprint: `schedules_due_soon:${params.entityId || 'all'}:${dateBucket}`,
        context: {
          count: schedulesDueSoon.length,
          total_amount: totalDueAmount,
          schedule_ids: schedulesDueSoon.map((s) => s.id),
          drill: {
            path: '/app/schedules',
            qs: {
              startDate: todayStr,
              endDate: sevenDaysStr,
              ...(params.entityId ? { commitmentId: params.entityId } : {}),
            },
          },
        },
      })
    }

    // 4. Overdue Schedules (vencidos)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = formatDateISO(yesterday)
    const pastStartStr = '2000-01-01' // Data bem antiga para pegar todos os vencidos

    const overdueSchedules = await listSchedulesByPeriod(
      pastStartStr,
      yesterdayStr,
      {
        status: 'planned',
        entityId: params.entityId || undefined,
      }
    )

    if (overdueSchedules.length > 0) {
      const totalOverdueAmount = overdueSchedules.reduce((sum, s) => sum + Number(s.amount), 0)
      const dateBucket = formatDateISO(today).slice(0, 7)

      alerts.push({
        workspace_id: params.workspaceId,
        entity_id: params.entityId || null,
        account_id: null,
        type: 'schedules_overdue',
        severity: 'critical',
        title: 'Parcelas Vencidas',
        message: `${overdueSchedules.length} parcela(s) vencida(s). Valor total: R$ ${totalOverdueAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        fingerprint: `schedules_overdue:${params.entityId || 'all'}:${dateBucket}`,
        context: {
          count: overdueSchedules.length,
          total_amount: totalOverdueAmount,
          schedule_ids: overdueSchedules.map((s) => s.id),
          drill: {
            path: '/app/schedules',
            qs: {
              startDate: pastStartStr,
              endDate: yesterdayStr,
              ...(params.entityId ? { commitmentId: params.entityId } : {}),
            },
          },
        },
      })
    }

    // 5. Risk Concentration by Entity (apenas para consolidado, sem entityId)
    if (!params.entityId && !params.accountId) {
      // Buscar cashflow consolidado para todas as entidades
      const consolidatedMatrix = await getMonthlyCashflowMatrix({
        from_month: fromMonthStr,
        to_month: toMonthStr,
        entity_id: undefined,
        account_id: undefined,
      })

      if (consolidatedMatrix.months.length > 0) {
        // Buscar schedules próximos por entidade (simplificado: usar commitments)
        // Para MVP, vamos calcular concentração baseada no pior ponto por entidade
        // Isso requer buscar schedules por entidade - por enquanto, pulamos este alerta
        // ou implementamos de forma simplificada
        // TODO: Implementar análise de concentração por entidade quando necessário
      }
    }
  } catch (error) {
    // Log erro mas não falha completamente
    console.error('[alerts:engine] Erro ao avaliar alertas:', error)
  }

  return alerts
}

