import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { listContracts, createContract, cancelContract } from "@/lib/contracts"
import { listSchedulesByContract } from "@/lib/schedules"
import { listEntities } from "@/lib/entities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContractFormClient } from "@/components/contract-form-client"
import { ContractsTableClient } from "@/components/contracts-table-client"

async function cancelContractAction(contractId: string) {
  "use server"

  await cancelContract(contractId)
  redirect("/app/contracts")
}

async function createContractAction(prevState: any, formData: FormData) {
  "use server"

  try {
    // Parse campos do FormData
    const counterpartyEntityId = formData.get("counterparty_entity_id") as string
    const title = formData.get("title") as string
    const description = formData.get("description") as string || null
    const totalValueStr = formData.get("total_value") as string
    const currency = formData.get("currency") as string || 'BRL'
    const startDate = formData.get("start_date") as string
    const endDate = formData.get("end_date") as string || null

    // Validações básicas
    if (!counterpartyEntityId || !title || !totalValueStr || !startDate) {
      const missing = []
      if (!counterpartyEntityId) missing.push("counterparty_entity_id")
      if (!title) missing.push("title")
      if (!totalValueStr) missing.push("total_value")
      if (!startDate) missing.push("start_date")
      console.error("[contracts:create] Campos obrigatórios faltando:", missing)
      return { ok: false, error: `Campos obrigatórios faltando: ${missing.join(", ")}` }
    }

    // Parse valor (suporta vírgula ou ponto como separador decimal)
    const totalValue = Number(totalValueStr.replace(',', '.'))
    if (isNaN(totalValue) || totalValue <= 0) {
      console.error("[contracts:create] Valor inválido:", totalValueStr)
      return { ok: false, error: `Valor inválido: ${totalValueStr}` }
    }

    // Validar data (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(startDate)) {
      console.error("[contracts:create] Data de início inválida:", startDate)
      return { ok: false, error: `Data de início inválida: ${startDate}` }
    }

    const workspace = await getActiveWorkspace()
    console.log("[contracts:create] workspace=", workspace.id, "counterparty=", counterpartyEntityId, "value=", totalValue, "title=", title)

    const contract = await createContract({
      counterpartyEntityId,
      title,
      description,
      totalValue,
      currency,
      startDate,
      endDate: endDate && dateRegex.test(endDate) ? endDate : null,
    })

    console.log("[contracts:create] Sucesso, contract.id=", contract.id)
    try {
      revalidatePath("/app/contracts")
      revalidatePath("/app/schedules")
    } catch (revalidateErr) {
      console.error("[contracts:create] Erro ao revalidar paths:", revalidateErr)
    }
    return { ok: true, message: "Contrato criado com sucesso." }
  } catch (err: any) {
    const errorMessage = err?.message || String(err) || "Erro desconhecido ao criar contrato"
    console.error("[contracts:create] Erro:", errorMessage)
    if (err?.stack) {
      console.error("[contracts:create] Stack:", err.stack)
    }
    return { ok: false, error: errorMessage }
  }
}

export default async function ContractsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let contracts = []
  let entities = []
  let schedulesByContract: Record<string, any[]> = {}
  try {
    contracts = await listContracts()
    entities = await listEntities()
    
    // Buscar schedules de cada contrato para calcular impacto
    for (const contract of contracts) {
      try {
        const schedules = await listSchedulesByContract(contract.id)
        schedulesByContract[contract.id] = schedules
      } catch (err) {
        console.error(`[contracts:page] Erro ao buscar schedules para contract ${contract.id}:`, err)
        schedulesByContract[contract.id] = []
      }
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Contratos</h1>
          <p className="text-muted-foreground">
            Gerencie contratos e projetos. Os contratos podem ter cronogramas de recebimento ou pagamento associados.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Novo Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <ContractFormClient entities={entities} action={createContractAction} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contratos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <ContractsTableClient 
              contracts={contracts} 
              entities={entities}
              schedulesByContract={schedulesByContract}
              onCancel={cancelContractAction}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

