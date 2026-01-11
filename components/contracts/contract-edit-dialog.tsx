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
import { ContractEditFormClient } from "./contract-edit-form-client"
import type { Contract } from "@/lib/contracts"
import type { LineItem } from "./line-items-editor"
import { listContractLineItems } from "@/lib/contract-line-items"

type ContractEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: Contract | null
  entities: Array<{ id: string; legal_name: string; type: string }>
  onUpdateAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function ContractEditDialog({
  open,
  onOpenChange,
  contract,
  entities,
  onUpdateAction,
}: ContractEditDialogProps) {
  const router = useRouter()
  const [isSuccess, setIsSuccess] = useState(false)
  const [expenses, setExpenses] = useState<LineItem[]>([])
  const [discounts, setDiscounts] = useState<LineItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  // Load line items when dialog opens
  useEffect(() => {
    if (open && contract) {
      setIsSuccess(false)
      setLoadingItems(true)
      loadLineItems()
    }
  }, [open, contract])

  const loadLineItems = async () => {
    if (!contract) return
    
    try {
      const items = await listContractLineItems(contract.id)
      const expensesItems: LineItem[] = items
        .filter(item => item.type === 'expense')
        .map(item => ({ id: item.id, description: item.description || "", amount: item.amount }))
      const discountsItems: LineItem[] = items
        .filter(item => item.type === 'discount')
        .map(item => ({ id: item.id, description: item.description || "", amount: item.amount }))
      
      setExpenses(expensesItems)
      setDiscounts(discountsItems)
    } catch (error) {
      console.error("[ContractEditDialog] Erro ao carregar line items:", error)
      setExpenses([])
      setDiscounts([])
    } finally {
      setLoadingItems(false)
    }
  }

  // Close dialog and refresh when update succeeds
  const handleSuccess = () => {
    setIsSuccess(true)
    setTimeout(() => {
      onOpenChange(false)
      router.refresh()
    }, 500)
  }

  if (!contract) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Contrato</DialogTitle>
          <DialogDescription>
            Atualize as informações do contrato. Todos os campos obrigatórios devem ser preenchidos.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <ContractEditFormClient
            contract={contract}
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
                if (item.id) {
                  formData.append(`expense_${index}_id`, item.id)
                }
              })
              discounts.forEach((item, index) => {
                formData.append(`discount_${index}_description`, item.description)
                formData.append(`discount_${index}_amount`, item.amount.toString())
                if (item.id) {
                  formData.append(`discount_${index}_id`, item.id)
                }
              })
              
              const result = await onUpdateAction(prevState, formData)
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
