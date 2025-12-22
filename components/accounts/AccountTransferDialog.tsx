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

type AccountTransferDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  accounts: Array<{ id: string; name: string; type: string; entity_id: string }>
  postAccountTransferAction: (formData: FormData) => Promise<void>
  entityIdFilter?: string | null
  allEntities?: Array<{ id: string; legal_name: string }>
}

export function AccountTransferDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  accounts,
  postAccountTransferAction,
  entityIdFilter,
  allEntities = [],
}: AccountTransferDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [fromAccountId, setFromAccountId] = useState<string>("")
  const [toEntityId, setToEntityId] = useState<string>("")
  const [toAccountId, setToAccountId] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  const [description, setDescription] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Usar estado interno se não for controlado
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const onOpenChange = controlledOnOpenChange || setInternalOpen

  // Filtrar contas origem: se houver entityIdFilter, apenas dessa entidade, senão todas
  const eligibleFromAccounts = entityIdFilter
    ? accounts.filter((a) => a.entity_id === entityIdFilter)
    : accounts

  // Conta origem selecionada
  const fromAccount = accounts.find((a) => a.id === fromAccountId)

  // Contas destino: se toEntityId estiver selecionado, filtrar por ela, senão todas exceto origem
  const eligibleToAccounts = toEntityId
    ? accounts.filter((a) => a.id !== fromAccountId && a.entity_id === toEntityId)
    : fromAccount
    ? accounts.filter((a) => a.id !== fromAccountId && a.entity_id === fromAccount.entity_id)
    : []

  // Detectar se é inter-entity
  const isInterEntity = fromAccount && toAccountId
    ? accounts.find((a) => a.id === toAccountId)?.entity_id !== fromAccount.entity_id
    : false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const amountNum = parseFloat(amount)
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Valor deve ser maior que zero")
      }

      if (!fromAccountId || !toAccountId) {
        throw new Error("Selecione conta origem e destino")
      }

      if (fromAccountId === toAccountId) {
        throw new Error("Conta origem e destino devem ser diferentes")
      }

      const formData = new FormData()
      formData.append("from_account_id", fromAccountId)
      formData.append("to_account_id", toAccountId)
      formData.append("amount", amountNum.toString())
      formData.append("effective_date", effectiveDate)
      if (description) formData.append("description", description)
      if (entityIdFilter) formData.append("redirect_entity_id", entityIdFilter)

      await postAccountTransferAction(formData)

      onOpenChange(false)
      router.refresh()
      // Reset form
      setFromAccountId("")
      setToEntityId("")
      setToAccountId("")
      setAmount("")
      setDescription("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao realizar transferência")
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {controlledOpen === undefined && (
        <Button onClick={() => setInternalOpen(true)} variant="outline">
          Transferir Saldo
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transferir entre Contas</AlertDialogTitle>
            <AlertDialogDescription>
              Transfira saldo entre contas. Serão criadas 2 transações no ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="from-account">Conta Origem *</Label>
              <Select value={fromAccountId} onValueChange={(value) => {
                setFromAccountId(value)
                setToEntityId("")
                setToAccountId("")
              }} required>
                <SelectTrigger id="from-account">
                  <SelectValue placeholder="Selecione a conta de origem" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleFromAccounts.map((account) => {
                    const entity = allEntities.find((e) => e.id === account.entity_id)
                    return (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type === "checking" ? "Conta Corrente" : account.type === "investment" ? "Investimento" : "Outro"}) - {entity?.legal_name || account.entity_id}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="to-entity">Entidade Destino *</Label>
              <Select
                value={toEntityId}
                onValueChange={(value) => {
                  setToEntityId(value)
                  setToAccountId("")
                }}
                required
                disabled={!fromAccountId}
              >
                <SelectTrigger id="to-entity">
                  <SelectValue placeholder={fromAccountId ? "Selecione a entidade destino" : "Primeiro selecione a conta origem"} />
                </SelectTrigger>
                <SelectContent>
                  {allEntities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="to-account">Conta Destino *</Label>
              <Select
                value={toAccountId}
                onValueChange={setToAccountId}
                required
                disabled={!toEntityId}
              >
                <SelectTrigger id="to-account">
                  <SelectValue placeholder={toEntityId ? "Selecione a conta de destino" : "Primeiro selecione a entidade destino"} />
                </SelectTrigger>
                <SelectContent>
                  {eligibleToAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.type === "checking" ? "Conta Corrente" : account.type === "investment" ? "Investimento" : "Outro"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isInterEntity && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Transferência entre entidades será registrada como Intercompany no ledger.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0.00"
              />
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
                placeholder="Descrição da transferência (opcional)"
              />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

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
                {isSubmitting ? "Transferindo..." : "Confirmar Transferência"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
