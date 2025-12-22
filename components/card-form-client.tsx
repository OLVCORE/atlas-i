"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Plus } from "lucide-react"
import { HelpTooltip } from "@/components/help/HelpTooltip"

type Entity = {
  id: string
  legal_name: string
}

type CardTemplate = {
  id: string
  issuer_name: string
  program_name: string | null
  suggested_brand: string | null
  suggested_closing_day: number | null
  suggested_due_day: number | null
}

export function CardFormClient({
  entities,
  onSubmit,
}: {
  entities: Entity[]
  onSubmit: (data: {
    entityId: string
    name: string
    brand?: string
    closingDay: number
    dueDay: number
    isActive: boolean
  }) => Promise<void>
}) {
  const [entityId, setEntityId] = useState("")
  const [name, setName] = useState("")
  const [brand, setBrand] = useState("")
  const [closingDay, setClosingDay] = useState("")
  const [dueDay, setDueDay] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [templates, setTemplates] = useState<CardTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carregar templates
  useEffect(() => {
    setLoadingTemplates(true)
    fetch("/api/cards/templates")
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.error || "Erro ao carregar templates")
          })
        }
        return res.json()
      })
      .then((templatesList: CardTemplate[]) => {
        setTemplates(templatesList)
      })
      .catch((err) => {
        console.error("Erro ao carregar templates:", err)
      })
      .finally(() => {
        setLoadingTemplates(false)
      })
  }, [])

  // Quando selecionar template, preencher campos
  useEffect(() => {
    if (selectedTemplate && !useCustom) {
      const template = templates.find((t) => t.id === selectedTemplate)
      if (template) {
        let displayName = template.issuer_name
        if (template.program_name) {
          displayName = `${template.issuer_name} ${template.program_name}`
        }
        setName(displayName)
        if (template.suggested_brand) {
          setBrand(template.suggested_brand)
        }
        if (template.suggested_closing_day) {
          setClosingDay(template.suggested_closing_day.toString())
        }
        if (template.suggested_due_day) {
          setDueDay(template.suggested_due_day.toString())
        }
      }
    }
  }, [selectedTemplate, templates, useCustom])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!entityId || !name || !closingDay || !dueDay) {
      setError("Preencha todos os campos obrigatórios")
      return
    }

    const closing = parseInt(closingDay)
    const due = parseInt(dueDay)

    if (isNaN(closing) || closing < 1 || closing > 28 || isNaN(due) || due < 1 || due > 28) {
      setError("Dias devem estar entre 1 e 28")
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        entityId,
        name,
        brand: brand || undefined,
        closingDay: closing,
        dueDay: due,
        isActive,
      })
    } catch (err: any) {
      setError(err.message || "Erro ao criar cartão")
      setLoading(false)
    }
  }

  const handleUseCustom = () => {
    setUseCustom(true)
    setSelectedTemplate("")
    setName("")
    setBrand("")
    setClosingDay("")
    setDueDay("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="entityId">Entidade</Label>
          <select
            id="entityId"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Selecione a entidade</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.legal_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="cardName">Nome do Cartão</Label>
            <HelpTooltip contentKey="cards.template" />
          </div>
          {!useCustom && templates.length > 0 ? (
            <div className="space-y-2">
              <select
                id="cardTemplate"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione um template</option>
                {templates.map((template) => {
                  const displayName = template.program_name
                    ? `${template.issuer_name} ${template.program_name}`
                    : template.issuer_name
                  return (
                    <option key={template.id} value={template.id}>
                      {displayName}
                    </option>
                  )
                })}
              </select>
              <div className="flex items-center gap-2">
                <Input
                  id="cardName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ou digite manualmente"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseCustom}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Personalizado
                </Button>
              </div>
            </div>
          ) : (
            <Input
              id="cardName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: LatamPass, XP PJ"
              required
            />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="brand">Bandeira (opcional)</Label>
            <HelpTooltip contentKey="cards.brand" />
          </div>
          <Input
            id="brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Ex: Visa, Mastercard, Elo"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="closingDay">Dia de Corte (1-28)</Label>
            <HelpTooltip contentKey="cards.closing_day" />
          </div>
          <Input
            id="closingDay"
            type="number"
            min="1"
            max="28"
            value={closingDay}
            onChange={(e) => setClosingDay(e.target.value)}
            placeholder="14"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="dueDay">Dia de Pagamento (1-28)</Label>
            <HelpTooltip contentKey="cards.due_day" />
          </div>
          <Input
            id="dueDay"
            type="number"
            min="1"
            max="28"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            placeholder="20"
            required
          />
        </div>

        <div className="space-y-2 flex items-center">
          <input
            id="isActive"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <div className="flex items-center gap-2 ml-2">
            <Label htmlFor="isActive" className="cursor-pointer">
              Ativo
            </Label>
            <HelpTooltip contentKey="cards.active" />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Criando...
          </>
        ) : (
          "Criar Cartão"
        )}
      </Button>
    </form>
  )
}

