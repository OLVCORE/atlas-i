import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCashflow } from "@/lib/cashflow"
import { getMonthlyCashflowMatrix } from "@/lib/cashflow/monthly"
import { listEntities } from "@/lib/entities"
import { listAccounts } from "@/lib/accounts/list"
import { getActiveWorkspace } from "@/lib/workspace"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CashflowTableClient } from "@/components/cashflow-table-client"
import { CashflowPeriodFilter } from "@/components/cashflow-period-filter"
import { CashflowViewTabs } from "@/components/cashflow/CashflowViewTabs"
import { CashflowMonthlyMatrixClient } from "@/components/cashflow/CashflowMonthlyMatrixClient"
import { CashflowMonthlyFilters } from "@/components/cashflow/CashflowMonthlyFilters"

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    from?: string
    to?: string
    granularity?: 'day' | 'month'
    view?: 'monthly' | 'operational'
    from_month?: string
    to_month?: string
    entity_id?: string
    show?: 'both' | 'planned' | 'realised'
  }> | { 
    from?: string
    to?: string
    granularity?: 'day' | 'month'
    view?: 'monthly' | 'operational'
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

  const view = resolvedParams?.view || 'monthly'

  // Calcular período padrão para visão operacional: próximos 90 dias
  const today = new Date()
  const fromDefault = today.toISOString().split('T')[0]
  const toDefault = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Período padrão para visão mensal: mês atual até 12 meses à frente
  const currentMonthFirstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const futureMonthFirstDay = new Date(today.getFullYear(), today.getMonth() + 12, 1)
  const fromMonthDefault = currentMonthFirstDay.toISOString().split('T')[0].slice(0, 7) + '-01'
  const toMonthDefault = futureMonthFirstDay.toISOString().split('T')[0].slice(0, 7) + '-01'

  const from = resolvedParams?.from?.trim() || fromDefault
  const to = resolvedParams?.to?.trim() || toDefault
  const granularity = (resolvedParams?.granularity === 'day' || resolvedParams?.granularity === 'month') 
    ? resolvedParams.granularity 
    : 'month'

  const fromMonth = resolvedParams?.from_month?.trim() || fromMonthDefault
  const toMonth = resolvedParams?.to_month?.trim() || toMonthDefault
  const entityId = resolvedParams?.entity_id?.trim() || undefined
  const accountId = resolvedParams?.account_id?.trim() || undefined
  const showMode = resolvedParams?.show || 'both'

  const workspace = await getActiveWorkspace()

  let cashflow
  let monthlyCashflow
  let entities = []
  let accounts = []

  try {
    entities = await listEntities()
    accounts = await listAccounts({ workspaceId: workspace.id })
    
    if (view === 'monthly') {
      monthlyCashflow = await getMonthlyCashflowMatrix({
        from_month: fromMonth,
        to_month: toMonth,
        entity_id: entityId,
        account_id: accountId,
      })
    } else {
      cashflow = await getCashflow({ from, to, granularity })
    }
  } catch (error) {
    return (
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar fluxo de caixa</CardTitle>
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
        <h1 className="text-3xl font-bold">Fluxo de Caixa</h1>
        <p className="text-muted-foreground mt-2">
          Previsto x Realizado. Visualize o fluxo de caixa previsto (baseado em cronogramas) e realizado (baseado no ledger).
        </p>
        {accountId && (
          <p className="text-sm text-muted-foreground mt-1">
            Conta: {accounts.find((a) => a.id === accountId)?.name || accountId} {entityId ? `- ${entities.find((e) => e.id === entityId)?.legal_name || entityId}` : "(consolidado)"}
          </p>
        )}
        {!accountId && (
          <p className="text-sm text-muted-foreground mt-1">
            Conta: Todas as contas (consolidado)
          </p>
        )}
      </div>

      <CashflowViewTabs defaultView="monthly">
        {{
          monthly: (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Filtros Mensais</CardTitle>
                </CardHeader>
                <CardContent>
                  <CashflowMonthlyFilters entities={entities} accounts={accounts.map(a => ({ id: a.id, name: a.name, entity_id: a.entity_id }))} />
                  {accountId && showMode === 'planned' && (
                    <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                      Previsto não é filtrado por conta. Selecione &quot;Realizado&quot; para visão por conta.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Matriz Mensal — Previsto x Realizado</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthlyCashflow ? (
                    <CashflowMonthlyMatrixClient 
                      months={monthlyCashflow.months} 
                      metadata={monthlyCashflow.metadata}
                      showMode={showMode} 
                    />
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Carregando dados...
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ),
          operational: (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Filtros de Período</CardTitle>
                </CardHeader>
                <CardContent>
                  <CashflowPeriodFilter />
                </CardContent>
              </Card>

              {cashflow && (
                <>
                  {/* Cards de resumo */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Previsto (Entradas - Saídas)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(cashflow.total_saldo_previsto)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Entradas: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cashflow.total_previsto_entradas)} | 
                          Saídas: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cashflow.total_previsto_saidas)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Realizado (Entradas - Saídas)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(cashflow.total_saldo_realizado)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Entradas: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cashflow.total_realizado_entradas)} | 
                          Saídas: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cashflow.total_realizado_saidas)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Diferença</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${cashflow.total_saldo_realizado >= cashflow.total_saldo_previsto ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(cashflow.total_saldo_realizado - cashflow.total_saldo_previsto)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Fluxo por Período</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CashflowTableClient cashflow={cashflow} granularity={granularity} />
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          ),
        }}
      </CashflowViewTabs>
    </div>
  )
}
