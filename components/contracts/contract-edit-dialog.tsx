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

  // Reset success state when dialog opens
  useEffect(() => {
    if (open) {
      setIsSuccess(false)
    }
  }, [open])

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
            action={async (prevState, formData) => {
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
