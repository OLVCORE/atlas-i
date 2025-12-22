import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createCard, listCards } from "@/lib/cards/purchases"
import { listEntities } from "@/lib/entities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CardFormClient } from "@/components/card-form-client"

async function createCardAction(data: {
  entityId: string
  name: string
  brand?: string
  closingDay: number
  dueDay: number
  isActive: boolean
}) {
  "use server"

  const { entityId, name, brand, closingDay, dueDay, isActive } = data

  await createCard(entityId, name, closingDay, dueDay, brand, isActive)
  redirect("/app/cards")
}

export default async function CardsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let cards = []
  let entities = []
  try {
    cards = await listCards()
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

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Cartões</h1>
          <p className="text-muted-foreground">
            Gerencie cartões de crédito vinculados às entidades
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Novo Cartão</CardTitle>
          </CardHeader>
          <CardContent>
            <CardFormClient entities={entities} onSubmit={createCardAction} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cartões Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {cards.length === 0 ? (
              <p className="text-muted-foreground">
                Sem cartões cadastrados no workspace.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Corte</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.map((card) => {
                    const entity = entities.find((e) => e.id === card.entity_id)
                    return (
                      <TableRow key={card.id}>
                        <TableCell className="font-medium">{card.name}</TableCell>
                        <TableCell>{entity?.legal_name || "N/A"}</TableCell>
                        <TableCell>{card.closing_day}</TableCell>
                        <TableCell>{card.due_day}</TableCell>
                        <TableCell>
                          {card.is_active ? (
                            <span className="text-green-600">Ativo</span>
                          ) : (
                            <span className="text-gray-400">Inativo</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(card.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

