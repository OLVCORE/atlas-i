"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type CancelCommitmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  commitmentDescription: string
  futureSchedulesCount?: number
  hasRealizedSchedules?: boolean
}

export function CancelCommitmentDialog({
  open,
  onOpenChange,
  onConfirm,
  commitmentDescription,
  futureSchedulesCount = 0,
  hasRealizedSchedules = false,
}: CancelCommitmentDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    onOpenChange(false)
  }

  let impactMessage = ""
  if (hasRealizedSchedules) {
    impactMessage = "Lançamentos já realizados não serão alterados."
  } else if (futureSchedulesCount > 0) {
    impactMessage = `Esta ação cancelará ${futureSchedulesCount} schedule${futureSchedulesCount > 1 ? "s" : ""} futuro${futureSchedulesCount > 1 ? "s" : ""} ainda não realizados. Lançamentos já realizados não serão alterados.`
  } else {
    impactMessage = "Nenhum schedule será afetado."
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar Compromisso</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Deseja cancelar o compromisso <strong>&quot;{commitmentDescription}&quot;</strong>?
            </p>
            <p className="text-sm">{impactMessage}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirmar Cancelamento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

