import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { listAllAccounts, createAccount } from "@/lib/accounts"
import { listAccounts } from "@/lib/accounts/list"
import { getCashPositionSummary } from "@/lib/accounts/balances"
import { listEntities } from "@/lib/entities"
import { getActiveWorkspace } from "@/lib/workspace"
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
import { AccountTransferDialog } from "@/components/accounts/AccountTransferDialog"
import { AccountsEntityFilter } from "@/components/accounts/AccountsEntityFilter"
import { AccountsTableClient } from "@/components/accounts/AccountsTableClient"
import { updateAccountBalance } from "@/lib/accounts"

async function createAccountAction(formData: FormData) {
  "use server"

  const entityId = formData.get("entityId") as string
  const name = formData.get("name") as string
  const type = formData.get("type") as "checking" | "investment" | "other"
  const openingBalance = parseFloat(formData.get("openingBalance") as string) || 0
  const openingBalanceDate = formData.get("openingBalanceDate") as string || new Date().toISOString().split("T")[0]
  const redirectEntityId = formData.get("redirect_entity_id") as string | null

  if (!entityId || !name || !type) {
    throw new Error("Preencha todos os campos obrigatórios")
  }

  await createAccount(entityId, name, type, openingBalance, openingBalanceDate)
  
  // Redirecionar mantendo o filtro de entidade se existir
  const redirectUrl = redirectEntityId ? `/app/accounts?entity_id=${redirectEntityId}` : "/app/accounts"
  redirect(redirectUrl)
}

async function updateAccountBalanceAction(
  prevState: any,
  formData: FormData
): Promise<{ ok: boolean; error?: string; message?: string }> {
  "use server"
  try {
    const accountId = formData.get("accountId") as string
    const newBalance = parseFloat(formData.get("newBalance") as string)
    const balanceDate = formData.get("balanceDate") as string
    const description = formData.get("description") as string

    if (!accountId || isNaN(newBalance) || !balanceDate) {
      return {
        ok: false,
        error: "Preencha todos os campos obrigatórios para atualizar o saldo.",
      }
    }

    await updateAccountBalance(accountId, newBalance, balanceDate, description)
    revalidatePath("/app/accounts")
    revalidatePath("/app/cashflow")
    revalidatePath("/app/dashboard")
    revalidatePath("/app/ledger")

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

async function postAccountTransferAction(formData: FormData) {
  "use server"

  const { postAccountTransfer } = await import("@/lib/transactions/operational")

  const fromAccountId = formData.get("from_account_id") as string
  const toAccountId = formData.get("to_account_id") as string
  const amount = parseFloat(formData.get("amount") as string)
  const effectiveDate = formData.get("effective_date") as string
  const description = formData.get("description") as string || undefined
  const redirectEntityId = formData.get("redirect_entity_id") as string | null

  if (!fromAccountId || !toAccountId || !amount || !effectiveDate) {
    throw new Error("Preencha todos os campos obrigatórios")
  }

  await postAccountTransfer({
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    amount,
    effective_date: effectiveDate,
    description,
  })

  // Revalidar paths relevantes
  revalidatePath("/app/accounts")
  revalidatePath("/app/cashflow")
  revalidatePath("/app/dashboard")
  revalidatePath("/app/ledger")

  // Redirecionar mantendo o filtro de entidade se existir
  const redirectUrl = redirectEntityId ? `/app/accounts?entity_id=${redirectEntityId}` : "/app/accounts"
  redirect(redirectUrl)
}

export default async function AccountsPage({
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

  const workspace = await getActiveWorkspace()
  const entityIdFilter = searchParams.entity_id?.trim() || null

  let accounts = []
  let entities = []
  let cashPosition = null
  try {
    // Usar listAccounts com filtro de entidade
    accounts = await listAccounts({
      workspaceId: workspace.id,
      entityId: entityIdFilter,
    })
    entities = await listEntities()
    cashPosition = await getCashPositionSummary(
      entityIdFilter || undefined
    )
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

  // Criar mapa de saldo atual por conta
  const balanceMap = new Map<string, number>()
  if (cashPosition) {
    cashPosition.by_account.forEach((acc) => {
      balanceMap.set(acc.account_id, acc.current_balance)
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  // Calcular totais para o resumo
  const checkingTotal = cashPosition?.totals.checking_total || 0
  const investmentTotal = cashPosition?.totals.investment_total || 0
  const grandTotal = cashPosition?.totals.grand_total || 0
  const asOfDate = cashPosition?.as_of || new Date().toISOString().split("T")[0]

  // Calcular total de saldo atual para rodapé da tabela
  const totalCurrentBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0)

  // Label do filtro atual
  const selectedEntity = entityIdFilter ? entities.find((e) => e.id === entityIdFilter) : null
  const filterLabel = selectedEntity
    ? `Entidade: ${selectedEntity.legal_name} (${selectedEntity.type})`
    : "Consolidado (todas as entidades)"

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Contas</h1>
          <p className="text-muted-foreground">
            Gerencie contas financeiras vinculadas às entidades
          </p>
          <p className="text-sm text-muted-foreground mt-1">{filterLabel}</p>
        </div>

        {/* CP2.1: Resumo no topo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Conta Corrente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(checkingTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">posição em {new Date(asOfDate).toLocaleDateString("pt-BR")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Investimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(investmentTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">posição em {new Date(asOfDate).toLocaleDateString("pt-BR")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Consolidado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(grandTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">posição em {new Date(asOfDate).toLocaleDateString("pt-BR")}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nova Conta</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAccountAction} className="space-y-4">
              <input type="hidden" name="redirect_entity_id" value={entityIdFilter || ""} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="entityId">Entidade</Label>
                  <select
                    id="entityId"
                    name="entityId"
                    required
                    defaultValue={entityIdFilter || ""}
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
                  <Label htmlFor="name">Nome da Conta</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ex: Conta Corrente Principal"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="type">Tipo</Label>
                    <HelpTooltip contentKey="accounts.type" />
                  </div>
                  <select
                    id="type"
                    name="type"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="checking">Conta Corrente</option>
                    <option value="investment">Investimento</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="openingBalance">Saldo Inicial</Label>
                    <HelpTooltip contentKey="accounts.opening_balance" />
                  </div>
                  <Input
                    id="openingBalance"
                    name="openingBalance"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    defaultValue="0"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="openingBalanceDate">Data do Saldo Inicial</Label>
                    <HelpTooltip contentKey="accounts.opening_balance_date" />
                  </div>
                  <Input
                    id="openingBalanceDate"
                    name="openingBalanceDate"
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
              <Button type="submit">Criar Conta</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle>Contas Cadastradas</CardTitle>
              <AccountsEntityFilter entities={entities} selectedEntityId={entityIdFilter} />
            </div>
            <AccountTransferDialog 
              accounts={accounts.map(a => ({ id: a.id, name: a.name, type: a.type, entity_id: a.entity_id }))} 
              postAccountTransferAction={postAccountTransferAction}
              entityIdFilter={entityIdFilter}
              allEntities={entities}
            />
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhuma conta cadastrada. Crie uma conta acima.
              </p>
            ) : (
              <AccountsTableClient
                accounts={accounts}
                entities={entities}
                balanceMap={balanceMap}
                onUpdateBalanceAction={updateAccountBalanceAction}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

