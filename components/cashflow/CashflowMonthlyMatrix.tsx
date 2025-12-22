"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MonthlyCashflowMonth } from "@/lib/cashflow/monthly"

type CashflowMonthlyMatrixProps = {
  months: MonthlyCashflowMonth[]
  showMode?: 'both' | 'planned' | 'realised'
  openingBalance?: number
  openingDate?: string | null
  onCellClick?: (row: string, month: string, kind: 'planned' | 'realised', direction: 'income' | 'expense' | 'net' | 'cum') => void
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatMonth = (monthStart: string) => {
  const date = new Date(monthStart + "T00:00:00")
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
}

export function CashflowMonthlyMatrix({ months, showMode = 'both', openingBalance, openingDate, onCellClick }: CashflowMonthlyMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: string; month: string } | null>(null)

  if (months.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhum dado disponível para o período selecionado.
      </div>
    )
  }

  const allRows: Array<{
    key: string
    label: string
    getValue: (month: MonthlyCashflowMonth) => number
    kind: 'planned' | 'realised'
    direction: 'income' | 'expense' | 'net' | 'cum' | 'projected'
  }> = [
    {
      key: "planned_income",
      label: "Receitas Previstas",
      getValue: (m) => m.planned_income,
      kind: "planned",
      direction: "income",
    },
    {
      key: "realised_income",
      label: "Receitas Realizadas",
      getValue: (m) => m.realised_income,
      kind: "realised",
      direction: "income",
    },
    {
      key: "planned_expense",
      label: "Despesas Previstas",
      getValue: (m) => m.planned_expense,
      kind: "planned",
      direction: "expense",
    },
    {
      key: "realised_expense",
      label: "Despesas Realizadas",
      getValue: (m) => m.realised_expense,
      kind: "realised",
      direction: "expense",
    },
    {
      key: "planned_net",
      label: "Saldo do Mês (Previsto)",
      getValue: (m) => m.planned_net,
      kind: "planned",
      direction: "net",
    },
    {
      key: "realised_net",
      label: "Saldo do Mês (Realizado)",
      getValue: (m) => m.realised_net,
      kind: "realised",
      direction: "net",
    },
    {
      key: "planned_cum",
      label: "Saldo Acumulado (Previsto)",
      getValue: (m) => m.planned_cum_adj ?? m.planned_cum,
      kind: "planned",
      direction: "cum",
    },
    {
      key: "realised_cum",
      label: "Saldo Acumulado (Realizado)",
      getValue: (m) => m.realised_cum_adj ?? m.realised_cum,
      kind: "realised",
      direction: "cum",
    },
  ]

  // Filtrar linhas baseado em showMode
  const rows = allRows.filter(row => {
    if (showMode === 'both') return true
    if (showMode === 'planned') return row.kind === 'planned'
    if (showMode === 'realised') return row.kind === 'realised'
    return true
  })

  const handleCellClick = (
    rowKey: string,
    monthStart: string,
    kind: 'planned' | 'realised',
    direction: 'income' | 'expense' | 'net' | 'cum'
  ) => {
    if (onCellClick) {
      onCellClick(rowKey, monthStart, kind, direction)
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return ""
    try {
      const date = new Date(dateStr + "T00:00:00")
      return date.toLocaleDateString("pt-BR")
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-4">
      {/* Bloco informativo de opening balance */}
      {openingBalance !== undefined && openingBalance !== null && (
        <div className="text-sm text-muted-foreground">
          {openingBalance !== 0 || openingDate ? (
            <>
              Saldo de abertura em {openingDate ? formatDate(openingDate) : "período"}:{" "}
              <span className="font-medium">{formatCurrency(openingBalance)}</span>
            </>
          ) : (
            "Sem saldo de abertura cadastrado para o período."
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background min-w-[200px]">
              Categoria
            </TableHead>
            {months.map((month) => (
              <TableHead key={month.month_start} className="text-right min-w-[120px]">
                {formatMonth(month.month_start)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="sticky left-0 z-10 bg-background font-medium">
                {row.label}
              </TableCell>
              {months.map((month) => {
                const value = row.getValue(month)
                const isNegative = value < 0
                const isCumulative = row.direction === 'cum'
                const isNet = row.direction === 'net'
                const isHovered = hoveredCell?.row === row.key && hoveredCell?.month === month.month_start
                const isProjected = row.direction === 'projected'
                const isClickable = !!onCellClick && !isProjected

                return (
                  <TableCell
                    key={month.month_start}
                    className={`text-right ${
                      isNegative ? "text-destructive" : (isCumulative || isProjected) ? "font-semibold" : ""
                    } ${isProjected ? "text-muted-foreground" : ""} ${isHovered && isClickable ? "bg-muted" : ""} ${isClickable ? "cursor-pointer hover:bg-muted/50" : ""}`}
                    onClick={() => {
                      if (!isProjected && onCellClick) {
                        onCellClick(row.key, month.month_start, row.kind, row.direction as 'income' | 'expense' | 'net' | 'cum')
                      }
                    }}
                    onMouseEnter={() => !isProjected && setHoveredCell({ row: row.key, month: month.month_start })}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    {formatCurrency(Math.abs(value))}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}

