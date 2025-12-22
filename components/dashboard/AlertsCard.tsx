"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, XCircle, Info } from "lucide-react"
import type { Alert } from "@/lib/alerts/store"

type AlertsCardProps = {
  alerts: Alert[]
}

export function AlertsCard({ alerts }: AlertsCardProps) {
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.state === 'open').length
  const warningCount = alerts.filter((a) => a.severity === 'warning' && a.state === 'open').length
  const topAlerts = alerts
    .filter((a) => a.state === 'open' && (a.severity === 'critical' || a.severity === 'warning'))
    .slice(0, 3)

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
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

  const buildDrilldownLink = (alert: Alert) => {
    const drill = alert.context?.drill
    if (!drill || !drill.path) {
      return '/app/alerts'
    }

    const params = new URLSearchParams(drill.qs || {})
    return `${drill.path}?${params.toString()}`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Alertas</CardTitle>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge variant="destructive">
              {criticalCount} Crítico{criticalCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="default">
              {warningCount} Aviso{warningCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {topAlerts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum alerta crítico ou de aviso no momento.
          </p>
        ) : (
          <div className="space-y-3">
            {topAlerts.map((alert) => {
              const drillLink = buildDrilldownLink(alert)
              return (
                <div key={alert.id} className="flex items-start gap-2 p-2 rounded-md border">
                  <div className="flex-shrink-0 mt-0.5">
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{alert.title}</p>
                      <Badge variant={getSeverityBadgeVariant(alert.severity)} className="text-xs">
                        {alert.severity === 'critical' ? 'Crítico' : alert.severity === 'warning' ? 'Aviso' : 'Info'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
                    {drillLink && (
                      <Link href={drillLink} className="text-xs text-primary hover:underline mt-1 inline-block">
                        Ver detalhes →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/app/alerts">Ver todos os alertas</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

