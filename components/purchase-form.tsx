"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { HelpTooltip } from "@/components/help/HelpTooltip"

type Entity = {
  id: string
  legal_name: string
  type: string
}

type Card = {
  id: string
  name: string
  closing_day: number
  due_day: number
}

export function PurchaseForm({
  entities,
  onSubmit,
}: {
  entities: Entity[]
  onSubmit: (data: {
    entityId: string
    cardId: string
    purchaseDate: string
    merchant?: string
    description?: string
    totalAmount: number
    installments: number
    firstInstallmentMonth?: string
  }) => Promise<void>
}) {
  const [entityId, setEntityId] = useState("")
  const [cards, setCards] = useState<Card[]>([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [cardId, setCardId] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0])
  const [merchant, setMerchant] = useState("")
  const [description, setDescription] = useState("")
  const [totalAmount, setTotalAmount] = useState("")
  const [installments, setInstallments] = useState("1")
  const [firstInstallmentMonth, setFirstInstallmentMonth] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Carregar cartões quando entidade for selecionada
  useEffect(() => {
    if (entityId) {
      setLoadingCards(true)
      fetch(`/api/cards/by-entity?entityId=${encodeURIComponent(entityId)}`)
        .then((res) => {
          if (!res.ok) {
            return res.json().then((data) => {
              throw new Error(data.error || "Erro ao carregar cartões")
            })
          }
          return res.json()
        })
        .then((cardsList: Card[]) => {
          setCards(cardsList)
          setCardId("")
        })
        .catch((err) => {
          setError(err.message || "Erro ao carregar cartões")
        })
        .finally(() => {
          setLoadingCards(false)
        })
    } else {
      setCards([])
      setCardId("")
    }
  }, [entityId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!entityId || !cardId || !purchaseDate || !totalAmount || !installments) {
      setError("Preencha todos os campos obrigatórios")
      return
    }

    const amount = parseFloat(totalAmount)
    const installmentsNum = parseInt(installments)

    if (isNaN(amount) || amount <= 0) {
      setError("Valor total deve ser maior que zero")
      return
    }

    if (isNaN(installmentsNum) || installmentsNum < 1 || installmentsNum > 36) {
      setError("Número de parcelas deve ser entre 1 e 36")
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        entityId,
        cardId,
        purchaseDate,
        merchant: merchant || undefined,
        description: description || undefined,
        totalAmount: amount,
        installments: installmentsNum,
        firstInstallmentMonth: firstInstallmentMonth || undefined,
      })
    } catch (err: any) {
      setError(err.message || "Erro ao registrar compra")
      setLoading(false)
    }
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
                {entity.legal_name} ({entity.type})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="cardId">Cartão</Label>
            <HelpTooltip contentKey="purchases.card" />
          </div>
          {loadingCards ? (
            <div className="flex h-10 items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando cartões...
            </div>
          ) : cards.length === 0 && entityId ? (
            <div className="space-y-2">
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Nenhum cartão cadastrado para esta entidade.
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/app/cards")}
                className="w-full"
              >
                Cadastrar cartão
              </Button>
            </div>
          ) : (
            <select
              id="cardId"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              required
              disabled={!entityId || cards.length === 0}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <option value="">
                {!entityId
                  ? "Selecione primeiro a entidade"
                  : "Selecione o cartão"}
              </option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} (Corte: {card.closing_day}, Pagamento: {card.due_day})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="purchaseDate">Data da Compra</Label>
            <HelpTooltip contentKey="purchases.purchase_date" />
          </div>
          <Input
            id="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="merchant">Estabelecimento (opcional)</Label>
          <Input
            id="merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Ex: Supermercado XYZ"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição da compra"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="totalAmount">Valor Total</Label>
            <HelpTooltip contentKey="purchases.total_amount" />
          </div>
          <Input
            id="totalAmount"
            type="number"
            step="0.01"
            min="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="installments">Número de Parcelas (1-36)</Label>
            <HelpTooltip contentKey="purchases.installments" />
          </div>
          <Input
            id="installments"
            type="number"
            min="1"
            max="36"
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? "Ocultar" : "Mostrar"} opções avançadas
          </button>
          {showAdvanced && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="firstInstallmentMonth">
                  Mês de Competência Inicial (opcional)
                </Label>
                <HelpTooltip contentKey="purchases.competence" />
              </div>
              <Input
                id="firstInstallmentMonth"
                type="month"
                value={firstInstallmentMonth}
                onChange={(e) => setFirstInstallmentMonth(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Se não informado, será calculado automaticamente pelo ciclo do cartão
              </p>
            </div>
          )}
        </div>
      </div>

      <Button type="submit" disabled={loading || (!!entityId && cards.length === 0)}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gerando parcelas...
          </>
        ) : (
          "Gerar Parcelas"
        )}
      </Button>
    </form>
  )
}

