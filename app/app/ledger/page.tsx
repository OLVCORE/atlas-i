import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { listTransactionsByEntity, createTransaction } from "@/lib/transactions"
import { listEntities } from "@/lib/entities"
import { listAllAccounts } from "@/lib/accounts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HelpTooltip } from "@/components/help/HelpTooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

async function createTransactionAction(formData: FormData) {
  "use server"

  const entityId = formData.get("entityId") as string
  const accountId = formData.get("accountId") as string
  const type = formData.get("type") as "income" | "expense" | "transfer"
  const amount = parseFloat(formData.get("amount") as string)
  const date = formData.get("date") as string
  const description = formData.get("description") as string

  if (!entityId || !type || !amount || !date || !description) {
    throw new Error("Preencha todos os campos obrigatórios")
  }

  await createTransaction(
    entityId,
    type,
    amount,
    date,
    description,
    accountId || null
  )
  
  // CP1: Revalidar paths relevantes
  revalidatePath("/app/ledger")
  revalidatePath("/app/cashflow")
  revalidatePath("/app/dashboard")
  revalidatePath("/app/accounts")
  
  redirect("/app/ledger")
}

export default async function LedgerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let transactions = []
  let entities = []
  let accounts = []
  try {
    entities = await listEntities()
    accounts = await listAllAccounts()
    
    // Listar transações de todas as entities (para simplificar, mostramos todas)
    if (entities.length > 0) {
      const allTransactions = await Promise.all(
        entities.map((entity) => listTransactionsByEntity(entity.id))
      )
      transactions = allTransactions.flat().sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateB - dateA
      })
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
    <div className="container py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Ledger</h1>
          <p className="text-muted-foreground">
            Registre todas as transações financeiras
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nova Transação</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTransactionAction} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="entityId">Entidade</Label>
                    <HelpTooltip contentKey="ledger.entity" />
                  </div>
                  <select
                    id="entityId"
                    name="entityId"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Selecione a entidade</option>
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.legal_name} ({entity.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="accountId">Conta (Opcional)</Label>
                    <HelpTooltip contentKey="ledger.account" />
                  </div>
                  <select
                    id="accountId"
                    name="accountId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Sem conta específica</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="type">Tipo</Label>
                    <HelpTooltip contentKey="ledger.type" />
                  </div>
                  <select
                    id="type"
                    name="type"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="income">Receita</option>
                    <option value="expense">Despesa</option>
                    <option value="transfer">Transferência</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="amount">Valor</Label>
                    <HelpTooltip contentKey="ledger.amount" />
                  </div>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="date">Data</Label>
                    <HelpTooltip contentKey="ledger.date" />
                  </div>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="description">Descrição</Label>
                    <HelpTooltip contentKey="ledger.description" />
                  </div>
                  <Input
                    id="description"
                    name="description"
                    placeholder="Descrição da transação"
                    required
                  />
                </div>
              </div>
              <Button type="submit">Registrar Transação</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transações Registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhuma transação registrada. Registre uma transação acima.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Conta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
                    const account = accounts.find((a) => a.id === transaction.account_id)
                    const entity = entities.find((e) => e.id === transaction.entity_id)
                    const isExpense = transaction.type === "expense"
                    const isIncome = transaction.type === "income"
                    
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {new Date(transaction.date).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {transaction.description}
                        </TableCell>
                        <TableCell>
                          {transaction.type === "income"
                            ? "Receita"
                            : transaction.type === "expense"
                            ? "Despesa"
                            : "Transferência"}
                        </TableCell>
                        <TableCell
                          className={
                            isExpense
                              ? "text-destructive"
                              : isIncome
                              ? "text-green-600"
                              : ""
                          }
                        >
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: transaction.currency || "BRL",
                          }).format(Number(transaction.amount))}
                        </TableCell>
                        <TableCell>{account?.name || "—"}</TableCell>
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

