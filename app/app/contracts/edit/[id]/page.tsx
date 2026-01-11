import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { getContractById, updateContract } from "@/lib/contracts"
import { listEntities } from "@/lib/entities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContractEditFormClient } from "@/components/contracts/contract-edit-form-client"

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
    const adjustmentPercentage = adjustmentPercentageStr ? Number(adjustmentPercentageStr.replace(',', '.')) : null

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
    revalidatePath(`/app/contracts/edit/${contractId}`)
    
    return { ok: true, message: "Contrato atualizado com sucesso." }
  } catch (err: any) {
    const errorMessage = err?.message || String(err) || "Erro desconhecido ao atualizar contrato"
    console.error("[contracts:update] Erro:", errorMessage)
    return { ok: false, error: errorMessage }
  }
}

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { id } = await params
  const workspace = await getActiveWorkspace()

  let contract
  let entities = []

  try {
    contract = await getContractById(id)
    entities = await listEntities()

    if (!contract || contract.workspace_id !== workspace.id) {
      redirect("/app/contracts")
    }
  } catch (error) {
    redirect("/app/contracts")
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Editar Contrato</h1>
          <p className="text-muted-foreground">
            Atualize as informações do contrato.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <ContractEditFormClient 
              contract={contract}
              entities={entities} 
              action={(prevState, formData) => updateContractAction(id, prevState, formData)} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
