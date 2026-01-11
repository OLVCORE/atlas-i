"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { DebitNoteWithItems } from "@/lib/debit-notes"
import type { Transaction } from "@/lib/transactions"

type ReconcileDebitNoteDialogProps = {
  debitNote: DebitNoteWithItems
}

export function ReconcileDebitNoteDialog({ debitNote }: ReconcileDebitNoteDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedTransactionId, setSelectedTransactionId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Buscar transações compatíveis quando dialog abrir
  useEffect(() => {
    if (!open) return

    setIsLoadingTransactions(true)
    fetch(`/api/debit-notes/match?amount=${debitNote.total_amount}&date=${debitNote.due_date}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          setTransactions([])
        } else {
          setTransactions(data.transactions || [])
          // Pre-selecionar primeira transação se houver match perfeito
          if (data.transactions && data.transactions.length === 1) {
            setSelectedTransactionId(data.transactions[0].id)
          }
        }
      })
      .catch((err) => {
        setError(err.message || "Erro ao buscar transações")
        setTransactions([])
      })
      .finally(() => {
        setIsLoadingTransactions(false)
      })
  }, [open, debitNote.total_amount, debitNote.due_date])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR")
  }

  const handleReconcile = async () => {
    if (!selectedTransactionId) {
      setError("Selecione uma transação")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/debit-notes/${debitNote.id}/reconcile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionId: selectedTransactionId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao reconciliar nota de débito")
      }

      router.refresh()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reconciliar nota de débito")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reconciliar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Reconciliar Nota de Débito</AlertDialogTitle>
          <AlertDialogDescription>
            Vincule esta nota de débito a uma transação de recebimento
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Informações da Nota */}
          <div className="bg-muted p-4 rounded-md space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Número:</span>
              <span className="font-medium">{debitNote.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Valor:</span>
              <span className="font-medium">{formatCurrency(debitNote.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Vencimento:</span>
              <span className="font-medium">{formatDate(debitNote.due_date)}</span>
            </div>
          </div>

          {/* Lista de Transações */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Transações Compatíveis</label>
            {isLoadingTransactions ? (
              <div className="text-sm text-muted-foreground">Carregando transações...</div>
            ) : transactions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhuma transação compatível encontrada
              </div>
            ) : (
              <div className="border rounded-md max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Selecionar</th>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Descrição</th>
                      <th className="p-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className={`border-t cursor-pointer hover:bg-muted ${
                          selectedTransactionId === tx.id ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedTransactionId(tx.id)}
                      >
                        <td className="p-2">
                          <input
                            type="radio"
                            name="transaction"
                            checked={selectedTransactionId === tx.id}
                            onChange={() => setSelectedTransactionId(tx.id)}
                          />
                        </td>
                        <td className="p-2">{formatDate(tx.date)}</td>
                        <td className="p-2">{tx.description}</td>
                        <td className="p-2 text-right">{formatCurrency(tx.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Erro */}
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleReconcile}
            disabled={isLoading || !selectedTransactionId || transactions.length === 0}
          >
            {isLoading ? "Reconciliando..." : "Reconciliar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
