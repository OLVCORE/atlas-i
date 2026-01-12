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
import { Textarea } from "@/components/ui/textarea"
import { Maximize2, Minimize2 } from "lucide-react"
import { getCategoriesByType } from "@/lib/utils/categories"

type BulkCommitmentItem = {
  description: string
  category: string
  totalAmount: string
  startDate: string
  endDate: string
  recurrence: "none" | "monthly" | "quarterly" | "yearly" | "custom"
}

type BulkCommitmentsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string
  type: "expense" | "revenue"
  entities: Array<{ id: string; legal_name: string }>
  onCreateAction: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function BulkCommitmentsDialog({
  open,
  onOpenChange,
  entityId: defaultEntityId,
  type: defaultType,
  entities,
  onCreateAction,
}: BulkCommitmentsDialogProps) {
  const router = useRouter()
  const [entityId, setEntityId] = useState(defaultEntityId)
  const [type, setType] = useState<"expense" | "revenue">(defaultType)
  const [items, setItems] = useState<BulkCommitmentItem[]>([])
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = getCategoriesByType(type)

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setEntityId(defaultEntityId || entities[0]?.id || "")
      setType(defaultType)
      setItems([{ description: "", category: "", totalAmount: "", startDate: new Date().toISOString().split("T")[0], endDate: "", recurrence: "monthly" }])
      setError(null)
      setPasteText("")
    }
  }, [open, defaultEntityId, defaultType, entities])

  const addItem = () => {
    setItems([...items, { description: "", category: "", totalAmount: "", startDate: new Date().toISOString().split("T")[0], endDate: "", recurrence: "monthly" }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof BulkCommitmentItem, value: string | "none" | "monthly" | "quarterly" | "yearly" | "custom") => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const parsePastedText = (text: string) => {
    const lines = text.split("\n").filter(line => line.trim() !== "")
    const parsed: BulkCommitmentItem[] = []
    
    const today = new Date().toISOString().split("T")[0]
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      
      // Tentar detectar valor na linha (números com vírgula ou ponto)
      const amountMatch = trimmed.match(/(\d+[.,]\d{2}|\d+)/)
      const amount = amountMatch ? amountMatch[1].replace(",", ".") : ""
      
      // Descrição é o resto da linha (sem o valor)
      const description = trimmed.replace(amountMatch ? amountMatch[0] : "", "").trim()
      
      if (description || amount) {
        parsed.push({
          description: description || "Despesa",
          category: "",
          totalAmount: amount || "",
          startDate: today,
          endDate: "",
          recurrence: "monthly",
        })
      }
    }
    
    return parsed
  }

  const handlePasteItems = () => {
    if (!pasteText.trim()) {
      setError("Cole o texto com as despesas")
      return
    }

    const parsed = parsePastedText(pasteText)
    if (parsed.length === 0) {
      setError("Nenhuma despesa detectada no texto colado")
      return
    }

    setItems(parsed)
    setPasteDialogOpen(false)
    setPasteText("")
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!entityId) {
      setError("Selecione uma entidade")
      return
    }

    // Validar itens
    const validItems = items.filter(item => item.description.trim() && item.totalAmount.trim())
    if (validItems.length === 0) {
      setError("Adicione pelo menos um compromisso válido (descrição e valor)")
      return
    }

    setIsLoading(true)

    try {
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      // Criar compromissos um por um
      for (const item of validItems) {
        try {
          const formData = new FormData()
          formData.append("entity_id", entityId)
          formData.append("type", type)
          formData.append("category", item.category.trim() || "")
          formData.append("description", item.description.trim())
          formData.append("total_amount", parseFloat(item.totalAmount.replace(",", ".")).toString())
          formData.append("currency", "BRL")
          formData.append("start_date", item.startDate)
          formData.append("end_date", item.endDate || "")
          formData.append("recurrence", item.recurrence)

          const result = await onCreateAction(null, formData)
          
          if (result.ok) {
            successCount++
          } else {
            errorCount++
            errors.push(`${item.description}: ${result.error || "Erro desconhecido"}`)
          }
        } catch (err) {
          errorCount++
          errors.push(`${item.description}: ${err instanceof Error ? err.message : "Erro desconhecido"}`)
        }
      }

      if (errorCount > 0) {
        setError(`${successCount} compromissos criados com sucesso, ${errorCount} com erro:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n... e mais ${errors.length - 5} erros` : ""}`)
      } else {
        onOpenChange(false)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar compromissos")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Compromissos em Massa</DialogTitle>
            <DialogDescription>
              Adicione múltiplos compromissos de uma vez. Cole a lista de despesas/receitas ou adicione manualmente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulkEntity">Entidade</Label>
                <select
                  id="bulkEntity"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="">Selecione uma entidade</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulkType">Tipo</Label>
                <select
                  id="bulkType"
                  value={type}
                  onChange={(e) => setType(e.target.value as "expense" | "revenue")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="expense">Despesa</option>
                  <option value="revenue">Receita</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasteDialogOpen(true)}
              >
                Colar Lista
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                className="ml-2"
              >
                Adicionar Linha
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Descrição</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Categoria</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Valor</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Data Início</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Data Fim</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Recorrência</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            placeholder="Ex: Aluguel"
                            className="h-8"
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.category}
                            onChange={(e) => updateItem(index, "category", e.target.value)}
                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <option value="">Selecione</option>
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={item.totalAmount}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^\d,.-]/g, "")
                              updateItem(index, "totalAmount", value)
                            }}
                            placeholder="0,00"
                            className="h-8"
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="date"
                            value={item.startDate}
                            onChange={(e) => updateItem(index, "startDate", e.target.value)}
                            className="h-8"
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="date"
                            value={item.endDate}
                            onChange={(e) => updateItem(index, "endDate", e.target.value)}
                            className="h-8"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.recurrence}
                            onChange={(e) => updateItem(index, "recurrence", e.target.value as "none" | "monthly" | "quarterly" | "yearly" | "custom")}
                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <option value="none">Único</option>
                            <option value="monthly">Mensal</option>
                            <option value="quarterly">Trimestral</option>
                            <option value="yearly">Anual</option>
                            <option value="custom">Personalizado</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="h-8 w-8 p-0"
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-line">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Criando..." : `Criar ${items.filter(i => i.description.trim() && i.totalAmount.trim()).length} Compromisso(s)`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para colar texto */}
      <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Colar Lista de Despesas/Receitas</DialogTitle>
            <DialogDescription>
              Cole a lista de despesas/receitas (uma por linha). O sistema tentará detectar valores automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Cole aqui a lista de despesas, uma por linha..."
              rows={10}
              className="font-mono text-sm"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handlePasteItems}>
                Processar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
