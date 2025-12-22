import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listEntities } from "@/lib/entities"
import { listCards } from "@/lib/cards/purchases"
import { listInstallmentsByCardAndPeriod, listInstallmentsByEntityAndPeriod } from "@/lib/cards/installments"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InstallmentsTableClient } from "@/components/installments-table-client"

export default async function InstallmentsPage({
  searchParams,
}: {
  searchParams: { entityId?: string; cardId?: string; startMonth?: string; endMonth?: string; status?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let entities = []
  let cards = []
  let installments = []
  
  try {
    entities = await listEntities()
    cards = await listCards()
    
    // Determinar período padrão (mês atual e próximos 2 meses)
    const now = new Date()
    const defaultStartMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    const defaultEndMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString().split("T")[0]
    
    const startMonth = searchParams.startMonth || defaultStartMonth
    const endMonth = searchParams.endMonth || defaultEndMonth
    const status = searchParams.status as 'scheduled' | 'posted' | 'canceled' | undefined
    
    if (searchParams.entityId) {
      installments = await listInstallmentsByEntityAndPeriod(
        searchParams.entityId,
        startMonth,
        endMonth,
        status
      )
    } else if (searchParams.cardId) {
      installments = await listInstallmentsByCardAndPeriod(
        searchParams.cardId,
        startMonth,
        endMonth,
        status
      )
    } else {
      // Listar todas as parcelas do período
      installments = await listInstallmentsByCardAndPeriod(
        undefined,
        startMonth,
        endMonth,
        status
      )
    }
  } catch (error) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar dados</CardTitle>
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

  // Calcular total por mês
  const totalsByMonth = installments.reduce((acc, inst) => {
    const month = inst.competence_month
    if (!acc[month]) {
      acc[month] = { scheduled: 0, posted: 0, total: 0 }
    }
    acc[month].total += Number(inst.amount)
    if (inst.status === 'scheduled') {
      acc[month].scheduled += Number(inst.amount)
    } else if (inst.status === 'posted') {
      acc[month].posted += Number(inst.amount)
    }
    return acc
  }, {} as Record<string, { scheduled: number; posted: number; total: number }>)

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Parcelas (Cartão)</h1>
          <p className="text-muted-foreground">
            Agenda de parcelas previstas e realizadas
          </p>
        </div>

        {Object.keys(totalsByMonth).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Totais por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(totalsByMonth)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([month, totals]) => (
                    <div key={month} className="flex justify-between text-sm">
                      <span className="font-medium">
                        {new Date(month).toLocaleDateString("pt-BR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">
                          Agendado:{" "}
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(totals.scheduled)}
                        </span>
                        <span className="text-muted-foreground">
                          Postado:{" "}
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(totals.posted)}
                        </span>
                        <span className="font-medium">
                          Total:{" "}
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(totals.total)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Agenda de Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            <InstallmentsTableClient
              installments={installments}
              entities={entities}
              cards={cards}
              initialFilters={{
                entityId: searchParams.entityId,
                cardId: searchParams.cardId,
                startMonth: searchParams.startMonth,
                endMonth: searchParams.endMonth,
                status: searchParams.status,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

