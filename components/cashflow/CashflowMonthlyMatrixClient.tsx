"use client"

import { useState } from "react"
import { CashflowMonthlyMatrix } from "./CashflowMonthlyMatrix"
import { CashflowDrillDownSheet } from "./CashflowDrillDownSheet"
import type { MonthlyCashflowMonth, MonthlyCashflowMetadata } from "@/lib/cashflow/monthly"

type CashflowMonthlyMatrixClientProps = {
  months: MonthlyCashflowMonth[]
  metadata?: MonthlyCashflowMetadata
  showMode?: 'both' | 'planned' | 'realised'
}

const getRowLabel = (rowKey: string, kind: 'planned' | 'realised', direction: 'income' | 'expense' | 'net' | 'cum'): string => {
  const kindLabel = kind === 'planned' ? 'Previstas' : 'Realizadas'
  const directionLabel = direction === 'income' ? 'Receitas' :
                         direction === 'expense' ? 'Despesas' :
                         direction === 'net' ? 'Saldo do Mês' :
                         'Saldo Acumulado'
  return `${directionLabel} ${kindLabel}`
}

export function CashflowMonthlyMatrixClient({ months, metadata, showMode = 'both' }: CashflowMonthlyMatrixClientProps) {
  const [drillDownOpen, setDrillDownOpen] = useState(false)
  const [drillDownTitle, setDrillDownTitle] = useState("")
  const [drillDownMonth, setDrillDownMonth] = useState<string | null>(null)
  const [drillDownKind, setDrillDownKind] = useState<"planned" | "realised" | null>(null)
  const [drillDownDirection, setDrillDownDirection] = useState<"income" | "expense" | "net" | "cum" | null>(null)

  const handleCellClick = (
    rowKey: string,
    monthStart: string,
    kind: 'planned' | 'realised',
    direction: 'income' | 'expense' | 'net' | 'cum'
  ) => {
    const title = getRowLabel(rowKey, kind, direction)
    if (!title) return
    setDrillDownTitle(title)
    setDrillDownMonth(monthStart)
    setDrillDownKind(kind)
    setDrillDownDirection(direction)
    setDrillDownOpen(true)
  }

  return (
    <>
      <CashflowMonthlyMatrix 
        months={months} 
        showMode={showMode} 
        openingBalance={metadata?.opening_balance}
        openingDate={metadata?.opening_date}
        onCellClick={handleCellClick} 
      />
      
      <CashflowDrillDownSheet
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        title={drillDownTitle}
        monthStart={drillDownMonth}
        kind={drillDownKind}
        direction={drillDownDirection}
      />
    </>
  )
}

