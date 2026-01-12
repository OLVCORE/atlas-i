import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import {
  listCommitments,
  createCommitment,
  cancelCommitment,
  activateCommitment,
} from "@/lib/commitments"
import { listSchedulesByCommitment } from "@/lib/schedules"
import { listEntities } from "@/lib/entities"
import { listAllAccounts } from "@/lib/accounts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CommitmentFormClient } from "@/components/commitment-form-client"
import { CommitmentsTableClient } from "@/components/commitments-table-client"
import { CommitmentsFilterClient } from "@/components/commitments-filter-client"
import { BulkCommitmentsDialogClient } from "@/components/commitments/BulkCommitmentsDialogClient"

async function createCommitmentAction(prevState: any, formData: FormData) {
  "use server"

  try {
    // Parse campos do FormData
    const entityId = formData.get("entity_id") as string
    const type = formData.get("type") as 'expense' | 'revenue'
    const category = formData.get("category") as string || null
    const description = formData.get("description") as string
    const totalAmountStr = formData.get("total_amount") as string
    const currency = formData.get("currency") as string || 'BRL'
    const startDate = formData.get("start_date") as string
    const endDate = formData.get("end_date") as string || null
    const recurrence = (formData.get("recurrence") as 'none' | 'monthly' | 'quarterly' | 'yearly' | 'custom') || 'none'

    // Validações básicas
    if (!entityId || !type || !description || !totalAmountStr || !startDate) {
      const missing = []
      if (!entityId) missing.push("entity_id")
      if (!type) missing.push("type")
      if (!description) missing.push("description")
      if (!totalAmountStr) missing.push("total_amount")
      if (!startDate) missing.push("start_date")
      console.error("[commitments:create] Campos obrigatórios faltando:", missing)
      return { ok: false, error: `Campos obrigatórios faltando: ${missing.join(", ")}` }
    }

    // Parse valor (suporta vírgula ou ponto como separador decimal)
    const totalAmount = Number(totalAmountStr.replace(',', '.'))
    if (isNaN(totalAmount) || totalAmount <= 0) {
      console.error("[commitments:create] Valor inválido:", totalAmountStr)
      return { ok: false, error: `Valor inválido: ${totalAmountStr}` }
    }

    // Validar data (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(startDate)) {
      console.error("[commitments:create] Data de início inválida:", startDate)
      return { ok: false, error: `Data de início inválida: ${startDate}` }
    }

    const workspace = await getActiveWorkspace()
    console.log("[commitments:create] workspace=", workspace.id, "entity=", entityId, "amount=", totalAmount, "type=", type)

    const commitment = await createCommitment({
      entityId,
      type,
      category,
      description,
      totalAmount,
      currency,
      startDate,
      endDate: endDate && dateRegex.test(endDate) ? endDate : null,
      recurrence,
      autoGenerateSchedules: true,
    })

    console.log("[commitments:create] Sucesso, commitment.id=", commitment.id)
    try {
      revalidatePath("/app/commitments")
      revalidatePath("/app/schedules")
    } catch (revalidateErr) {
      console.error("[commitments:create] Erro ao revalidar paths:", revalidateErr)
    }
    return { ok: true, message: "Compromisso criado com sucesso." }
  } catch (err: any) {
    const errorMessage = err?.message || String(err) || "Erro desconhecido ao criar compromisso"
    console.error("[commitments:create] Erro:", errorMessage)
    if (err?.stack) {
      console.error("[commitments:create] Stack:", err.stack)
    }
    return { ok: false, error: errorMessage }
  }
}

async function activateCommitmentAction(commitmentId: string) {
  "use server"

  await activateCommitment(commitmentId)
  
  // CP1: Revalidar paths relevantes
  revalidatePath("/app/commitments")
  revalidatePath("/app/schedules")
  revalidatePath("/app/cashflow")
  revalidatePath("/app/dashboard")
  
  redirect("/app/commitments")
}

async function cancelCommitmentAction(commitmentId: string) {
  "use server"

  await cancelCommitment(commitmentId)
  
  // CP1: Revalidar paths relevantes
  revalidatePath("/app/commitments")
  revalidatePath("/app/schedules")
  revalidatePath("/app/cashflow")
  revalidatePath("/app/dashboard")
  
  redirect("/app/commitments")
}

async function updateCommitmentAction(prevState: any, formData: FormData) {
  "use server"

  try {
    const { updateCommitment } = await import("@/lib/commitments")
    
    const commitmentId = formData.get("commitmentId") as string
    const description = formData.get("description") as string
    const category = formData.get("category") as string || null
    const endDate = formData.get("endDate") as string || null
    const recurrence = formData.get("recurrence") as 'none' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

    if (!commitmentId || !description) {
      return {
        ok: false,
        error: "Preencha todos os campos obrigatórios.",
      }
    }

    await updateCommitment(commitmentId, {
      description,
      category: category || null,
      endDate: endDate || null,
      recurrence,
    })

    revalidatePath("/app/commitments")
    revalidatePath("/app/schedules")
    revalidatePath("/app/cashflow")
    revalidatePath("/app/dashboard")

    return { ok: true, message: "Compromisso atualizado com sucesso." }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

async function postTransactionFromCommitmentAction(formData: FormData) {
  "use server"

  const { postTransactionFromCommitment } = await import("@/lib/transactions/operational")

  const commitmentId = formData.get("commitment_id") as string | null
  const installmentId = formData.get("installment_id") as string | null
  const accountId = formData.get("account_id") as string
  const amount = formData.get("amount") ? parseFloat(formData.get("amount") as string) : undefined
  const effectiveDate = formData.get("effective_date") as string
  const description = formData.get("description") as string || undefined

  if (!accountId || !effectiveDate) {
    throw new Error("Preencha todos os campos obrigatórios")
  }

  if (!commitmentId && !installmentId) {
    throw new Error("Erro interno: source não identificado")
  }

  await postTransactionFromCommitment({
    commitment_id: commitmentId || undefined,
    installment_id: installmentId || undefined,
    account_id: accountId,
    amount,
    effective_date: effectiveDate,
    description,
  })

  // CP1: Revalidar paths relevantes
  revalidatePath("/app/commitments")
  revalidatePath("/app/ledger")
  revalidatePath("/app/schedules")
  revalidatePath("/app/cashflow")
  revalidatePath("/app/dashboard")
  revalidatePath("/app/accounts")
}

export default async function CommitmentsPage({
  searchParams,
}: {
  searchParams: { entity_id?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const entityIdFilter = searchParams.entity_id && searchParams.entity_id.trim() !== "" 
    ? searchParams.entity_id.trim() 
    : undefined

  let commitments = []
  let entities = []
  let accounts = []
  let schedulesByCommitment: Record<string, any[]> = {}
  try {
    commitments = await listCommitments(entityIdFilter ? { entityId: entityIdFilter } : undefined)
    entities = await listEntities()
    accounts = await listAllAccounts()
    
    // Buscar schedules de cada compromisso para calcular impacto
    for (const commitment of commitments) {
      try {
        const schedules = await listSchedulesByCommitment(commitment.id)
        schedulesByCommitment[commitment.id] = schedules
      } catch (err) {
        console.error(`[commitments:page] Erro ao buscar schedules para commitment ${commitment.id}:`, err)
        schedulesByCommitment[commitment.id] = []
      }
    }
  } catch (error) {
    return (
      <div>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compromissos Financeiros</h1>
        <p className="text-muted-foreground">
          Planeje e acompanhe despesas e receitas futuras. Os compromissos geram cronogramas automáticos que podem ser vinculados a transações reais do ledger.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Novo Compromisso</CardTitle>
            <BulkCommitmentsDialogClient entities={entities} onCreateAction={createCommitmentAction} />
          </div>
        </CardHeader>
        <CardContent>
          <CommitmentFormClient entities={entities} action={createCommitmentAction} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Compromissos Cadastrados</CardTitle>
            <CommitmentsFilterClient entities={entities} selectedEntityId={entityIdFilter} />
          </div>
        </CardHeader>
        <CardContent>
          <CommitmentsTableClient
            commitments={commitments}
            entities={entities}
            schedulesByCommitment={schedulesByCommitment}
            accounts={accounts.map((a: any) => ({ id: a.id, name: a.name, type: a.type }))}
            onActivate={activateCommitmentAction}
            onCancel={cancelCommitmentAction}
            onUpdateAction={updateCommitmentAction}
            postTransactionFromCommitmentAction={postTransactionFromCommitmentAction}
          />
        </CardContent>
      </Card>
    </div>
  )
}
