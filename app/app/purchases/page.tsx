import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listEntities } from "@/lib/entities"
import { listCardsByEntity, createCardPurchaseAndSchedule } from "@/lib/cards/purchases"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PurchaseForm } from "@/components/purchase-form"

async function createPurchaseAction(data: {
  entityId: string
  cardId: string
  purchaseDate: string
  merchant?: string
  description?: string
  totalAmount: number
  installments: number
  firstInstallmentMonth?: string
}) {
  "use server"

  const {
    entityId,
    cardId,
    purchaseDate,
    merchant,
    description,
    totalAmount,
    installments,
    firstInstallmentMonth,
  } = data

  if (!entityId || !cardId || !purchaseDate || !totalAmount || !installments) {
    throw new Error("Preencha todos os campos obrigatórios")
  }

  const purchaseDateObj = new Date(purchaseDate)
  const firstMonth = firstInstallmentMonth ? new Date(firstInstallmentMonth) : undefined

  await createCardPurchaseAndSchedule(
    cardId,
    entityId,
    purchaseDateObj,
    totalAmount,
    installments,
    merchant,
    description,
    firstMonth
  )
  
  redirect("/app/purchases?success=1")
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: { success?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let entities = []
  try {
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
          <h1 className="text-3xl font-bold">Compras Parceladas (Cartão)</h1>
          <p className="text-muted-foreground">
            Registre compras parceladas e gere automaticamente a agenda de parcelas
          </p>
        </div>

        {searchParams.success === "1" && (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
            Compra registrada e parcelas geradas com sucesso!
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Nova Compra</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseForm entities={entities} onSubmit={createPurchaseAction} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

