"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { EditAccountDialog } from "./EditAccountDialog"

type AccountListItem = {
  id: string
  name: string
  type: "checking" | "investment" | "other"
  entity_id: string
  opening_balance: number
  opening_balance_as_of?: string | null
  opening_balance_date?: string | null
  currency: string
}

type SortColumn = "name" | "entity" | "type" | "opening_balance" | "date" | "current_balance" | null
type SortDirection = "asc" | "desc" | null

type AccountsTableClientProps = {
  accounts: AccountListItem[]
  entities: Array<{ id: string; legal_name: string }>
  balanceMap: Map<string, number>
  onUpdateAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
  onUpdateBalanceAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
  onDeleteAction: (accountId: string) => Promise<void>
}

export function AccountsTableClient({
  accounts,
  entities,
  balanceMap,
  onUpdateAction,
  onUpdateBalanceAction,
  onDeleteAction,
}: AccountsTableClientProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<AccountListItem | null>(null)
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const formatCurrency = (value: number, currency: string = "BRL") => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value)
  }

  const handleEditClick = (account: AccountListItem) => {
    setSelectedAccount(account)
    setEditDialogOpen(true)
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Se já está ordenando por esta coluna, inverter direção
      setSortDirection(sortDirection === "asc" ? "desc" : sortDirection === "desc" ? null : "asc")
      if (sortDirection === "desc") {
        setSortColumn(null)
      }
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1" />
    }
    if (sortDirection === "desc") {
      return <ArrowDown className="h-4 w-4 ml-1" />
    }
    return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
  }

  // Ordenar contas
  const sortedAccounts = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return [...accounts]
    }

    return [...accounts].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortColumn) {
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "entity":
          const entityA = entities.find(e => e.id === a.entity_id)?.legal_name || ""
          const entityB = entities.find(e => e.id === b.entity_id)?.legal_name || ""
          aValue = entityA.toLowerCase()
          bValue = entityB.toLowerCase()
          break
        case "type":
          aValue = a.type
          bValue = b.type
          break
        case "opening_balance":
          aValue = Number(a.opening_balance)
          bValue = Number(b.opening_balance)
          break
        case "date":
          const dateA = a.opening_balance_as_of || a.opening_balance_date || ""
          const dateB = b.opening_balance_as_of || b.opening_balance_date || ""
          aValue = dateA ? new Date(dateA).getTime() : 0
          bValue = dateB ? new Date(dateB).getTime() : 0
          break
        case "current_balance":
          aValue = balanceMap.get(a.id) ?? 0
          bValue = balanceMap.get(b.id) ?? 0
          break
        default:
          return 0
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue, "pt-BR")
          : bValue.localeCompare(aValue, "pt-BR")
      }

      return sortDirection === "asc" 
        ? (aValue > bValue ? 1 : aValue < bValue ? -1 : 0)
        : (aValue < bValue ? 1 : aValue > bValue ? -1 : 0)
    })
  }, [accounts, entities, balanceMap, sortColumn, sortDirection])

  const handleDeleteClick = async (accountId: string) => {
    if (!confirm("Tem certeza que deseja deletar esta conta? Esta ação não pode ser desfeita.")) {
      return
    }

    setDeletingAccountId(accountId)
    try {
      await onDeleteAction(accountId)
      // Recarregar a página para atualizar a lista
      window.location.reload()
    } catch (error) {
      alert(`Erro ao deletar conta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setDeletingAccountId(null)
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                onClick={() => handleSort("name")}
                className="flex items-center hover:opacity-70"
              >
                Nome
                {getSortIcon("name")}
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => handleSort("entity")}
                className="flex items-center hover:opacity-70"
              >
                Entidade
                {getSortIcon("entity")}
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => handleSort("type")}
                className="flex items-center hover:opacity-70"
              >
                Tipo
                {getSortIcon("type")}
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => handleSort("opening_balance")}
                className="flex items-center hover:opacity-70"
              >
                Saldo Inicial
                {getSortIcon("opening_balance")}
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => handleSort("date")}
                className="flex items-center hover:opacity-70"
              >
                Data
                {getSortIcon("date")}
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => handleSort("current_balance")}
                className="flex items-center hover:opacity-70"
              >
                Saldo Atual
                {getSortIcon("current_balance")}
              </button>
            </TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAccounts.map((account) => {
            const entity = entities.find((e) => e.id === account.entity_id)
            const currentBalance = balanceMap.get(account.id) ?? 0
            const balanceDate = account.opening_balance_as_of || account.opening_balance_date
            
            return (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell>{entity?.legal_name || "N/A"}</TableCell>
                <TableCell>
                  {account.type === "checking"
                    ? "Conta Corrente"
                    : account.type === "investment"
                    ? "Investimento"
                    : "Outro"}
                </TableCell>
                <TableCell>
                  {formatCurrency(Number(account.opening_balance), account.currency)}
                </TableCell>
                <TableCell>
                  {balanceDate
                    ? new Date(balanceDate).toLocaleDateString("pt-BR")
                    : "-"}
                </TableCell>
                <TableCell className="font-semibold">
                  {formatCurrency(currentBalance, account.currency)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(account)}
                      title="Editar conta"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(account.id)}
                      title="Deletar conta"
                      disabled={deletingAccountId === account.id}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {selectedAccount && (
        <EditAccountDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          account={selectedAccount}
          entities={entities}
          currentBalance={balanceMap.get(selectedAccount.id) ?? 0}
          onUpdateAction={onUpdateAction}
          onUpdateBalanceAction={onUpdateBalanceAction}
        />
      )}
    </>
  )
}
