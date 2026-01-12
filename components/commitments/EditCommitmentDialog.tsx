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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCategoriesByType, type Category } from "@/lib/utils/categories"
import type { Commitment } from "@/lib/commitments"

type EditCommitmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  commitment: Commitment
  entities: Array<{ id: string; legal_name: string }>
  onUpdateAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function EditCommitmentDialog({
  open,
  onOpenChange,
  commitment,
  entities,
  onUpdateAction,
}: EditCommitmentDialogProps) {
  const router = useRouter()
  const [description, setDescription] = useState(commitment.description)
  const [category, setCategory] = useState(commitment.category || "")
  const [endDate, setEndDate] = useState<string>(commitment.end_date || "")
  const [recurrence, setRecurrence] = useState<"none" | "monthly" | "quarterly" | "yearly" | "custom">(commitment.recurrence)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = getCategoriesByType(commitment.type)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDescription(commitment.description)
      setCategory(commitment.category || "")
      setEndDate(commitment.end_date || "")
      setRecurrence(commitment.recurrence)
      setError(null)
    }
  }, [open, commitment])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("commitmentId", commitment.id)
      formData.append("description", description.trim())
      formData.append("category", category.trim() || "")
      formData.append("endDate", endDate || "")
      formData.append("recurrence", recurrence)

      const result = await onUpdateAction(null, formData)
      
      if (result.ok) {
        onOpenChange(false)
        router.refresh()
      } else {
        setError(result.error || "Erro ao atualizar compromisso")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar compromisso")
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (value: number, currency: string = "BRL") => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Compromisso</DialogTitle>
          <DialogDescription>
            Edite os dados do compromisso
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="editType">Tipo</Label>
              <Input
                id="editType"
                value={commitment.type === "expense" ? "Despesa" : "Receita"}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editEntity">Entidade</Label>
              <Input
                id="editEntity"
                value={entities.find(e => e.id === commitment.entity_id)?.legal_name || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="editDescription">Descrição</Label>
              <Input
                id="editDescription"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Aluguel, IPTU, Energia"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editCategory">Categoria</Label>
              <select
                id="editCategory"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecione uma categoria</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editTotalAmount">Valor Total</Label>
              <Input
                id="editTotalAmount"
                value={formatCurrency(commitment.total_amount, commitment.currency)}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Valor não pode ser alterado (regra de governança)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editStartDate">Data de Início</Label>
              <Input
                id="editStartDate"
                value={new Date(commitment.start_date + "T00:00:00").toLocaleDateString("pt-BR")}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Data não pode ser alterada (regra de governança)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editEndDate">Data Final (opcional)</Label>
              <Input
                id="editEndDate"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editRecurrence">Recorrência</Label>
              <select
                id="editRecurrence"
                name="recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as "none" | "monthly" | "quarterly" | "yearly" | "custom")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="none">Nenhuma (único)</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
