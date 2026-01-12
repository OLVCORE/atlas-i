import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { listDebitNotes, updateDebitNote, deleteDebitNote } from "@/lib/debit-notes"
import { listContracts } from "@/lib/contracts"
import { listEntities } from "@/lib/entities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DebitNotesTableClient } from "@/components/debit-notes/debit-notes-table-client"
import { GenerateDebitNoteDialog } from "@/components/debit-notes/generate-debit-note-dialog"

async function updateDebitNoteAction(prevState: any, formData: FormData) {
  "use server"
  
  try {
    const debitNoteId = formData.get("id") as string
    if (!debitNoteId) {
      return { ok: false, error: "ID da nota de débito não fornecido" }
    }

    const description = formData.get("description") as string | null
    const issuedDate = formData.get("issued_date") as string | null
    const dueDate = formData.get("due_date") as string | null

    // Parse expenses and discounts
    const expenses: Array<{ description?: string | null; amount: number }> = []
    const discounts: Array<{ description?: string | null; amount: number }> = []

    let index = 0
    while (formData.has(`expense_${index}_amount`)) {
      const description = formData.get(`expense_${index}_description`) as string | null
      const amount = parseFloat(formData.get(`expense_${index}_amount`) as string)
      if (!isNaN(amount) && amount > 0) {
        expenses.push({ description: description || null, amount })
      }
      index++
    }

    index = 0
    while (formData.has(`discount_${index}_amount`)) {
      const description = formData.get(`discount_${index}_description`) as string | null
      const amount = parseFloat(formData.get(`discount_${index}_amount`) as string)
      if (!isNaN(amount) && amount > 0) {
        discounts.push({ description: description || null, amount })
      }
      index++
    }

    await updateDebitNote(debitNoteId, {
      description: description || null,
      issuedDate: issuedDate || undefined,
      dueDate: dueDate || undefined,
      expenses,
      discounts,
    })

    revalidatePath("/app/debit-notes")
    return { ok: true, message: "Nota de débito atualizada com sucesso" }
  } catch (error: any) {
    console.error("[updateDebitNoteAction] Erro:", error)
    return { ok: false, error: error.message || "Erro ao atualizar nota de débito" }
  }
}

async function cancelDebitNoteAction(debitNoteId: string) {
  "use server"
  
  try {
    const { cancelDebitNote } = await import("@/lib/debit-notes")
    await cancelDebitNote(debitNoteId)
    revalidatePath("/app/debit-notes")
  } catch (error: any) {
    console.error("[cancelDebitNoteAction] Erro:", error)
    throw error
  }
}

async function deleteDebitNoteAction(debitNoteId: string) {
  "use server"
  
  try {
    await deleteDebitNote(debitNoteId)
    revalidatePath("/app/debit-notes")
  } catch (error: any) {
    console.error("[deleteDebitNoteAction] Erro:", error)
    throw error
  }
}

export default async function DebitNotesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let debitNotes = []
  let contracts = []
  let entities = []

  try {
    debitNotes = await listDebitNotes()
    contracts = await listContracts()
    entities = await listEntities()
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

  // Calcular estatísticas
  const stats = {
    total: debitNotes.length,
    draft: debitNotes.filter(n => n.status === 'draft').length,
    sent: debitNotes.filter(n => n.status === 'sent').length,
    paid: debitNotes.filter(n => n.status === 'paid').length,
    totalAmount: debitNotes.reduce((sum, n) => sum + n.total_amount, 0),
    pendingAmount: debitNotes
      .filter(n => n.status !== 'paid' && n.status !== 'cancelled')
      .reduce((sum, n) => sum + n.total_amount, 0),
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notas de Débito</h1>
            <p className="text-muted-foreground">
              Gerencie e emita notas de débito para recebíveis de contratos
            </p>
          </div>
          <GenerateDebitNoteDialog contracts={contracts} />
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rascunhos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Enviadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pagas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.paid}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Notas de Débito</CardTitle>
          </CardHeader>
          <CardContent>
            <DebitNotesTableClient 
              debitNotes={debitNotes}
              contracts={contracts}
              entities={entities}
              onUpdateAction={updateDebitNoteAction}
              onCancelAction={cancelDebitNoteAction}
              onDeleteAction={deleteDebitNoteAction}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
