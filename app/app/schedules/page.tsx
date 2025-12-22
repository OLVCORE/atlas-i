import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { listSchedulesByCommitment, listSchedulesByPeriod, listSchedulesByContract } from "@/lib/schedules"
import { listCommitments } from "@/lib/commitments"
import { listContracts } from "@/lib/contracts"
import { listEntities } from "@/lib/entities"
import { listAccounts } from "@/lib/accounts/list"
import { realizeScheduleToLedger } from "@/lib/realization"
import { createOperationalCommitmentWithSchedules, type OperationalSchedulePlan } from "@/lib/schedules/operational"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SchedulesTableClient } from "@/components/schedules-table-client"
import { CreateOperationalScheduleDialog } from "@/components/schedules/CreateOperationalScheduleDialog"

async function realizeScheduleAction(scheduleKind: 'commitment' | 'contract', scheduleId: string) {
  "use server"

  try {
    await realizeScheduleToLedger({ scheduleKind, scheduleId })
    revalidatePath("/app/schedules")
    revalidatePath("/app/ledger")
    revalidatePath("/app/cashflow")
    revalidatePath("/app/dashboard")
    return { ok: true, message: "Schedule realizado no Ledger com sucesso." }
  } catch (err: any) {
    const errorMessage = err?.message || String(err) || "Erro desconhecido ao realizar schedule"
    console.error("[schedules:realize] Erro:", errorMessage)
    return { ok: false, error: errorMessage }
  }
}

async function createOperationalScheduleAction(formData: FormData) {
  "use server"

  try {
    const mode = formData.get("mode") as 'recurring' | 'installment'
    if (!mode || (mode !== 'recurring' && mode !== 'installment')) {
      throw new Error("Modo inválido")
    }

    const entityId = formData.get("entityId") as string
    const type = formData.get("type") as 'expense' | 'revenue'
    const description = formData.get("description") as string
    const category = formData.get("category") as string | null
    const accountId = formData.get("accountId") as string | null

    if (!entityId || !type || !description) {
      throw new Error("Preencha todos os campos obrigatórios")
    }

    let plan: OperationalSchedulePlan

    if (mode === 'recurring') {
      const monthlyAmount = parseFloat(formData.get("monthlyAmount") as string)
      const startDate = formData.get("startDate") as string
      const endDateStr = formData.get("endDate") as string | null

      if (isNaN(monthlyAmount) || monthlyAmount <= 0) {
        throw new Error("Valor mensal deve ser maior que zero")
      }
      if (!startDate) {
        throw new Error("Data inicial obrigatória")
      }

      plan = {
        mode: 'recurring',
        entityId,
        type,
        description,
        monthlyAmount,
        startDate,
        endDate: endDateStr && endDateStr.trim() !== "" ? endDateStr : null,
        category: category && category.trim() !== "" ? category : null,
        accountId: accountId && accountId.trim() !== "" ? accountId : null,
      }
    } else {
      const totalAmount = parseFloat(formData.get("totalAmount") as string)
      const baseDate = formData.get("baseDate") as string
      const installmentType = formData.get("installmentType") as 'entry_plus_installments' | 'custom_dates'

      if (isNaN(totalAmount) || totalAmount <= 0) {
        throw new Error("Valor total deve ser maior que zero")
      }
      if (!baseDate) {
        throw new Error("Data base obrigatória")
      }

      if (installmentType === 'entry_plus_installments') {
        const entryAmount = parseFloat(formData.get("entryAmount") as string)
        const numberOfInstallments = parseInt(formData.get("numberOfInstallments") as string)
        const installmentIntervalDays = parseInt(formData.get("installmentIntervalDays") as string)

        if (isNaN(entryAmount) || isNaN(numberOfInstallments) || isNaN(installmentIntervalDays)) {
          throw new Error("Preencha entrada, número de parcelas e intervalo")
        }

        plan = {
          mode: 'installment',
          entityId,
          type,
          description,
          totalAmount,
          baseDate,
          installmentType: 'entry_plus_installments',
          entryAmount,
          numberOfInstallments,
          installmentIntervalDays,
          category: category && category.trim() !== "" ? category : null,
          accountId: accountId && accountId.trim() !== "" ? accountId : null,
        }
      } else {
        const customSchedulesStr = formData.get("customSchedules") as string
        if (!customSchedulesStr) {
          throw new Error("Informe as parcelas customizadas")
        }

        const customSchedules = JSON.parse(customSchedulesStr) as Array<{ date: string; amount: number }>
        if (!Array.isArray(customSchedules) || customSchedules.length === 0) {
          throw new Error("Adicione pelo menos uma parcela")
        }

        plan = {
          mode: 'installment',
          entityId,
          type,
          description,
          totalAmount,
          baseDate,
          installmentType: 'custom_dates',
          customSchedules,
          category: category && category.trim() !== "" ? category : null,
          accountId: accountId && accountId.trim() !== "" ? accountId : null,
        }
      }
    }

    await createOperationalCommitmentWithSchedules(plan)

    revalidatePath("/app/schedules")
    revalidatePath("/app/cashflow")
    revalidatePath("/app/dashboard")
  } catch (err: any) {
    const errorMessage = err?.message || String(err) || "Erro desconhecido ao criar cronograma"
    console.error("[schedules:create] Erro:", errorMessage)
    throw new Error(errorMessage)
  }
}

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ commitmentId?: string; contractId?: string; startDate?: string; endDate?: string }> | { commitmentId?: string; contractId?: string; startDate?: string; endDate?: string }
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

  let schedules: any[] = []
  let commitments: any[] = []
  let contracts: any[] = []
  let entities: any[] = []
  let accounts: any[] = []

  try {
    // Validar e limpar searchParams de forma segura
    const commitmentId = resolvedParams?.commitmentId ? String(resolvedParams.commitmentId).trim() : undefined
    const contractId = resolvedParams?.contractId ? String(resolvedParams.contractId).trim() : undefined
    const startDateParam = resolvedParams?.startDate ? String(resolvedParams.startDate).trim() : undefined
    const endDateParam = resolvedParams?.endDate ? String(resolvedParams.endDate).trim() : undefined

    // Buscar dados básicos com tratamento individual de erro
    try {
      entities = await listEntities()
    } catch (err) {
      console.error("[schedules:page] Erro ao listar entities:", err)
      entities = []
    }

    try {
      const workspace = await getActiveWorkspace()
      accounts = await listAccounts({ workspaceId: workspace.id, entityId: undefined })
    } catch (err) {
      console.error("[schedules:page] Erro ao listar accounts:", err)
      accounts = []
    }

    try {
      commitments = await listCommitments()
    } catch (err) {
      console.error("[schedules:page] Erro ao listar commitments:", err)
      commitments = []
    }

    try {
      contracts = await listContracts()
    } catch (err) {
      console.error("[schedules:page] Erro ao listar contracts:", err)
      contracts = []
    }

    // Se há filtro por commitmentId, buscar schedules desse commitment
    if (commitmentId && commitmentId.length > 0) {
      try {
        const commitmentSchedules = await listSchedulesByCommitment(commitmentId)
        schedules = commitmentSchedules.map((s: any) => ({
          ...s,
          source: 'commitment' as const,
          referenceId: s.commitment_id,
        }))
      } catch (err) {
        console.error("[schedules:page] Erro ao buscar schedules por commitment:", err)
        schedules = []
      }
    } else if (contractId && contractId.length > 0) {
      // Buscar schedules do contrato
      try {
        const contractSchedules = await listSchedulesByContract(contractId)
        schedules = contractSchedules.map((s: any) => ({
          ...s,
          source: 'contract' as const,
          referenceId: s.contract_id,
        }))
      } catch (err) {
        console.error("[schedules:page] Erro ao buscar schedules por contract:", err)
        schedules = []
      }
    } else {
      // Buscar schedules do período (padrão: próximos 12 meses)
      try {
        const today = new Date()
        const endDate = endDateParam || new Date(today.getFullYear(), today.getMonth() + 12, today.getDate()).toISOString().split('T')[0]
        const startDate = startDateParam || today.toISOString().split('T')[0]
        
        // Buscar financial_schedules
        let financialSchedules: any[] = []
        try {
          financialSchedules = await listSchedulesByPeriod(startDate, endDate)
        } catch (err) {
          console.error("[schedules:page] Erro ao buscar financial_schedules:", err)
        }

        const financialSchedulesNormalized = financialSchedules.map((s: any) => ({
          ...s,
          source: 'commitment' as const,
          referenceId: s.commitment_id,
        }))

        // Buscar contract_schedules
        let contractSchedules: any[] = []
        try {
          const workspace = await getActiveWorkspace()
          const { data: contractSchedulesData, error: contractError } = await supabase
            .from("contract_schedules")
            .select("*")
            .eq("workspace_id", workspace.id)
            .is("deleted_at", null)
            .gte("due_date", startDate)
            .lte("due_date", endDate)
            .order("due_date", { ascending: true })

          if (contractError) {
            console.error("[schedules:page] Erro ao buscar contract_schedules:", contractError)
          } else {
            contractSchedules = contractSchedulesData || []
          }
        } catch (err) {
          console.error("[schedules:page] Erro ao buscar contract_schedules:", err)
        }

        const contractSchedulesNormalized = contractSchedules.map((s: any) => ({
          ...s,
          source: 'contract' as const,
          referenceId: s.contract_id,
        }))

        // Combinar ambos os tipos
        schedules = [...financialSchedulesNormalized, ...contractSchedulesNormalized]
          .sort((a, b) => {
            const dateA = new Date(a.due_date).getTime()
            const dateB = new Date(b.due_date).getTime()
            return dateA - dateB
          })
      } catch (err) {
        console.error("[schedules:page] Erro ao buscar schedules por período:", err)
        schedules = []
      }
    }
  } catch (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar dados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Erro desconhecido ao carregar cronogramas"}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Cronogramas Financeiros (Contas a Pagar / Receber)</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie os cronogramas de compromissos e contratos. Vincule schedules a transações reais do ledger para marcar como realizado.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Cronogramas</CardTitle>
            <CreateOperationalScheduleDialog
              entities={entities}
              accounts={accounts.map((a) => ({ id: a.id, name: a.name, entity_id: a.entity_id }))}
              onSubmit={createOperationalScheduleAction}
            />
          </CardHeader>
          <CardContent>
            <SchedulesTableClient
              schedules={schedules}
              commitments={commitments}
              contracts={contracts}
              entities={entities}
              onRealize={realizeScheduleAction}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
