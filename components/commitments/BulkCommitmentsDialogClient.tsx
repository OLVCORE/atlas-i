"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BulkCommitmentsDialog } from "./BulkCommitmentsDialog"
import { Plus } from "lucide-react"

type BulkCommitmentsDialogClientProps = {
  entities: Array<{ id: string; legal_name: string }>
  onCreateAction: (formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function BulkCommitmentsDialogClient({
  entities,
  onCreateAction,
}: BulkCommitmentsDialogClientProps) {
  const [open, setOpen] = useState(false)
  const [entityId, setEntityId] = useState(entities[0]?.id || "")
  const [type, setType] = useState<"expense" | "revenue">("expense")

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Adicionar em Massa
      </Button>
      <BulkCommitmentsDialog
        open={open}
        onOpenChange={setOpen}
        entityId={entityId}
        type={type}
        entities={entities}
        onCreateAction={onCreateAction}
      />
    </>
  )
}
