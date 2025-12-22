"use client"

import { useEffect, useRef } from "react"
import { useFormState } from "react-dom"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HelpTooltip } from "@/components/help/HelpTooltip"

type CommitmentFormClientProps = {
  entities: Array<{ id: string; legal_name: string; type: string }>
  action: (prevState: any, formData: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function CommitmentFormClient({ entities, action }: CommitmentFormClientProps) {
  const [state, formAction] = useFormState(action, { ok: true })
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const pending = state?.ok === undefined

  // Limpar formulário após sucesso e refresh da página
  useEffect(() => {
    if (state?.ok === true && state.message) {
      formRef.current?.reset()
      // Refresh para atualizar a lista
      router.refresh()
    }
  }, [state?.ok, state?.message, router])

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
            <Label htmlFor="entity_id">Entidade</Label>
            <HelpTooltip contentKey="commitments.entity" />
          </div>
          <select
            id="entity_id"
            name="entity_id"
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
            <Label htmlFor="type">Tipo</Label>
            <HelpTooltip contentKey="commitments.type" />
          </div>
          <select
            id="type"
            name="type"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="expense">Despesa</option>
            <option value="revenue">Receita</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="category">Categoria</Label>
            <HelpTooltip contentKey="commitments.category" />
          </div>
          <Input
            id="category"
            name="category"
            placeholder="Ex: Marketing, Manutenção, Viagens"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="description">Descrição</Label>
            <HelpTooltip contentKey="commitments.description" />
          </div>
          <Input
            id="description"
            name="description"
            required
            placeholder="Ex: Assinatura Google Ads mensal"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="total_amount">Valor Total</Label>
            <HelpTooltip contentKey="commitments.total_amount" />
          </div>
          <Input
            id="total_amount"
            name="total_amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
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
            <HelpTooltip contentKey="commitments.start_date" />
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
            <HelpTooltip contentKey="commitments.end_date" />
          </div>
          <Input
            id="end_date"
            name="end_date"
            type="date"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="recurrence">Recorrência</Label>
            <HelpTooltip contentKey="commitments.recurrence" />
          </div>
          <select
            id="recurrence"
            name="recurrence"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="none"
          >
            <option value="none">Nenhuma (único)</option>
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
            <option value="yearly">Anual</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar Compromisso"}
        </Button>
      </div>
    </form>
  )
}
