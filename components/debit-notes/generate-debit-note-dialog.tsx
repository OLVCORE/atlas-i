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
import { LineItemsEditor, type LineItem } from "@/components/contracts/line-items-editor"
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
  const [expenses, setExpenses] = useState<LineItem[]>([])
  const [discounts, setDiscounts] = useState<LineItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  
  const expensesAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const discountsAmount = discounts.reduce((sum, d) => sum + (d.amount || 0), 0)
  
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
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Gerar Nota de Débito</AlertDialogTitle>
          <AlertDialogDescription>
            Selecione um contrato e os schedules para incluir na nota de débito
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
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
                <div className="border rounded-md max-h-[300px] overflow-y-auto">
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

          {/* Line Items Editor */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Despesas e Descontos Adicionais</h3>
            <LineItemsEditor
              expenses={expenses}
              discounts={discounts}
              onExpensesChange={setExpenses}
              onDiscountsChange={setDiscounts}
            />
          </div>

          {/* Erro */}
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>

        <AlertDialogFooter>
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
