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
            <Label htmlFor="total_value">Valor Total</Label>
            <HelpTooltip contentKey="contracts.total_value" />
          </div>
          <Input
            id="total_value"
            name="total_value"
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
