"use client"

import { useEffect, useRef } from "react"
import { useFormState } from "react-dom"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HelpTooltip } from "@/components/help/HelpTooltip"

type ContractFormClientProps = {
  entities: Array<{ id: string; legal_name: string; type: string }>
  action: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function ContractFormClient({ entities, action }: ContractFormClientProps) {
  const [state, formAction] = useFormState(action, { ok: true })
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const pending = state?.ok === undefined

  // Limpar formulário após sucesso (quando usado em modal, não redireciona)
  useEffect(() => {
    if (state?.ok === true && state.message) {
      formRef.current?.reset()
      // Não redireciona quando usado em modal - o modal controla o fechamento
    }
  }, [state?.ok, state?.message])

  // Atualizar label do valor mensal baseado no tipo de valor
  useEffect(() => {
    const valueTypeSelect = document.getElementById('value_type') as HTMLSelectElement
    const monthlyValueLabel = document.getElementById('monthly_value_required')
    const monthlyValueOptional = document.getElementById('monthly_value_optional')
    const monthlyValueInput = document.getElementById('monthly_value') as HTMLInputElement

    const updateMonthlyLabel = () => {
      if (valueTypeSelect?.value === 'monthly') {
        monthlyValueLabel?.classList.remove('hidden')
        monthlyValueOptional?.classList.add('hidden')
        monthlyValueInput?.setAttribute('required', 'required')
      } else {
        monthlyValueLabel?.classList.add('hidden')
        monthlyValueOptional?.classList.remove('hidden')
        monthlyValueInput?.removeAttribute('required')
      }
    }

    valueTypeSelect?.addEventListener('change', updateMonthlyLabel)
    updateMonthlyLabel() // Executar na montagem

    return () => {
      valueTypeSelect?.removeEventListener('change', updateMonthlyLabel)
    }
  }, [])

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state?.ok === false && state.error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state?.ok === true && state.message && (
        <div className="rounded-lg border border-green-500 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          {state.message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="counterparty_entity_id">Contraparte</Label>
            <HelpTooltip contentKey="contracts.counterparty" />
          </div>
          <select
            id="counterparty_entity_id"
            name="counterparty_entity_id"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Selecione uma entidade</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.legal_name} ({entity.type})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="title">Título</Label>
            <HelpTooltip contentKey="contracts.title" />
          </div>
          <Input
            id="title"
            name="title"
            required
            placeholder="Ex: Contrato consultoria XYZ"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="description">Descrição</Label>
          </div>
          <Input
            id="description"
            name="description"
            placeholder="Descrição opcional do contrato"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="value_type">Tipo de Valor</Label>
            <HelpTooltip contentKey="contracts.value_type" />
          </div>
          <select
            id="value_type"
            name="value_type"
            required
            defaultValue="total"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="total">Valor Total do Contrato</option>
            <option value="monthly">Valor Mensal</option>
            <option value="quarterly">Valor Trimestral</option>
            <option value="yearly">Valor Anual</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="total_value">Valor Total</Label>
            <HelpTooltip contentKey="contracts.total_value" />
          </div>
          <Input
            id="total_value"
            name="total_value"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="monthly_value">
              Valor Mensal <span id="monthly_value_required" className="text-destructive hidden">*</span>
              <span id="monthly_value_optional" className="text-muted-foreground">(opcional)</span>
            </Label>
          </div>
          <Input
            id="monthly_value"
            name="monthly_value"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="recurrence_period">Período de Recorrência</Label>
          </div>
          <select
            id="recurrence_period"
            name="recurrence_period"
            required
            defaultValue="monthly"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
            <option value="yearly">Anual</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="adjustment_index">Índice de Correção</Label>
            <HelpTooltip contentKey="contracts.adjustment_index" />
          </div>
          <div className="flex gap-2">
            <select
              id="adjustment_index"
              name="adjustment_index"
              required
              defaultValue="NONE"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="NONE">Nenhum</option>
              <option value="IPCA">IPCA</option>
              <option value="IGPM">IGP-M</option>
              <option value="CDI">CDI</option>
              <option value="MANUAL">Manual</option>
              <option value="CUSTOM">Personalizado</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const indexSelect = document.getElementById('adjustment_index') as HTMLSelectElement
                const startDateInput = document.getElementById('start_date') as HTMLInputElement
                const endDateInput = document.getElementById('end_date') as HTMLInputElement
                const index = indexSelect.value
                const startDate = startDateInput.value
                const endDate = endDateInput.value || new Date().toISOString().split('T')[0]

                if (index === 'NONE' || index === 'MANUAL' || index === 'CUSTOM') {
                  alert('Selecione um índice (IPCA, IGP-M ou CDI) para buscar do Banco Central')
                  return
                }

                if (!startDate) {
                  alert('Informe a data de início do contrato')
                  return
                }

                try {
                  const response = await fetch(`/api/indices/bcb?index=${index}&startDate=${startDate}&endDate=${endDate}&accumulated=true`)
                  const data = await response.json()
                  
                  if (data.error) {
                    alert(`Erro: ${data.error}`)
                    return
                  }

                  const percentageInput = document.getElementById('adjustment_percentage') as HTMLInputElement
                  if (percentageInput && data.accumulated !== undefined) {
                    // Mostrar como percentual no input (4.5%), mas será convertido para decimal no submit
                    percentageInput.value = data.accumulated.toFixed(2) + '%'
                  }
                  
                  alert(`Índice ${index} acumulado no período: ${data.accumulated.toFixed(2)}%`)
                } catch (error: any) {
                  console.error('[BCB] Erro ao buscar índice:', error)
                  alert(`Erro ao buscar índice do Banco Central: ${error.message || 'Erro desconhecido'}`)
                }
              }}
              title="Buscar índice do Banco Central"
            >
              🔍 BCB
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="adjustment_frequency">Frequência de Reajuste</Label>
          </div>
          <select
            id="adjustment_frequency"
            name="adjustment_frequency"
            required
            defaultValue="NONE"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="NONE">Nenhum</option>
            <option value="MONTHLY">Mensal</option>
            <option value="QUARTERLY">Trimestral</option>
            <option value="YEARLY">Anual</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="adjustment_percentage">Percentual de Reajuste (opcional)</Label>
            <HelpTooltip contentKey="contracts.adjustment_percentage" />
          </div>
          <Input
            id="adjustment_percentage"
            name="adjustment_percentage"
            type="text"
            placeholder="Ex: 4.5% ou 0.045 (aceita percentual ou decimal)"
            onChange={(e) => {
              // Converter percentual para decimal automaticamente
              let value = e.target.value.trim()
              if (value.endsWith('%')) {
                value = value.slice(0, -1).trim()
                const numValue = Number(value.replace(',', '.'))
                if (!isNaN(numValue)) {
                  // Converter de percentual para decimal (4.5% -> 0.045)
                  e.target.value = (numValue / 100).toFixed(4)
                }
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="currency">Moeda</Label>
          </div>
          <Input
            id="currency"
            name="currency"
            defaultValue="BRL"
            placeholder="BRL"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="start_date">Data de Início</Label>
          </div>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="end_date">Data Final (opcional)</Label>
          </div>
          <Input
            id="end_date"
            name="end_date"
            type="date"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar Contrato"}
        </Button>
      </div>
    </form>
  )
}
