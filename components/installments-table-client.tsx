"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2 } from "lucide-react"

type Installment = {
  id: string
  workspace_id: string
  entity_id: string
  card_id: string
  purchase_id: string
  installment_number: number
  competence_month: string
  amount: number
  status: 'scheduled' | 'posted' | 'canceled'
  posted_transaction_id: string | null
  created_at: string
}

type Entity = {
  id: string
  legal_name: string
}

type Card = {
  id: string
  name: string
}

type Account = {
  id: string
  name: string
}

export function InstallmentsTableClient({
  installments,
  entities,
  cards,
  initialFilters,
}: {
  installments: Installment[]
  entities: Entity[]
  cards: Card[]
  initialFilters?: {
    entityId?: string
    cardId?: string
    startMonth?: string
    endMonth?: string
    status?: string
  }
}) {
  const router = useRouter()
  const [entityId, setEntityId] = useState(initialFilters?.entityId || "")
  const [cardId, setCardId] = useState(initialFilters?.cardId || "")
  const [startMonth, setStartMonth] = useState(
    initialFilters?.startMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  )
  const [endMonth, setEndMonth] = useState(
    initialFilters?.endMonth || new Date(new Date().getFullYear(), new Date().getMonth() + 2, 1).toISOString().split("T")[0]
  )
  const [status, setStatus] = useState(initialFilters?.status || "")
  const [postingId, setPostingId] = useState<string | null>(null)
  const [showPostModal, setShowPostModal] = useState<string | null>(null)
  const [postAccountId, setPostAccountId] = useState("")
  const [postDescription, setPostDescription] = useState("")
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  const handleFilter = () => {
    const params = new URLSearchParams()
    if (entityId) params.set("entityId", entityId)
    if (cardId) params.set("cardId", cardId)
    if (startMonth) params.set("startMonth", startMonth)
    if (endMonth) params.set("endMonth", endMonth)
    if (status) params.set("status", status)
    router.push(`/app/installments?${params.toString()}`)
  }

  const handleOpenPostModal = async (installment: Installment) => {
    setShowPostModal(installment.id)
    setPostDescription("")
    setPostAccountId("")
    
    // Carregar contas da entidade
    setLoadingAccounts(true)
    try {
      const res = await fetch(`/api/accounts/by-entity?entityId=${encodeURIComponent(installment.entity_id)}`)
      if (res.ok) {
        const accountsData = await res.json()
        setAccounts(accountsData)
      }
    } catch (error) {
      console.error("Erro ao carregar contas:", error)
    } finally {
      setLoadingAccounts(false)
    }
  }

  const handlePostInstallment = async (installmentId: string) => {
    if (!confirm("Deseja realmente postar esta parcela no ledger?")) {
      return
    }

    setPostingId(installmentId)
    try {
      const res = await fetch("/api/installments/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentId,
          accountId: postAccountId || null,
          description: postDescription || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Erro ao postar parcela")
      }

      setShowPostModal(null)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao postar parcela")
    } finally {
      setPostingId(null)
    }
  }

  if (installments.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="filterEntity">Entidade</Label>
            <select
              id="filterEntity"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.legal_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterCard">Cartão</Label>
            <select
              id="filterCard"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterStartMonth">Mês Inicial</Label>
            <Input
              id="filterStartMonth"
              type="month"
              value={startMonth.substring(0, 7)}
              onChange={(e) => setStartMonth(e.target.value + "-01")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterEndMonth">Mês Final</Label>
            <Input
              id="filterEndMonth"
              type="month"
              value={endMonth.substring(0, 7)}
              onChange={(e) => setEndMonth(e.target.value + "-01")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterStatus">Status</Label>
            <select
              id="filterStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="scheduled">Agendado</option>
              <option value="posted">Postado</option>
              <option value="canceled">Cancelado</option>
            </select>
          </div>
        </div>
        <Button onClick={handleFilter}>Filtrar</Button>
        <p className="text-muted-foreground">Sem compras registradas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="filterEntity">Entidade</Label>
          <select
            id="filterEntity"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.legal_name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="filterCard">Cartão</Label>
          <select
            id="filterCard"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="filterStartMonth">Mês Inicial</Label>
          <Input
            id="filterStartMonth"
            type="month"
            value={startMonth.substring(0, 7)}
            onChange={(e) => setStartMonth(e.target.value + "-01")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="filterEndMonth">Mês Final</Label>
          <Input
            id="filterEndMonth"
            type="month"
            value={endMonth.substring(0, 7)}
            onChange={(e) => setEndMonth(e.target.value + "-01")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="filterStatus">Status</Label>
          <select
            id="filterStatus"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="scheduled">Agendado</option>
            <option value="posted">Postado</option>
            <option value="canceled">Cancelado</option>
          </select>
        </div>
      </div>
      <Button onClick={handleFilter}>Filtrar</Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mês Competência</TableHead>
            <TableHead>Cartão</TableHead>
            <TableHead>Parcela</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((installment) => {
            const card = cards.find((c) => c.id === installment.card_id)
            return (
              <TableRow key={installment.id}>
                <TableCell>
                  {new Date(installment.competence_month).toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell>{card?.name || "N/A"}</TableCell>
                <TableCell>{installment.installment_number}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(Number(installment.amount))}
                </TableCell>
                <TableCell>
                  {installment.status === "scheduled" && (
                    <span className="text-yellow-600">Agendado</span>
                  )}
                  {installment.status === "posted" && (
                    <span className="text-green-600">Postado</span>
                  )}
                  {installment.status === "canceled" && (
                    <span className="text-gray-400">Cancelado</span>
                  )}
                </TableCell>
                <TableCell>
                  {installment.status === "scheduled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenPostModal(installment)}
                      disabled={postingId === installment.id}
                    >
                      {postingId === installment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Registrar no Ledger"
                      )}
                    </Button>
                  )}
                  {installment.status === "posted" && (
                    <span className="text-sm text-muted-foreground">Já postado</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Registrar Parcela no Ledger</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="postAccount">Conta (opcional)</Label>
                {loadingAccounts ? (
                  <div className="flex h-10 items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando contas...
                  </div>
                ) : (
                  <select
                    id="postAccount"
                    value={postAccountId}
                    onChange={(e) => setPostAccountId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sem conta específica</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="postDescription">Descrição (opcional)</Label>
                <Input
                  id="postDescription"
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  placeholder="Descrição da transação"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPostModal(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => handlePostInstallment(showPostModal)}
                  disabled={postingId === showPostModal}
                >
                  {postingId === showPostModal ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Postando...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

