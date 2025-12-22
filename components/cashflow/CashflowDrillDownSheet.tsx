"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import type { CashflowDrillDownItem } from "@/lib/cashflow/drilldown"

type CashflowDrillDownSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  monthStart: string | null
  kind: "planned" | "realised" | null
  direction: "income" | "expense" | "net" | "cum" | null
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR")
}

const formatMonth = (monthStart: string) => {
  const date = new Date(monthStart + "T00:00:00")
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
}

export function CashflowDrillDownSheet({
  open,
  onOpenChange,
  title,
  monthStart,
  kind,
  direction,
}: CashflowDrillDownSheetProps) {
  const [items, setItems] = useState<CashflowDrillDownItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !monthStart || !kind) {
      setItems([])
      setTotal(0)
      setError(null)
      return
    }

    const fetchItems = async () => {
      setLoading(true)
      setError(null)

      try {
        // Determinar direction filter baseado no tipo de linha
        let directionParam: "income" | "expense" | null = null
        if (direction === "income") {
          directionParam = "income"
        } else if (direction === "expense") {
          directionParam = "expense"
        }
        // Para "net" e "cum", não filtrar por direção (mostrar tudo)

        const params = new URLSearchParams({
          month_start: monthStart,
          kind,
        })

        if (directionParam) {
          params.set("direction", directionParam)
        }

        const response = await fetch(`/api/cashflow/drilldown?${params.toString()}`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Erro ao buscar itens")
        }

        const data = await response.json()
        setItems(data.items || [])
        setTotal(data.total || 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido")
        setItems([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [open, monthStart, kind, direction])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {monthStart && (
            <SheetDescription>
              {formatMonth(monthStart)}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6">
          {loading && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum item encontrado para este período.
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
                </p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>{item.entity_name || "Desconhecida"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                      <TableCell className="text-right">
                        {item.link_url ? (
                          <Link
                            href={item.link_url}
                            className="text-primary hover:underline text-sm"
                            onClick={() => onOpenChange(false)}
                          >
                            {item.source_type === 'schedule_commitment' ? 'Compromisso' :
                             item.source_type === 'schedule_contract' ? 'Contrato' :
                             'Ledger'}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

