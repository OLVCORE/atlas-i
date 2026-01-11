"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil } from "lucide-react"
import { UpdateBalanceDialog } from "./UpdateBalanceDialog"

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

type AccountsTableClientProps = {
  accounts: AccountListItem[]
  entities: Array<{ id: string; legal_name: string }>
  balanceMap: Map<string, number>
  onUpdateBalanceAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function AccountsTableClient({
  accounts,
  entities,
  balanceMap,
  onUpdateBalanceAction,
}: AccountsTableClientProps) {
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<{
    id: string
    name: string
    currentBalance: number
    currency: string
  } | null>(null)

  const formatCurrency = (value: number, currency: string = "BRL") => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value)
  }

  const handleUpdateClick = (account: AccountListItem) => {
    const currentBalance = balanceMap.get(account.id) ?? 0
    setSelectedAccount({
      id: account.id,
      name: account.name,
      currentBalance,
      currency: account.currency,
    })
    setUpdateDialogOpen(true)
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Entidade</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Saldo Inicial</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Saldo Atual</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => {
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUpdateClick(account)}
                    title="Atualizar saldo"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {selectedAccount && (
        <UpdateBalanceDialog
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          accountId={selectedAccount.id}
          accountName={selectedAccount.name}
          currentBalance={selectedAccount.currentBalance}
          currency={selectedAccount.currency}
          onUpdateAction={onUpdateBalanceAction}
        />
      )}
    </>
  )
}
