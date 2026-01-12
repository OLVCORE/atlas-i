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
import { BankSelect } from "./BankSelect"
import { formatAccountName, getBankByCode } from "@/lib/utils/banks"

type EditAccountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: {
    id: string
    name: string
    entity_id: string
    type: "checking" | "investment" | "other"
    opening_balance: number
    opening_balance_as_of?: string | null
    currency?: string
  }
  entities: Array<{ id: string; legal_name: string }>
  currentBalance: number
  onUpdateAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
  onUpdateBalanceAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function EditAccountDialog({
  open,
  onOpenChange,
  account,
  entities,
  currentBalance,
  onUpdateAction,
  onUpdateBalanceAction,
}: EditAccountDialogProps) {
  const router = useRouter()
  const [name, setName] = useState(account.name)
  const [entityId, setEntityId] = useState(account.entity_id)
  const [type, setType] = useState(account.type)
  const [bankCode, setBankCode] = useState<string>("")
  const [openingBalance, setOpeningBalance] = useState<string>(account.opening_balance.toString())
  const [openingBalanceDate, setOpeningBalanceDate] = useState<string>(
    account.opening_balance_as_of || new Date().toISOString().split("T")[0]
  )
  const [newCurrentBalance, setNewCurrentBalance] = useState<string>("")
  const [currentBalanceDate, setCurrentBalanceDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extrair código do banco do nome se existir (formatos: "Nome - [Código] Banco" ou "Nome - Código - Banco")
  useEffect(() => {
    if (open && account.name) {
      // Tentar formato novo primeiro: "Nome - Código - Banco"
      const newFormatMatch = account.name.match(/\s+-\s+(\d+)\s+-\s+/)
      if (newFormatMatch) {
        setBankCode(newFormatMatch[1])
        // Remover a parte do banco do nome (Código - Banco)
        const nameWithoutBank = account.name.replace(/\s+-\s+\d+\s+-\s+.*$/, "").trim()
        setName(nameWithoutBank || account.name)
      } else {
        // Tentar formato antigo: "Nome - [Código] Banco"
        const oldFormatMatch = account.name.match(/\[(\d+)\]/)
        if (oldFormatMatch) {
          setBankCode(oldFormatMatch[1])
          // Remover a parte do banco do nome
          const nameWithoutBank = account.name.replace(/\s*-\s*\[\d+\]\s*.*$/, "").trim()
          setName(nameWithoutBank || account.name)
        } else {
          setBankCode("")
          setName(account.name)
        }
      }
    }
  }, [open, account.name])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEntityId(account.entity_id)
      setType(account.type)
      setOpeningBalance(account.opening_balance.toString())
      setOpeningBalanceDate(account.opening_balance_as_of || new Date().toISOString().split("T")[0])
      setNewCurrentBalance("")
      setCurrentBalanceDate(new Date().toISOString().split("T")[0])
      setError(null)
    }
  }, [open, account])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: account.currency || "BRL",
    }).format(value)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Formatar nome da conta com código do banco se selecionado
      let finalName = name.trim()
      if (bankCode) {
        const bank = getBankByCode(bankCode)
        if (bank) {
          finalName = formatAccountName(bank.code, bank.name, name.trim())
        }
      }

      const formData = new FormData()
      formData.append("accountId", account.id)
      formData.append("name", finalName)
      formData.append("entityId", entityId)
      formData.append("type", type)
      formData.append("openingBalance", parseFloat(openingBalance.replace(",", ".")).toString())
      formData.append("openingBalanceDate", openingBalanceDate)
      if (bankCode) {
        formData.append("bankCode", bankCode)
      }

      // Atualizar dados da conta
      const result = await onUpdateAction(null, formData)
      
      if (!result.ok) {
        setError(result.error || "Erro ao atualizar conta")
        setIsLoading(false)
        return
      }

      // Atualizar saldo atual se fornecido
      if (newCurrentBalance && newCurrentBalance.trim() !== "") {
        const balanceValue = parseFloat(newCurrentBalance.replace(",", "."))
        if (!isNaN(balanceValue)) {
          const balanceFormData = new FormData()
          balanceFormData.append("accountId", account.id)
          balanceFormData.append("newBalance", balanceValue.toString())
          balanceFormData.append("balanceDate", currentBalanceDate)
          
          const balanceResult = await onUpdateBalanceAction(null, balanceFormData)
          
          if (!balanceResult.ok) {
            setError(balanceResult.error || "Erro ao atualizar saldo atual")
            setIsLoading(false)
            return
          }
        }
      }
      
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar conta")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Conta</DialogTitle>
          <DialogDescription>
            Edite os dados da conta
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="editEntityId">Entidade</Label>
              <select
                id="editEntityId"
                name="entityId"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.legal_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editBankCode">Banco (opcional)</Label>
              <BankSelect 
                name="bankCode" 
                value={bankCode}
                onChange={(code) => setBankCode(code)}
                className="w-full"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="editName">Nome da Conta</Label>
              <Input
                id="editName"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Conta Corrente Principal"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editType">Tipo</Label>
              <select
                id="editType"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as "checking" | "investment" | "other")}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="checking">Conta Corrente</option>
                <option value="investment">Investimento</option>
                <option value="other">Outro</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editOpeningBalanceDate">Data do Saldo Inicial</Label>
              <Input
                id="editOpeningBalanceDate"
                name="openingBalanceDate"
                type="date"
                value={openingBalanceDate}
                onChange={(e) => setOpeningBalanceDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editOpeningBalance">Saldo Inicial</Label>
              <Input
                id="editOpeningBalance"
                name="openingBalance"
                type="text"
                inputMode="decimal"
                value={openingBalance}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d,.-]/g, "")
                  setOpeningBalance(value)
                }}
                placeholder="0,00"
                required
              />
              <p className="text-xs text-muted-foreground">
                Use vírgula ou ponto como separador decimal
              </p>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-semibold">Atualizar Saldo Atual</h3>
            <div className="grid gap-4 md:grid-cols-2">
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
                <Label htmlFor="currentBalanceDate">Data do Novo Saldo</Label>
                <Input
                  id="currentBalanceDate"
                  name="currentBalanceDate"
                  type="date"
                  value={currentBalanceDate}
                  onChange={(e) => setCurrentBalanceDate(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="newCurrentBalance">Novo Saldo Atual (opcional)</Label>
                <Input
                  id="newCurrentBalance"
                  name="newCurrentBalance"
                  type="text"
                  inputMode="decimal"
                  value={newCurrentBalance}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d,.-]/g, "")
                    setNewCurrentBalance(value)
                  }}
                  placeholder="Deixe em branco para manter o saldo atual"
                />
                <p className="text-xs text-muted-foreground">
                  Use vírgula ou ponto como separador decimal. Deixe em branco se não quiser alterar o saldo atual.
                </p>
                {newCurrentBalance && !isNaN(parseFloat(newCurrentBalance.replace(",", "."))) && (
                  <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Diferença:</span>
                      <span className={`font-semibold ${
                        parseFloat(newCurrentBalance.replace(",", ".")) - currentBalance >= 0 
                          ? "text-green-600" 
                          : "text-red-600"
                      }`}>
                        {parseFloat(newCurrentBalance.replace(",", ".")) - currentBalance >= 0 ? "+" : ""}
                        {formatCurrency(parseFloat(newCurrentBalance.replace(",", ".")) - currentBalance)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

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
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
