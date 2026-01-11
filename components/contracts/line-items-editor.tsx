"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Copy, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

export type LineItem = {
  id?: string
  description: string
  amount: number
}

type LineItemsEditorProps = {
  expenses: LineItem[]
  discounts: LineItem[]
  onExpensesChange: (items: LineItem[]) => void
  onDiscountsChange: (items: LineItem[]) => void
  disabled?: boolean
}

export function LineItemsEditor({
  expenses,
  discounts,
  onExpensesChange,
  onDiscountsChange,
  disabled = false,
}: LineItemsEditorProps) {
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [pasteType, setPasteType] = useState<'expense' | 'discount'>('expense')

  // Parse texto colado para criar itens
  const parsePastedText = (text: string): LineItem[] => {
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim())
    const items: LineItem[] = []
    
    for (const line of lines) {
      // Separar por tab ou espaços múltiplos
      const parts = line.split(/\t+| {2,}/).map(p => p.trim()).filter(p => p)
      
      if (parts.length === 0) continue
      
      let description = ""
      let amountStr = ""
      
      if (parts.length === 1) {
        // Apenas um valor (número)
        amountStr = parts[0]
      } else if (parts.length >= 2) {
        // Descrição e valor
        description = parts[0]
        amountStr = parts[parts.length - 1]
      }
      
      // Parse do valor
      let amount = 0
      if (amountStr === "SUSPENSO" || amountStr === "SUSPENSA") {
        continue // Ignora itens suspensos
      }
      
      // Remover formatação (pontos de milhar, vírgula decimal)
      const cleanAmount = amountStr.replace(/\./g, "").replace(",", ".")
      const parsed = parseFloat(cleanAmount)
      
      if (!isNaN(parsed)) {
        amount = parsed
        items.push({
          description: description || "",
          amount,
        })
      }
    }
    
    return items
  }

  const handlePaste = () => {
    const items = parsePastedText(pasteText)
    
    if (items.length === 0) {
      alert("Nenhum item válido encontrado no texto colado")
      return
    }
    
    if (pasteType === 'expense') {
      onExpensesChange([...expenses, ...items])
    } else {
      onDiscountsChange([...discounts, ...items])
    }
    
    setPasteText("")
    setPasteDialogOpen(false)
  }

  const addItem = (type: 'expense' | 'discount') => {
    if (type === 'expense') {
      onExpensesChange([...expenses, { description: "", amount: 0 }])
    } else {
      onDiscountsChange([...discounts, { description: "", amount: 0 }])
    }
  }

  const updateItem = (
    type: 'expense' | 'discount',
    index: number,
    field: 'description' | 'amount',
    value: string | number
  ) => {
    if (type === 'expense') {
      const updated = [...expenses]
      updated[index] = { ...updated[index], [field]: value }
      onExpensesChange(updated)
    } else {
      const updated = [...discounts]
      updated[index] = { ...updated[index], [field]: value }
      onDiscountsChange(updated)
    }
  }

  const removeItem = (type: 'expense' | 'discount', index: number) => {
    if (type === 'expense') {
      onExpensesChange(expenses.filter((_, i) => i !== index))
    } else {
      onDiscountsChange(discounts.filter((_, i) => i !== index))
    }
  }

  return (
    <div className="space-y-6">
      {/* Despesas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Despesas</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPasteType('expense')
                setPasteDialogOpen(true)
              }}
              disabled={disabled}
            >
              <Copy className="h-4 w-4 mr-2" />
              Colar Itens
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addItem('expense')}
              disabled={disabled}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          {expenses.map((item, index) => (
            <div key={index} className="flex gap-2 items-start">
              <Input
                placeholder="Descrição (opcional)"
                value={item.description}
                onChange={(e) => updateItem('expense', index, 'description', e.target.value)}
                disabled={disabled}
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Valor"
                value={item.amount === 0 ? "" : item.amount}
                onChange={(e) => updateItem('expense', index, 'amount', parseFloat(e.target.value) || 0)}
                disabled={disabled}
                className="w-32"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem('expense', index)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {expenses.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma despesa adicionada</p>
          )}
        </div>
      </div>

      {/* Descontos/Créditos/Isenções */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Descontos / Créditos / Isenções</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPasteType('discount')
                setPasteDialogOpen(true)
              }}
              disabled={disabled}
            >
              <Copy className="h-4 w-4 mr-2" />
              Colar Itens
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addItem('discount')}
              disabled={disabled}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          {discounts.map((item, index) => (
            <div key={index} className="flex gap-2 items-start">
              <Input
                placeholder="Descrição (opcional)"
                value={item.description}
                onChange={(e) => updateItem('discount', index, 'description', e.target.value)}
                disabled={disabled}
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Valor"
                value={item.amount === 0 ? "" : item.amount}
                onChange={(e) => updateItem('discount', index, 'amount', parseFloat(e.target.value) || 0)}
                disabled={disabled}
                className="w-32"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem('discount', index)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {discounts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum desconto/crédito adicionado</p>
          )}
        </div>
      </div>

      {/* Dialog de Colar */}
      <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Colar Itens</DialogTitle>
            <DialogDescription>
              Cole os dados da planilha (descrição e valor separados por tab ou espaços).
              Cada linha será convertida em um item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Cole aqui os dados da planilha..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPasteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handlePaste}>
              Adicionar Itens
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
