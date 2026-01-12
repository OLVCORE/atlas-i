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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LineItemsEditor, type LineItem } from "@/components/contracts/line-items-editor"
import { Maximize2, Minimize2 } from "lucide-react"
import type { Contract } from "@/lib/contracts"
import type { ContractSchedule } from "@/lib/schedules"

type GenerateDebitNoteDialogProps = {
  contracts: Contract[]
}

export function GenerateDebitNoteDialog({ contracts }: GenerateDebitNoteDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState("")
  const [schedules, setSchedules] = useState<ContractSchedule[]>([])
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set())
  const [description, setDescription] = useState("")
  const [clientName, setClientName] = useState("")
  const [notes, setNotes] = useState("")
  const [expenses, setExpenses] = useState<LineItem[]>([])
  const [discounts, setDiscounts] = useState<LineItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Buscar schedules quando contrato for selecionado
  useEffect(() => {
    if (!selectedContractId) {
      setSchedules([])
      setSelectedScheduleIds(new Set())
      return
    }

    setIsLoadingSchedules(true)
    fetch(`/api/debit-notes/schedules?contractId=${selectedContractId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          setSchedules([])
        } else {
          setSchedules(data.schedules || [])
          setError(null)
        }
      })
      .catch((err) => {
        setError(err.message || "Erro ao buscar schedules")
        setSchedules([])
      })
      .finally(() => {
        setIsLoadingSchedules(false)
      })
  }, [selectedContractId])

  const handleScheduleToggle = (scheduleId: string) => {
    const newSet = new Set(selectedScheduleIds)
    if (newSet.has(scheduleId)) {
      newSet.delete(scheduleId)
    } else {
      newSet.add(scheduleId)
    }
    setSelectedScheduleIds(newSet)
  }

  const schedulesAmount = schedules
    .filter((s) => selectedScheduleIds.has(s.id))
    .reduce((sum, s) => sum + Number(s.amount), 0)
  
  const expensesAmount = expenses.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0)
  // Descontos: sempre usar valor absoluto (positivo) e subtrair
  const discountsAmount = discounts.reduce((sum, d) => sum + Math.abs(d.amount || 0), 0)
  
  const totalAmount = schedulesAmount + expensesAmount - discountsAmount

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR")
  }

  const handleSubmit = async () => {
    if (!selectedContractId) {
      setError("Selecione um contrato")
      return
    }

    if (selectedScheduleIds.size === 0) {
      setError("Selecione pelo menos um schedule")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/debit-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractId: selectedContractId,
          scheduleIds: Array.from(selectedScheduleIds),
          description: description || null,
          expenses: expenses.map(e => ({ description: e.description || null, amount: e.amount })),
          discounts: discounts.map(d => ({ description: d.description || null, amount: d.amount })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar nota de débito")
      }

      router.refresh()
      setOpen(false)
      
      // Reset form
      setSelectedContractId("")
      setSchedules([])
      setSelectedScheduleIds(new Set())
      setDescription("")
      setClientName("")
      setNotes("")
      setExpenses([])
      setDiscounts([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar nota de débito")
    } finally {
      setIsLoading(false)
    }
  }

  // Filtrar apenas schedules disponíveis (planned, receivable)
  const availableSchedules = schedules.filter(
    (s) => s.status === "planned" && s.type === "receivable"
  )

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button>Gerar Nota de Débito</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className={isFullscreen ? "sm:max-w-[95vw] sm:h-[95vh] max-h-[95vh] overflow-hidden flex flex-col" : "max-w-2xl max-h-[90vh] overflow-y-auto"}>
        <AlertDialogHeader className={isFullscreen ? "flex-shrink-0" : ""}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <AlertDialogTitle>Gerar Nota de Débito</AlertDialogTitle>
              <AlertDialogDescription>
                Selecione um contrato e os schedules para incluir na nota de débito
              </AlertDialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="ml-4"
              title={isFullscreen ? "Minimizar" : "Expandir"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </AlertDialogHeader>

        <div className={`${isFullscreen ? "flex-1 flex flex-col overflow-hidden" : "space-y-4"}`}>
          <div className={`${isFullscreen ? "flex-shrink-0 space-y-4" : "space-y-4"}`}>
            {/* Seleção de Contrato */}
            <div className="space-y-2">
              <Label htmlFor="contract">Contrato *</Label>
              <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Schedules */}
            {selectedContractId && (
              <div className="space-y-2">
                <Label>Schedules Disponíveis *</Label>
                {isLoadingSchedules ? (
                  <div className="text-sm text-muted-foreground">Carregando schedules...</div>
                ) : availableSchedules.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhum schedule disponível para este contrato
                  </div>
                ) : (
                  <div className={`border rounded-md ${isFullscreen ? "max-h-[200px] overflow-y-auto" : "max-h-[300px] overflow-y-auto"}`}>
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left">
                            <input
                              type="checkbox"
                              checked={
                                availableSchedules.length > 0 &&
                                availableSchedules.every((s) => selectedScheduleIds.has(s.id))
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedScheduleIds(new Set(availableSchedules.map((s) => s.id)))
                                } else {
                                  setSelectedScheduleIds(new Set())
                                }
                              }}
                              className="mr-2"
                            />
                            Selecionar
                          </th>
                          <th className="p-2 text-left">Vencimento</th>
                          <th className="p-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableSchedules.map((schedule) => (
                          <tr key={schedule.id} className="border-t">
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={selectedScheduleIds.has(schedule.id)}
                                onChange={() => handleScheduleToggle(schedule.id)}
                                className="mr-2"
                              />
                            </td>
                            <td className="p-2">{formatDate(schedule.due_date)}</td>
                            <td className="p-2 text-right">
                              {formatCurrency(Number(schedule.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Total */}
            {selectedScheduleIds.size > 0 && (
              <div className="bg-muted p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total:</span>
                  <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            )}

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Fatura mensal - jan/2025"
              />
            </div>

            {/* Nome do Cliente */}
            <div className="space-y-2">
              <Label htmlFor="clientName">Nome do Cliente (opcional)</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Kelludy Festas e Eventos"
              />
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informações de depósito/PIX, informações pertinentes ao contrato..."
                rows={4}
              />
            </div>
          </div>

          {/* Line Items Editor */}
          <div className={`border-t pt-4 ${isFullscreen ? "flex-1 flex flex-col min-h-0 overflow-hidden" : ""}`}>
            <h3 className="text-lg font-semibold mb-4">Despesas e Descontos Adicionais</h3>
            <div className={isFullscreen ? "flex-1 overflow-y-auto" : ""}>
              <LineItemsEditor
                expenses={expenses}
                discounts={discounts}
                onExpensesChange={setExpenses}
                onDiscountsChange={setDiscounts}
              />
            </div>
          </div>

          {/* Erro */}
          {error && <div className={`text-sm text-destructive ${isFullscreen ? "flex-shrink-0 mt-4" : ""}`}>{error}</div>}
        </div>

        <AlertDialogFooter className={isFullscreen ? "flex-shrink-0" : ""}>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || selectedScheduleIds.size === 0}>
            {isLoading ? "Gerando..." : "Gerar Nota"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
