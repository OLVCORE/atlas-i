"use client"

import { useState, useEffect, useCallback } from "react"
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
import { LineItemsEditor, type LineItem } from "@/components/contracts/line-items-editor"
import type { DebitNoteWithItems } from "@/lib/debit-notes"

type DebitNoteEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  debitNote: DebitNoteWithItems | null
  onUpdateAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function DebitNoteEditDialog({
  open,
  onOpenChange,
  debitNote,
  onUpdateAction,
}: DebitNoteEditDialogProps) {
  const router = useRouter()
  const [isSuccess, setIsSuccess] = useState(false)
  const [expenses, setExpenses] = useState<LineItem[]>([])
  const [discounts, setDiscounts] = useState<LineItem[]>([])
  const [description, setDescription] = useState("")
  const [issuedDate, setIssuedDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [loadingItems, setLoadingItems] = useState(false)

  // Separar expenses e discounts dos items da nota
  const loadLineItems = useCallback(async () => {
    if (!debitNote) return
    
    try {
      // Separar items: schedules (contract_schedule_id !== null) vs expenses/discounts (contract_schedule_id === null)
      const scheduleItems = debitNote.items.filter(item => item.contract_schedule_id !== null)
      const customItems = debitNote.items.filter(item => item.contract_schedule_id === null)
      
      // Separar expenses e discounts pelo tipo
      const expensesItems: LineItem[] = customItems
        .filter((item: any) => item.type === 'expense')
        .map((item: any) => ({ id: item.id, description: item.description || "", amount: item.amount }))
      const discountsItems: LineItem[] = customItems
        .filter((item: any) => item.type === 'discount')
        .map((item: any) => ({ id: item.id, description: item.description || "", amount: Math.abs(item.amount) }))
      
      setExpenses(expensesItems)
      setDiscounts(discountsItems)
      setDescription(debitNote.description || "")
      setIssuedDate(debitNote.issued_date)
      setDueDate(debitNote.due_date)
    } catch (error) {
      console.error("[DebitNoteEditDialog] Erro ao carregar line items:", error)
      setExpenses([])
      setDiscounts([])
    } finally {
      setLoadingItems(false)
    }
  }, [debitNote])

  // Load line items when dialog opens
  useEffect(() => {
    if (open && debitNote) {
      setIsSuccess(false)
      setLoadingItems(true)
      loadLineItems()
    }
  }, [open, debitNote, loadLineItems])

  // Close dialog and refresh when update succeeds
  const handleSuccess = () => {
    setIsSuccess(true)
    setTimeout(() => {
      onOpenChange(false)
      router.refresh()
    }, 500)
  }

  if (!debitNote) {
    return null
  }

  // Só permite editar notas em rascunho
  if (debitNote.status !== 'draft') {
    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    const formData = new FormData(e.currentTarget)
    formData.append("id", debitNote.id)
    
    // Adicionar expenses e discounts ao FormData
    expenses.forEach((item, index) => {
      formData.append(`expense_${index}_description`, item.description)
      formData.append(`expense_${index}_amount`, item.amount.toString())
    })
    discounts.forEach((item, index) => {
      formData.append(`discount_${index}_description`, item.description)
      formData.append(`discount_${index}_amount`, item.amount.toString())
    })
    
    const result = await onUpdateAction(null, formData)
    if (result.ok) {
      handleSuccess()
    } else if (result.error) {
      alert(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Nota de Débito</DialogTitle>
          <DialogDescription>
            Atualize as informações da nota de débito. Apenas notas em rascunho podem ser editadas.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="number">Número</Label>
              <Input
                id="number"
                value={debitNote.number}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Fatura mensal - jan/2025"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issued_date">Data de Emissão</Label>
              <Input
                id="issued_date"
                name="issued_date"
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Data de Vencimento</Label>
              <Input
                id="due_date"
                name="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Line Items Editor */}
          <LineItemsEditor
            expenses={expenses}
            discounts={discounts}
            onExpensesChange={setExpenses}
            onDiscountsChange={setDiscounts}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loadingItems}>
              {loadingItems ? "Carregando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
