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
import { ContractFormClient } from "@/components/contract-form-client"
import type { LineItem } from "./line-items-editor"

type ContractCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entities: Array<{ id: string; legal_name: string; type: string }>
  onCreateAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function ContractCreateDialog({
  open,
  onOpenChange,
  entities,
  onCreateAction,
}: ContractCreateDialogProps) {
  const router = useRouter()
  const [isSuccess, setIsSuccess] = useState(false)
  const [expenses, setExpenses] = useState<LineItem[]>([])
  const [discounts, setDiscounts] = useState<LineItem[]>([])

  // Reset success state when dialog opens
  useEffect(() => {
    if (open) {
      setIsSuccess(false)
      setExpenses([])
      setDiscounts([])
    }
  }, [open])

  // Close dialog and refresh when create succeeds
  const handleSuccess = () => {
    setIsSuccess(true)
    // Close immediately and let the parent refresh
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Contrato</DialogTitle>
          <DialogDescription>
            Preencha os dados do novo contrato. Todos os campos obrigatórios devem ser preenchidos.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <ContractFormClient
            entities={entities}
            expenses={expenses}
            discounts={discounts}
            onExpensesChange={setExpenses}
            onDiscountsChange={setDiscounts}
            action={async (prevState, formData) => {
              // Adicionar expenses e discounts ao FormData
              expenses.forEach((item, index) => {
                formData.append(`expense_${index}_description`, item.description)
                formData.append(`expense_${index}_amount`, item.amount.toString())
              })
              discounts.forEach((item, index) => {
                formData.append(`discount_${index}_description`, item.description)
                formData.append(`discount_${index}_amount`, item.amount.toString())
              })
              
              const result = await onCreateAction(prevState, formData)
              if (result.ok) {
                handleSuccess()
              }
              return result
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
