"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CashflowResult } from "@/lib/cashflow"

type CashflowTableClientProps = {
  cashflow: CashflowResult
  granularity: 'day' | 'month'
}

export function CashflowTableClient({ cashflow, granularity }: CashflowTableClientProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatPeriod = (period: string) => {
    if (granularity === 'month') {
      // YYYY-MM -> "Jan 2025"
      const [year, month] = period.split('-')
      const date = new Date(Number(year), Number(month) - 1, 1)
      return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    } else {
      // YYYY-MM-DD -> "01/01/2025"
      return new Date(period + "T00:00:00").toLocaleDateString("pt-BR")
    }
  }

  if (cashflow.entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhum cronograma encontrado no período selecionado.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Período</TableHead>
            <TableHead className="text-right">Previsto Entradas</TableHead>
            <TableHead className="text-right">Previsto Saídas</TableHead>
            <TableHead className="text-right">Saldo Previsto</TableHead>
            <TableHead className="text-right">Realizado Entradas</TableHead>
            <TableHead className="text-right">Realizado Saídas</TableHead>
            <TableHead className="text-right">Saldo Realizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cashflow.entries.map((entry) => (
            <TableRow key={entry.period}>
              <TableCell className="font-medium">{formatPeriod(entry.period)}</TableCell>
              <TableCell className="text-right text-green-600 dark:text-green-400">
                {formatCurrency(entry.previsto_entradas)}
              </TableCell>
              <TableCell className="text-right text-red-600 dark:text-red-400">
                {formatCurrency(entry.previsto_saidas)}
              </TableCell>
              <TableCell className={`text-right font-medium ${entry.saldo_previsto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(entry.saldo_previsto)}
              </TableCell>
              <TableCell className="text-right text-green-600 dark:text-green-400">
                {formatCurrency(entry.realizado_entradas)}
              </TableCell>
              <TableCell className="text-right text-red-600 dark:text-red-400">
                {formatCurrency(entry.realizado_saidas)}
              </TableCell>
              <TableCell className={`text-right font-medium ${entry.saldo_realizado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(entry.saldo_realizado)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="font-bold">
            <TableCell>TOTAL</TableCell>
            <TableCell className="text-right text-green-600 dark:text-green-400">
              {formatCurrency(cashflow.total_previsto_entradas)}
            </TableCell>
            <TableCell className="text-right text-red-600 dark:text-red-400">
              {formatCurrency(cashflow.total_previsto_saidas)}
            </TableCell>
            <TableCell className={`text-right ${cashflow.total_saldo_previsto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(cashflow.total_saldo_previsto)}
            </TableCell>
            <TableCell className="text-right text-green-600 dark:text-green-400">
              {formatCurrency(cashflow.total_realizado_entradas)}
            </TableCell>
            <TableCell className="text-right text-red-600 dark:text-red-400">
              {formatCurrency(cashflow.total_realizado_saidas)}
            </TableCell>
            <TableCell className={`text-right ${cashflow.total_saldo_realizado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(cashflow.total_saldo_realizado)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

