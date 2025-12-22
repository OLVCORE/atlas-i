"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ExecutiveDashboardKPIs } from "@/lib/dashboard/kpis"
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"

type ExecutiveKpiCardsProps = {
  kpis: ExecutiveDashboardKPIs
  filters: {
    from_month: string
    to_month: string
    entity_id?: string
    account_id?: string
    show?: 'both' | 'planned' | 'realised'
  }
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatMonth = (monthStart: string | null) => {
  if (!monthStart) return "N/A"
  const date = new Date(monthStart + "T00:00:00")
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
}

const buildCashflowLink = (filters: ExecutiveKpiCardsProps['filters']) => {
  const params = new URLSearchParams({
    view: "monthly",
    from_month: filters.from_month,
    to_month: filters.to_month,
  })
  if (filters.entity_id) params.set("entity_id", filters.entity_id)
  if (filters.account_id) params.set("account_id", filters.account_id)
  if (filters.show && filters.show !== "both") params.set("show", filters.show)
  return `/app/cashflow?${params.toString()}`
}

export function ExecutiveKpiCards({ kpis, filters }: ExecutiveKpiCardsProps) {
  if (!kpis.hasData || !kpis.current_month || !kpis.month_totals || !kpis.deltas) {
    return null
  }

  const cashflowLink = buildCashflowLink(filters)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Saldo Acumulado */}
      <Link href={cashflowLink}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Saldo Acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-muted-foreground">Previsto</div>
                <div className={`text-xl font-semibold ${kpis.current_month.planned_cum < 0 ? 'text-destructive' : ''}`}>
                  {formatCurrency(kpis.current_month.planned_cum)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Realizado</div>
                <div className={`text-xl font-semibold ${kpis.current_month.realised_cum < 0 ? 'text-destructive' : ''}`}>
                  {formatCurrency(kpis.current_month.realised_cum)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Saldo do Mês */}
      <Link href={cashflowLink}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-muted-foreground">Previsto</div>
                <div className={`text-xl font-semibold ${kpis.current_month.planned_net < 0 ? 'text-destructive' : ''}`}>
                  {formatCurrency(kpis.current_month.planned_net)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Realizado</div>
                <div className={`text-xl font-semibold ${kpis.current_month.realised_net < 0 ? 'text-destructive' : ''}`}>
                  {formatCurrency(kpis.current_month.realised_net)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Receitas do Mês */}
      <Link href={cashflowLink}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Receitas do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-muted-foreground">Previsto</div>
                <div className="text-xl font-semibold">
                  {formatCurrency(kpis.month_totals.planned_income)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Realizado</div>
                <div className="text-xl font-semibold">
                  {formatCurrency(kpis.month_totals.realised_income)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Despesas do Mês */}
      <Link href={cashflowLink}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-muted-foreground">Previsto</div>
                <div className="text-xl font-semibold text-destructive">
                  {formatCurrency(kpis.month_totals.planned_expense)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Realizado</div>
                <div className="text-xl font-semibold text-destructive">
                  {formatCurrency(kpis.month_totals.realised_expense)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Desvios */}
      <Link href={cashflowLink}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Desvios (Realizado - Previsto)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Δ Receita</div>
                <div className={`text-lg font-semibold flex items-center gap-2 ${kpis.deltas.income_delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  {kpis.deltas.income_delta >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {formatCurrency(Math.abs(kpis.deltas.income_delta))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Δ Despesa</div>
                <div className={`text-lg font-semibold flex items-center gap-2 ${kpis.deltas.expense_delta <= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  {kpis.deltas.expense_delta <= 0 ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  {formatCurrency(Math.abs(kpis.deltas.expense_delta))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Caixa Atual (Hoje) */}
      {kpis.cash_today && (
        <Link href="/app/accounts">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Caixa Atual (Hoje)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-semibold">
                    {formatCurrency(kpis.cash_today.starting_balance)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Total consolidado
                  </div>
                </div>
                <div className="space-y-1 pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Conta Corrente</span>
                    <span className="font-medium">
                      {formatCurrency(kpis.cash_today.checking_total ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Investimentos</span>
                    <span className="font-medium">
                      {formatCurrency(kpis.cash_today.investment_total ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Pior Ponto do Período */}
      {kpis.worst_point && (
        <Link href={cashflowLink}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Pior Ponto do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">Mês</div>
                  <div className="text-lg font-semibold">
                    {formatMonth(kpis.worst_point.min_cum_month)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Saldo Mínimo</div>
                  <div className={`text-xl font-semibold ${kpis.worst_point.min_cum_balance < 0 ? 'text-destructive' : ''}`}>
                    {formatCurrency(kpis.worst_point.min_cum_balance)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Pior Ponto Projetado */}
      {kpis.worst_projected_point && (
        <Link href={cashflowLink}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Pior Ponto Projetado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">Mês</div>
                  <div className="text-lg font-semibold">
                    {formatMonth(kpis.worst_projected_point.min_projected_month)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Saldo Mínimo Projetado</div>
                  <div className={`text-xl font-semibold ${kpis.worst_projected_point.min_projected_balance < 0 ? 'text-destructive' : ''}`}>
                    {formatCurrency(kpis.worst_projected_point.min_projected_balance)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  )
}

