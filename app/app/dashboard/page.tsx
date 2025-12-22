import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getExecutiveDashboardKPIs } from "@/lib/dashboard/kpis"
import { listEntities } from "@/lib/entities"
import { listAccounts } from "@/lib/accounts/list"
import { getActiveWorkspace } from "@/lib/workspace"
import { evaluateAlerts } from "@/lib/alerts/engine"
import { upsertAlerts, resolveStaleAlerts, listAlerts } from "@/lib/alerts/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExecutiveDashboardFilters } from "@/components/dashboard/ExecutiveDashboardFilters"
import { ExecutiveKpiCards } from "@/components/dashboard/ExecutiveKpiCards"
import { AlertsCard } from "@/components/dashboard/AlertsCard"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    from_month?: string
    to_month?: string
    entity_id?: string
    show?: 'both' | 'planned' | 'realised'
  }> | { 
    from_month?: string
    to_month?: string
    entity_id?: string
    show?: 'both' | 'planned' | 'realised'
  }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Resolver searchParams se for Promise (Next.js 15)
  const resolvedParams = searchParams && typeof (searchParams as any).then === 'function' 
    ? await (searchParams as Promise<any>)
    : (searchParams as any)

  // Calcular período padrão: mês atual até 12 meses à frente
  const today = new Date()
  const currentMonthFirstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const futureMonthFirstDay = new Date(today.getFullYear(), today.getMonth() + 12, 1)
  const fromMonthDefault = currentMonthFirstDay.toISOString().split('T')[0].slice(0, 7) + '-01'
  const toMonthDefault = futureMonthFirstDay.toISOString().split('T')[0].slice(0, 7) + '-01'

  const fromMonth = resolvedParams?.from_month?.trim() || fromMonthDefault
  const toMonth = resolvedParams?.to_month?.trim() || toMonthDefault
  const entityId = resolvedParams?.entity_id?.trim() || undefined
  const accountId = resolvedParams?.account_id?.trim() || undefined
  const showMode = (resolvedParams?.show === 'planned' || resolvedParams?.show === 'realised') 
    ? resolvedParams.show 
    : 'both'

  const workspace = await getActiveWorkspace()

  let kpis
  let entities = []
  let accounts = []
  let alerts = []

  try {
    entities = await listEntities()
    accounts = await listAccounts({ workspaceId: workspace.id })

    // Avaliar e persistir alertas
    const proposed = await evaluateAlerts({
      workspaceId: workspace.id,
      entityId: entityId || null,
      accountId: accountId || null,
    })
    await upsertAlerts(proposed, user.id)
    await resolveStaleAlerts(workspace.id)

    // Buscar alertas open (top críticos e avisos)
    alerts = await listAlerts({
      entityId: entityId || null,
      state: 'open',
    })
    // Filtrar snoozed expirados e ordenar por severity
    const now = new Date()
    alerts = alerts
      .filter((alert) => {
        if (alert.state === 'snoozed' && alert.snoozed_until) {
          return new Date(alert.snoozed_until) <= now
        }
        return alert.state === 'open'
      })
      .sort((a, b) => {
        const severityOrder = { critical: 3, warning: 2, info: 1 }
        return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
      })

    kpis = await getExecutiveDashboardKPIs({
      from_month: fromMonth,
      to_month: toMonth,
      entity_id: entityId,
      account_id: accountId,
      show: showMode,
    })
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Executivo</h1>
          <p className="text-muted-foreground mt-2">
            Visão consolidada de KPIs financeiros e métricas-chave do período.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Executivo</h1>
        <p className="text-muted-foreground mt-2">
          Visão consolidada de KPIs financeiros e métricas-chave do período.
        </p>
      </div>

      {/* Card de Alertas no topo */}
      <AlertsCard alerts={alerts} />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <ExecutiveDashboardFilters entities={entities} accounts={accounts.map(a => ({ id: a.id, name: a.name, entity_id: a.entity_id }))} />
          {accountId && showMode === 'planned' && (
            <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Previsto não é filtrado por conta. Selecione &quot;Realizado&quot; para visão por conta.
            </div>
          )}
        </CardContent>
      </Card>

      {!kpis.hasData ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">
                Sem dados no período selecionado.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Ajuste os filtros ou cadastre compromissos, contratos e transações para visualizar os KPIs.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ExecutiveKpiCards 
          kpis={kpis} 
          filters={{
            from_month: fromMonth,
            to_month: toMonth,
            entity_id: entityId,
            account_id: accountId,
            show: showMode,
          }}
        />
      )}
    </div>
  )
}
