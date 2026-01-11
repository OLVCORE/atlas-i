"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type UpdateBalanceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  accountName: string
  currentBalance: number
  currency?: string
  onUpdateAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function UpdateBalanceDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  currentBalance,
  currency = "BRL",
  onUpdateAction,
}: UpdateBalanceDialogProps) {
  const router = useRouter()
  const [newBalance, setNewBalance] = useState<string>("")
  const [balanceDate, setBalanceDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNewBalance("")
      setBalanceDate(new Date().toISOString().split("T")[0])
      setError(null)
    }
  }, [open])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value)
  }

  const difference = newBalance ? parseFloat(newBalance.replace(",", ".")) - currentBalance : 0

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const balanceValue = parseFloat(newBalance.replace(",", "."))
      
      if (isNaN(balanceValue)) {
        setError("Por favor, informe um saldo válido")
        setIsLoading(false)
        return
      }

      const formData = new FormData(e.currentTarget)
      formData.append("accountId", accountId)
      formData.append("newBalance", balanceValue.toString())
      formData.append("balanceDate", balanceDate)

      const result = await onUpdateAction(null, formData)
      
      if (result.ok) {
        onOpenChange(false)
        router.refresh()
      } else {
        setError(result.error || "Erro ao atualizar saldo")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar saldo")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Atualizar Saldo</DialogTitle>
          <DialogDescription>
            Atualize o saldo da conta <strong>{accountName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentBalance">Saldo Atual</Label>
            <Input
              id="currentBalance"
              value={formatCurrency(currentBalance)}
              disabled
              className="bg-muted font-semibold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="balanceDate">Data do Saldo</Label>
            <Input
              id="balanceDate"
              name="balanceDate"
              type="date"
              value={balanceDate}
              onChange={(e) => setBalanceDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newBalance">Novo Saldo</Label>
            <Input
              id="newBalance"
              name="newBalance"
              type="text"
              inputMode="decimal"
              value={newBalance}
              onChange={(e) => {
                // Permitir apenas números, vírgula e ponto
                const value = e.target.value.replace(/[^\d,.-]/g, "")
                setNewBalance(value)
              }}
              placeholder="0,00"
              required
              className="font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Use vírgula ou ponto como separador decimal
            </p>
          </div>

          {newBalance && !isNaN(parseFloat(newBalance.replace(",", "."))) && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Diferença:</span>
                <span className={`font-semibold ${difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {difference >= 0 ? "+" : ""}{formatCurrency(difference)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {difference >= 0 ? "Aumento" : "Redução"} no saldo
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Atualizando..." : "Atualizar Saldo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
