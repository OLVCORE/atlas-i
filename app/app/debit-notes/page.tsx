import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { listDebitNotes } from "@/lib/debit-notes"
import { listContracts } from "@/lib/contracts"
import { listEntities } from "@/lib/entities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DebitNotesTableClient } from "@/components/debit-notes/debit-notes-table-client"
import { GenerateDebitNoteDialog } from "@/components/debit-notes/generate-debit-note-dialog"

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
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
