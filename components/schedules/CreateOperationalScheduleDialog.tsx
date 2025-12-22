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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Entity = {
  id: string
  legal_name: string
  type: "PF" | "PJ"
}

type Account = {
  id: string
  name: string
  entity_id: string
}

type CreateOperationalScheduleDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  entities: Entity[]
  accounts?: Account[]
  onSubmit: (formData: FormData) => Promise<void>
}

export function CreateOperationalScheduleDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  entities,
  accounts = [],
  onSubmit,
}: CreateOperationalScheduleDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const onOpenChange = controlledOnOpenChange || setInternalOpen
  const router = useRouter()
  const [mode, setMode] = useState<'recurring' | 'installment'>('recurring')
  const [entityId, setEntityId] = useState("")
  const [type, setType] = useState<'expense' | 'revenue'>('expense')
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [accountId, setAccountId] = useState("")

  // Modo A: Recorrente
  const [monthlyAmount, setMonthlyAmount] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [hasEndDate, setHasEndDate] = useState(true)
  const [endDate, setEndDate] = useState("")

  // Modo B: Parcelado
  const [totalAmount, setTotalAmount] = useState("")
  const [baseDate, setBaseDate] = useState(new Date().toISOString().split("T")[0])
  const [installmentType, setInstallmentType] = useState<'entry_plus_installments' | 'custom_dates'>('entry_plus_installments')
  const [entryAmount, setEntryAmount] = useState("")
  const [numberOfInstallments, setNumberOfInstallments] = useState("")
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState("30")
  const [customSchedules, setCustomSchedules] = useState<Array<{ date: string; amount: string }>>([
    { date: new Date().toISOString().split("T")[0], amount: "" }
  ])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtrar contas da entidade selecionada
  const eligibleAccounts = entityId
    ? accounts.filter((acc) => acc.entity_id === entityId)
    : []

  useEffect(() => {
    if (!open) {
      // Reset form
      setMode('recurring')
      setEntityId("")
      setType('expense')
      setDescription("")
      setCategory("")
      setAccountId("")
      setMonthlyAmount("")
      setStartDate(new Date().toISOString().split("T")[0])
      setHasEndDate(true)
      setEndDate("")
      setTotalAmount("")
      setBaseDate(new Date().toISOString().split("T")[0])
      setInstallmentType('entry_plus_installments')
      setEntryAmount("")
      setNumberOfInstallments("")
      setInstallmentIntervalDays("30")
      setCustomSchedules([{ date: new Date().toISOString().split("T")[0], amount: "" }])
      setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (!entityId || !description) {
        throw new Error("Preencha todos os campos obrigatórios")
      }

      const formData = new FormData()
      formData.append("mode", mode)
      formData.append("entityId", entityId)
      formData.append("type", type)
      formData.append("description", description)
      if (category) formData.append("category", category)
      if (accountId) formData.append("accountId", accountId)

      if (mode === 'recurring') {
        const monthlyAmountNum = parseFloat(monthlyAmount)
        if (isNaN(monthlyAmountNum) || monthlyAmountNum <= 0) {
          throw new Error("Valor mensal deve ser maior que zero")
        }

        formData.append("monthlyAmount", monthlyAmountNum.toString())
        formData.append("startDate", startDate)
        if (hasEndDate) {
          if (!endDate) {
            throw new Error("Informe a data final")
          }
          formData.append("endDate", endDate)
        } else {
          formData.append("endDate", "")
        }
      } else {
        const totalAmountNum = parseFloat(totalAmount)
        if (isNaN(totalAmountNum) || totalAmountNum <= 0) {
          throw new Error("Valor total deve ser maior que zero")
        }

        formData.append("totalAmount", totalAmountNum.toString())
        formData.append("baseDate", baseDate)
        formData.append("installmentType", installmentType)

        if (installmentType === 'entry_plus_installments') {
          const entryAmountNum = parseFloat(entryAmount)
          const numberOfInstallmentsNum = parseInt(numberOfInstallments)
          const intervalDays = parseInt(installmentIntervalDays)

          if (isNaN(entryAmountNum) || entryAmountNum < 0) {
            throw new Error("Valor da entrada inválido")
          }
          if (isNaN(numberOfInstallmentsNum) || numberOfInstallmentsNum < 1) {
            throw new Error("Número de parcelas deve ser >= 1")
          }
          if (isNaN(intervalDays) || intervalDays < 1) {
            throw new Error("Intervalo entre parcelas deve ser >= 1 dia")
          }
          if (entryAmountNum >= totalAmountNum) {
            throw new Error("Valor da entrada deve ser menor que o valor total")
          }

          formData.append("entryAmount", entryAmountNum.toString())
          formData.append("numberOfInstallments", numberOfInstallmentsNum.toString())
          formData.append("installmentIntervalDays", intervalDays.toString())
        } else {
          // Custom dates
          const validSchedules = customSchedules.filter((s) => s.date && s.amount)
          if (validSchedules.length === 0) {
            throw new Error("Adicione pelo menos uma parcela com data e valor")
          }

          const schedulesData: Array<{ date: string; amount: number }> = []
          for (const s of validSchedules) {
            const amountNum = parseFloat(s.amount)
            if (isNaN(amountNum) || amountNum <= 0) {
              throw new Error(`Valor inválido na parcela de ${s.date}`)
            }
            schedulesData.push({ date: s.date, amount: amountNum })
          }

          formData.append("customSchedules", JSON.stringify(schedulesData))
        }
      }

      await onSubmit(formData)

      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cronograma")
    } finally {
      setIsSubmitting(false)
    }
  }

  const addCustomSchedule = () => {
    setCustomSchedules([...customSchedules, { date: new Date().toISOString().split("T")[0], amount: "" }])
  }

  const removeCustomSchedule = (index: number) => {
    setCustomSchedules(customSchedules.filter((_, i) => i !== index))
  }

  const updateCustomSchedule = (index: number, field: 'date' | 'amount', value: string) => {
    const updated = [...customSchedules]
    updated[index] = { ...updated[index], [field]: value }
    setCustomSchedules(updated)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button>➕ Novo Cronograma</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Novo Cronograma Financeiro</AlertDialogTitle>
          <AlertDialogDescription>
            Crie um cronograma operacional (despesas ou recebíveis) que aparecerá no fluxo de caixa previsto.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'recurring' | 'installment')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="recurring">Recorrente Mensal</TabsTrigger>
              <TabsTrigger value="installment">Parcelado / Marcos</TabsTrigger>
            </TabsList>

            {/* Campos comuns */}
            <div className="grid gap-4 md:grid-cols-2 pt-4">
              <div className="space-y-2">
                <Label htmlFor="entityId">Entidade *</Label>
                <Select value={entityId} onValueChange={setEntityId} required>
                  <SelectTrigger id="entityId">
                    <SelectValue placeholder="Selecione a entidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.legal_name} ({entity.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo *</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'expense' | 'revenue')} required>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Pagável (Despesa)</SelectItem>
                    <SelectItem value="revenue">Recebível (Receita)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Energia Elétrica, Contrato de Consultoria"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria (opcional)</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Operacional, Marketing"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountId">Conta (opcional)</Label>
                <Select value={accountId} onValueChange={setAccountId} disabled={!entityId}>
                  <SelectTrigger id="accountId">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Modo A: Recorrente Mensal */}
            <TabsContent value="recurring" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="monthlyAmount">Valor Mensal *</Label>
                  <Input
                    id="monthlyAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={monthlyAmount}
                    onChange={(e) => setMonthlyAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Inicial *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-4">
                    <Label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={hasEndDate}
                        onChange={() => setHasEndDate(true)}
                        className="w-4 h-4"
                      />
                      Até data final
                    </Label>
                    <Label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!hasEndDate}
                        onChange={() => setHasEndDate(false)}
                        className="w-4 h-4"
                      />
                      Sem data final (gerar 12 meses)
                    </Label>
                  </div>
                </div>

                {hasEndDate && (
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Data Final *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      required={hasEndDate}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Modo B: Parcelado / Marcos */}
            <TabsContent value="installment" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="totalAmount">Valor Total *</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseDate">Data Base *</Label>
                  <Input
                    id="baseDate"
                    type="date"
                    value={baseDate}
                    onChange={(e) => setBaseDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="installmentType">Tipo de Parcelamento *</Label>
                  <Select value={installmentType} onValueChange={(v) => setInstallmentType(v as 'entry_plus_installments' | 'custom_dates')}>
                    <SelectTrigger id="installmentType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry_plus_installments">Entrada + Parcelas Iguais</SelectItem>
                      <SelectItem value="custom_dates">Datas Customizadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {installmentType === 'entry_plus_installments' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="entryAmount">Valor da Entrada *</Label>
                      <Input
                        id="entryAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={entryAmount}
                        onChange={(e) => setEntryAmount(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="numberOfInstallments">Nº de Parcelas *</Label>
                      <Input
                        id="numberOfInstallments"
                        type="number"
                        min="1"
                        value={numberOfInstallments}
                        onChange={(e) => setNumberOfInstallments(e.target.value)}
                        placeholder="Ex: 3"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="installmentIntervalDays">Intervalo entre Parcelas (dias) *</Label>
                      <Select value={installmentIntervalDays} onValueChange={setInstallmentIntervalDays}>
                        <SelectTrigger id="installmentIntervalDays">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 dias (mensal)</SelectItem>
                          <SelectItem value="60">60 dias (bimestral)</SelectItem>
                          <SelectItem value="90">90 dias (trimestral)</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {installmentIntervalDays === 'custom' && (
                      <div className="space-y-2">
                        <Label htmlFor="customIntervalDays">Intervalo Customizado (dias) *</Label>
                        <Input
                          id="customIntervalDays"
                          type="number"
                          min="1"
                          value={installmentIntervalDays}
                          onChange={(e) => setInstallmentIntervalDays(e.target.value)}
                          placeholder="Ex: 45"
                          required
                        />
                      </div>
                    )}
                  </>
                )}

                {installmentType === 'custom_dates' && (
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label>Parcelas Customizadas *</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addCustomSchedule}>
                        + Adicionar Parcela
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {customSchedules.map((schedule, index) => (
                        <div key={index} className="flex gap-2 items-end">
                          <div className="flex-1 space-y-2">
                            <Label>Data</Label>
                            <Input
                              type="date"
                              value={schedule.date}
                              onChange={(e) => updateCustomSchedule(index, 'date', e.target.value)}
                              required
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label>Valor</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={schedule.amount}
                              onChange={(e) => updateCustomSchedule(index, 'amount', e.target.value)}
                              placeholder="0.00"
                              required
                            />
                          </div>
                          {customSchedules.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeCustomSchedule(index)}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
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
              {isSubmitting ? "Criando..." : "Criar Cronograma"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

