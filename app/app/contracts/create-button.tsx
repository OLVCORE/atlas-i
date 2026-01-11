"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ContractCreateDialog } from "@/components/contracts/contract-create-dialog"

type ContractCreateButtonProps = {
  entities: Array<{ id: string; legal_name: string; type: string }>
  onCreateAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function ContractCreateButton({ entities, onCreateAction }: ContractCreateButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Novo Contrato
      </Button>
      <ContractCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entities={entities}
        onCreateAction={onCreateAction}
      />
    </>
  )
}
