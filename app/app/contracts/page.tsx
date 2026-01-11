import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { listContracts, createContract, cancelContract, updateContract, deleteContract, getContractById } from "@/lib/contracts"
import { listSchedulesByContract } from "@/lib/schedules"
import { listEntities } from "@/lib/entities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ContractsTableClient } from "@/components/contracts-table-client"
import { ContractCreateDialog } from "@/components/contracts/contract-create-dialog"

async function cancelContractAction(contractId: string) {
  "use server"

  await cancelContract(contractId)
  revalidatePath("/app/contracts")
  redirect("/app/contracts")
}

async function deleteContractAction(contractId: string) {
  "use server"

  await deleteContract(contractId)
  revalidatePath("/app/contracts")
  redirect("/app/contracts")
}

async function updateContractAction(contractId: string, prevState: any, formData: FormData) {
  "use server"

  try {
    const title = formData.get("title") as string
    const description = formData.get("description") as string || null
    const totalValueStr = formData.get("total_value") as string
    const monthlyValueStr = formData.get("monthly_value") as string
    const valueType = formData.get("value_type") as string || 'total'
    const recurrencePeriod = formData.get("recurrence_period") as string || 'monthly'
    const adjustmentIndex = formData.get("adjustment_index") as string || 'NONE'
    const adjustmentFrequency = formData.get("adjustment_frequency") as string || 'NONE'
    const adjustmentPercentageStr = formData.get("adjustment_percentage") as string
    
    // Parse adjustment_percentage: aceita percentual (4.5%) ou decimal (0.045)
    let adjustmentPercentage: number | null = null
    if (adjustmentPercentageStr) {
      let value = adjustmentPercentageStr.trim()
      // Se terminar com %, remover e converter de percentual para decimal
      if (value.endsWith('%')) {
        value = value.slice(0, -1).trim()
        const numValue = Number(value.replace(',', '.'))
        if (!isNaN(numValue)) {
          adjustmentPercentage = numValue / 100 // 4.5% -> 0.045
        }
      } else {
        // Já é decimal
        adjustmentPercentage = Number(value.replace(',', '.'))
      }
      // Validar que está entre 0 e 1 (decimal) ou entre 0 e 100 (percentual já convertido)
      if (adjustmentPercentage === null || isNaN(adjustmentPercentage) || adjustmentPercentage < 0 || adjustmentPercentage > 1) {
        adjustmentPercentage = null
      }
    }
    const currency = formData.get("currency") as string || 'BRL'
    const startDate = formData.get("start_date") as string
    const endDate = formData.get("end_date") as string || null

    // Validações básicas
    if (!title || !startDate) {
      return { ok: false, error: "Título e data de início são obrigatórios" }
    }

    // Parse valores
    const totalValue = totalValueStr ? Number(totalValueStr.replace(',', '.')) : null
    const monthlyValue = monthlyValueStr ? Number(monthlyValueStr.replace(',', '.')) : null

    // Validar data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(startDate)) {
      return { ok: false, error: "Data de início inválida" }
    }

    const workspace = await getActiveWorkspace()
    const contract = await getContractById(contractId)

    if (!contract || contract.workspace_id !== workspace.id) {
      return { ok: false, error: "Contrato não encontrado" }
    }

    // Preparar dados de atualização
    const updateData: any = {
      title,
      description,
      currency,
      start_date: startDate,
      end_date: endDate && dateRegex.test(endDate) ? endDate : null,
      value_type: valueType,
      recurrence_period: recurrencePeriod,
      adjustment_index: adjustmentIndex,
      adjustment_frequency: adjustmentFrequency,
    }

    if (totalValue !== null && totalValue > 0) {
      updateData.total_value = totalValue
    }

    if (monthlyValue !== null && monthlyValue > 0) {
      updateData.monthly_value = monthlyValue
    }

    if (adjustmentPercentage !== null) {
      updateData.adjustment_percentage = adjustmentPercentage
    }

    await updateContract(contractId, updateData)

    revalidatePath("/app/contracts")
    
    return { ok: true, message: "Contrato atualizado com sucesso." }
  } catch (err: any) {
    const errorMessage = err?.message || String(err) || "Erro desconhecido ao atualizar contrato"
    console.error("[contracts:update] Erro:", errorMessage)
    return { ok: false, error: errorMessage }
  }
}

async function createContractAction(prevState: any, formData: FormData) {
  "use server"

  try {
    // Parse campos do FormData
    const counterpartyEntityId = formData.get("counterparty_entity_id") as string
    const title = formData.get("title") as string
    const description = formData.get("description") as string || null
    const totalValueStr = formData.get("total_value") as string
    const monthlyValueStr = formData.get("monthly_value") as string
    const valueType = formData.get("value_type") as string || 'total'
    const recurrencePeriod = formData.get("recurrence_period") as string || 'monthly'
    const adjustmentIndex = formData.get("adjustment_index") as string || 'NONE'
    const adjustmentFrequency = formData.get("adjustment_frequency") as string || 'NONE'
    const adjustmentPercentageStr = formData.get("adjustment_percentage") as string
    const currency = formData.get("currency") as string || 'BRL'
    const startDate = formData.get("start_date") as string
    const endDate = formData.get("end_date") as string || null

    // Validações básicas
    if (!counterpartyEntityId || !title || !startDate) {
      const missing = []
      if (!counterpartyEntityId) missing.push("counterparty_entity_id")
      if (!title) missing.push("title")
      if (!startDate) missing.push("start_date")
      console.error("[contracts:create] Campos obrigatórios faltando:", missing)
      return { ok: false, error: `Campos obrigatórios faltando: ${missing.join(", ")}` }
    }

    // Parse valores (suporta vírgula ou ponto como separador decimal)
    const totalValue = totalValueStr ? Number(totalValueStr.replace(',', '.')) : null
    const monthlyValue = monthlyValueStr ? Number(monthlyValueStr.replace(',', '.')) : null
    
    // Parse adjustment_percentage: aceita percentual (4.5%) ou decimal (0.045)
    let adjustmentPercentage: number | null = null
    if (adjustmentPercentageStr) {
      let value = adjustmentPercentageStr.trim()
      // Se terminar com %, remover e converter de percentual para decimal
      if (value.endsWith('%')) {
        value = value.slice(0, -1).trim()
        const numValue = Number(value.replace(',', '.'))
        if (!isNaN(numValue)) {
          adjustmentPercentage = numValue / 100 // 4.5% -> 0.045
        }
      } else {
        // Já é decimal
        adjustmentPercentage = Number(value.replace(',', '.'))
      }
      // Validar que está entre 0 e 1 (decimal) ou entre 0 e 100 (percentual já convertido)
      if (adjustmentPercentage === null || isNaN(adjustmentPercentage) || adjustmentPercentage < 0 || adjustmentPercentage > 1) {
        adjustmentPercentage = null
      }
    }

    // Validar que pelo menos um valor foi informado
    if (valueType === 'total' && (!totalValue || totalValue <= 0)) {
      console.error("[contracts:create] Valor total inválido:", totalValueStr)
      return { ok: false, error: "Valor total é obrigatório quando tipo é 'total'" }
    }

    if (valueType === 'monthly' && (!monthlyValue || monthlyValue <= 0)) {
      console.error("[contracts:create] Valor mensal inválido:", monthlyValueStr)
      return { ok: false, error: "Valor mensal é obrigatório quando tipo é 'monthly'" }
    }

    // Validar data (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(startDate)) {
      console.error("[contracts:create] Data de início inválida:", startDate)
      return { ok: false, error: `Data de início inválida: ${startDate}` }
    }

    const workspace = await getActiveWorkspace()
    console.log("[contracts:create] workspace=", workspace.id, "counterparty=", counterpartyEntityId, "value=", totalValue, "title=", title)

    // Calcular total_value baseado no tipo
    let finalTotalValue = totalValue || 0
    if (valueType === 'monthly' && monthlyValue && endDate && dateRegex.test(endDate)) {
      // Calcular valor total baseado no período e valor mensal
      const start = new Date(startDate + "T00:00:00")
      const end = new Date(endDate + "T00:00:00")
      const months = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      finalTotalValue = monthlyValue * months
    } else if (valueType === 'monthly' && monthlyValue) {
      // Se não tiver end_date, usar valor mensal como total (será ajustado depois)
      finalTotalValue = monthlyValue
    }

    const contract = await createContract({
      counterpartyEntityId,
      title,
      description,
      totalValue: finalTotalValue,
      currency,
      startDate,
      endDate: endDate && dateRegex.test(endDate) ? endDate : null,
      valueType: valueType as 'total' | 'monthly' | 'quarterly' | 'yearly',
      monthlyValue: monthlyValue || undefined,
      recurrencePeriod: recurrencePeriod as 'monthly' | 'quarterly' | 'yearly',
      adjustmentIndex: adjustmentIndex as 'NONE' | 'IPCA' | 'IGPM' | 'CDI' | 'MANUAL' | 'CUSTOM',
      adjustmentFrequency: adjustmentFrequency as 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
      adjustmentPercentage: adjustmentPercentage || undefined,
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Contratos Cadastrados</CardTitle>
            <ContractCreateButton entities={entities} onCreateAction={createContractAction} />
          </CardHeader>
          <CardContent>
            <ContractsTableClient
              contracts={contracts}
              entities={entities}
              schedulesByContract={schedulesByContract}
              onCancel={cancelContractAction}
              onDelete={deleteContractAction}
              onUpdateAction={updateContractAction}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

