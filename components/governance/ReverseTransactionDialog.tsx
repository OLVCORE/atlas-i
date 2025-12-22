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

type ReverseTransactionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  transactionDescription: string
  transactionAmount: number
  transactionCurrency?: string
}

export function ReverseTransactionDialog({
  open,
  onOpenChange,
  onConfirm,
  transactionDescription,
  transactionAmount,
  transactionCurrency = "BRL",
}: ReverseTransactionDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    onOpenChange(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: transactionCurrency,
    }).format(value)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reverter Transação</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Deseja reverter a transação <strong>&quot;{transactionDescription}&quot;</strong> no valor de <strong>{formatCurrency(Math.abs(transactionAmount))}</strong>?
            </p>
            <p className="text-sm">
              Esta ação criará uma transação de reversão com valor oposto. O lançamento original permanecerá no histórico.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirmar Reversão
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

