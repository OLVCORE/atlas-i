"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SettleCommitmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  commitmentId: string
  installmentId?: string
  entityId: string
  defaultAmount: number
  defaultDescription?: string
  accounts: Array<{ id: string; name: string; type: string; entity_id?: string }>
  postTransactionFromCommitmentAction: (formData: FormData) => Promise<void>
}

export function SettleCommitmentDialog({
  open,
  onOpenChange,
  commitmentId,
  installmentId,
  entityId,
  defaultAmount,
  defaultDescription,
  accounts,
  postTransactionFromCommitmentAction,
}: SettleCommitmentDialogProps) {
  const router = useRouter()
  const [accountId, setAccountId] = useState<string>("")
  const [amount, setAmount] = useState<string>(defaultAmount.toString())
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  const [description, setDescription] = useState<string>(defaultDescription || "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtrar contas da mesma entidade
  const eligibleAccounts = accounts.filter((acc) => {
    if (!acc.entity_id) return true // Se não tiver entity_id, incluir (backward compat)
    return acc.entity_id === entityId
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const amountNum = parseFloat(amount)
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Valor inválido")
      }

      if (!accountId) {
        throw new Error("Selecione uma conta")
      }

      const formData = new FormData()
      if (commitmentId && !installmentId) formData.append("commitment_id", commitmentId)
      if (installmentId) formData.append("installment_id", installmentId)
      formData.append("account_id", accountId)
      formData.append("amount", amountNum.toString())
      formData.append("effective_date", effectiveDate)
      if (description) formData.append("description", description)

      await postTransactionFromCommitmentAction(formData)

      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao dar baixa")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dar Baixa em Compromisso</AlertDialogTitle>
          <AlertDialogDescription>
            Registre o pagamento/recebimento real deste compromisso no ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account">Conta *</Label>
            <Select value={accountId} onValueChange={setAccountId} required>
              <SelectTrigger id="account">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {eligibleAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.type === "checking" ? "Conta Corrente" : account.type === "investment" ? "Investimento" : "Outro"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Valor previsto: {formatCurrency(defaultAmount)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective-date">Data Efetiva *</Label>
            <Input
              id="effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição da transação (opcional)"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Confirmar Baixa"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

