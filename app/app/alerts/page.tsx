import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { listEntities } from "@/lib/entities"
import { evaluateAlerts } from "@/lib/alerts/engine"
import { upsertAlerts, resolveStaleAlerts, listAlerts, getAlertById } from "@/lib/alerts/store"
import { logAudit } from "@/lib/audit"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react"
import Link from "next/link"

async function dismissAlertAction(alertId: string) {
  "use server"

  try {
    const supabase = await createClient()
    const workspace = await getActiveWorkspace()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("Usuário não autenticado")
    }

    // Buscar alerta
    const alert = await getAlertById(alertId)
    if (!alert || alert.workspace_id !== workspace.id) {
      throw new Error("Alerta não encontrado")
    }

    // Atualizar state
    const { error } = await supabase
      .from("alerts")
      .update({
        state: 'dismissed',
        dismissed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .eq("workspace_id", workspace.id)

    if (error) {
      throw new Error(`Erro ao dispensar alerta: ${error.message}`)
    }

    // Audit log
    await logAudit('update', 'alert', alertId, { state: alert.state }, { state: 'dismissed' })

    revalidatePath("/app/alerts")
    revalidatePath("/app/dashboard")
  } catch (err: any) {
    console.error("[alerts:dismiss] Erro:", err)
    throw err
  }
}

async function snoozeAlertAction(alertId: string, days: number = 7) {
  "use server"

  try {
    const supabase = await createClient()
    const workspace = await getActiveWorkspace()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("Usuário não autenticado")
    }

    // Buscar alerta
    const alert = await getAlertById(alertId)
    if (!alert || alert.workspace_id !== workspace.id) {
      throw new Error("Alerta não encontrado")
    }

    // Calcular snoozed_until
    const snoozedUntil = new Date()
    snoozedUntil.setDate(snoozedUntil.getDate() + days)

    // Atualizar state
    const { error } = await supabase
      .from("alerts")
      .update({
        state: 'snoozed',
        snoozed_until: snoozedUntil.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .eq("workspace_id", workspace.id)

    if (error) {
      throw new Error(`Erro ao pausar alerta: ${error.message}`)
    }

    // Audit log
    await logAudit('update', 'alert', alertId, { state: alert.state }, { state: 'snoozed', snoozed_until: snoozedUntil.toISOString() })

    revalidatePath("/app/alerts")
    revalidatePath("/app/dashboard")
  } catch (err: any) {
    console.error("[alerts:snooze] Erro:", err)
    throw err
  }
}

async function reopenAlertAction(alertId: string) {
  "use server"

  try {
    const supabase = await createClient()
    const workspace = await getActiveWorkspace()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("Usuário não autenticado")
    }

    // Buscar alerta
    const alert = await getAlertById(alertId)
    if (!alert || alert.workspace_id !== workspace.id) {
      throw new Error("Alerta não encontrado")
    }

    // Atualizar state
    const { error } = await supabase
      .from("alerts")
      .update({
        state: 'open',
        dismissed_at: null,
        snoozed_until: null,
        resolved_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .eq("workspace_id", workspace.id)

    if (error) {
      throw new Error(`Erro ao reabrir alerta: ${error.message}`)
    }

    // Audit log
    await logAudit('update', 'alert', alertId, { state: alert.state }, { state: 'open' })

    revalidatePath("/app/alerts")
    revalidatePath("/app/dashboard")
  } catch (err: any) {
    console.error("[alerts:reopen] Erro:", err)
    throw err
  }
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; severity?: string; state?: string }> | { entityId?: string; severity?: string; state?: string }
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

  const entityIdFilter = resolvedParams?.entityId && resolvedParams.entityId.trim() !== "" 
    ? resolvedParams.entityId.trim() 
    : null

  const severityFilter = resolvedParams?.severity && ['info', 'warning', 'critical'].includes(resolvedParams.severity)
    ? (resolvedParams.severity as 'info' | 'warning' | 'critical')
    : undefined

  const stateFilter = resolvedParams?.state && ['open', 'dismissed', 'snoozed', 'resolved'].includes(resolvedParams.state)
    ? (resolvedParams.state as 'open' | 'dismissed' | 'snoozed' | 'resolved')
    : undefined

  const workspace = await getActiveWorkspace()
  let entities = []
  let alerts = []

  try {
    entities = await listEntities()

    // Avaliar e persistir alertas
    const proposed = await evaluateAlerts({
      workspaceId: workspace.id,
      entityId: entityIdFilter || null,
      accountId: null,
    })

    await upsertAlerts(proposed, user.id)
    await resolveStaleAlerts(workspace.id)

    // Listar alertas filtrados (apenas open e não snoozed por padrão, a menos que stateFilter esteja definido)
    const listStateFilter = stateFilter || 'open'
    alerts = await listAlerts({
      entityId: entityIdFilter,
      severity: severityFilter,
      state: listStateFilter,
    })

    // Filtrar snoozed se não foi explicitamente solicitado
    if (!stateFilter) {
      const now = new Date()
      alerts = alerts.filter((alert) => {
        if (alert.state === 'snoozed' && alert.snoozed_until) {
          return new Date(alert.snoozed_until) <= now
        }
        return alert.state === 'open'
      })
    }
  } catch (error) {
    console.error("[alerts:page] Erro:", error)
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar alertas</CardTitle>
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

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'warning':
        return 'default'
      case 'info':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4" />
      case 'warning':
        return <AlertCircle className="h-4 w-4" />
      case 'info':
        return <CheckCircle2 className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const buildDrilldownLink = (alert: typeof alerts[0]) => {
    const drill = alert.context?.drill
    if (!drill || !drill.path) {
      return null
    }

    const params = new URLSearchParams(drill.qs || {})
    return `${drill.path}?${params.toString()}`
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Alertas</h1>
          <p className="text-muted-foreground">
            Monitoramento inteligente de riscos financeiros e vencimentos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="get" action="/app/alerts" className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="entityId">Entidade</Label>
                <Select name="entityId" defaultValue={entityIdFilter || "all"}>
                  <SelectTrigger id="entityId">
                    <SelectValue placeholder="Todas as entidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas (Consolidado)</SelectItem>
                    {entities.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.legal_name} ({entity.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="severity">Severidade</Label>
                <Select name="severity" defaultValue={severityFilter || "all"}>
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                    <SelectItem value="warning">Aviso</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Select name="state" defaultValue={stateFilter || "open"}>
                  <SelectTrigger id="state">
                    <SelectValue placeholder="Abertos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Abertos</SelectItem>
                    <SelectItem value="dismissed">Dispensados</SelectItem>
                    <SelectItem value="snoozed">Pausados</SelectItem>
                    <SelectItem value="resolved">Resolvidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-3">
                <Button type="submit">Aplicar Filtros</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas ({alerts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum alerta encontrado para os filtros selecionados.
              </p>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => {
                  const drillLink = buildDrilldownLink(alert)
                  return (
                    <Card key={alert.id} className="border-l-4 border-l-primary">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {getSeverityIcon(alert.severity)}
                              <h3 className="font-semibold text-lg">{alert.title}</h3>
                              <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                                {alert.severity === 'critical' ? 'Crítico' : alert.severity === 'warning' ? 'Aviso' : 'Info'}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">{alert.message}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>
                                Visto em: {new Date(alert.last_seen_at).toLocaleString('pt-BR')}
                              </span>
                              {alert.snoozed_until && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Pausado até: {new Date(alert.snoozed_until).toLocaleString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            {drillLink && (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={drillLink}>Ver Detalhes</Link>
                              </Button>
                            )}
                            {alert.state === 'open' && (
                              <>
                                <form action={dismissAlertAction.bind(null, alert.id)}>
                                  <Button type="submit" variant="outline" size="sm">
                                    Dispensar
                                  </Button>
                                </form>
                                <form action={snoozeAlertAction.bind(null, alert.id, 7)}>
                                  <Button type="submit" variant="outline" size="sm">
                                    Pausar 7 dias
                                  </Button>
                                </form>
                              </>
                            )}
                            {(alert.state === 'dismissed' || alert.state === 'resolved' || alert.state === 'snoozed') && (
                              <form action={reopenAlertAction.bind(null, alert.id)}>
                                <Button type="submit" variant="outline" size="sm">
                                  Reabrir
                                </Button>
                              </form>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

