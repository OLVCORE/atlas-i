"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type CashflowMonthlyFiltersProps = {
  entities: Array<{ id: string; legal_name: string }>
  accounts?: Array<{ id: string; name: string; entity_id: string }>
}

export function CashflowMonthlyFilters({ entities, accounts = [] }: CashflowMonthlyFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [fromMonth, setFromMonth] = useState<string>("")
  const [toMonth, setToMonth] = useState<string>("")
  const [selectedEntityId, setSelectedEntityId] = useState<string>("")
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [showMode, setShowMode] = useState<"both" | "planned" | "realised">("both")

  useEffect(() => {
    // Inicializar valores dos searchParams
    const fromParam = searchParams.get("from_month")
    const toParam = searchParams.get("to_month")
    const entityParam = searchParams.get("entity_id")
    const accountParam = searchParams.get("account_id")
    const showParam = searchParams.get("show") as "both" | "planned" | "realised" | null

    if (fromParam) {
      setFromMonth(fromParam)
    } else {
      // Default: mês atual
      const today = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      setFromMonth(firstDay.toISOString().split("T")[0].slice(0, 7) + "-01")
    }

    if (toParam) {
      setToMonth(toParam)
    } else {
      // Default: 12 meses à frente
      const today = new Date()
      const futureMonth = new Date(today.getFullYear(), today.getMonth() + 12, 1)
      setToMonth(futureMonth.toISOString().split("T")[0].slice(0, 7) + "-01")
    }

    if (entityParam) {
      setSelectedEntityId(entityParam)
    }

    if (accountParam) {
      setSelectedAccountId(accountParam)
    }

    if (showParam) {
      setShowMode(showParam)
    }
  }, [searchParams])

  const handleQuickSelect = (period: "last_6" | "last_12" | "next_6" | "next_12" | "current_year") => {
    const today = new Date()
    let startMonth: Date
    let endMonth: Date

    switch (period) {
      case "last_6":
        startMonth = new Date(today.getFullYear(), today.getMonth() - 6, 1)
        endMonth = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case "last_12":
        startMonth = new Date(today.getFullYear(), today.getMonth() - 12, 1)
        endMonth = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case "next_6":
        startMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        endMonth = new Date(today.getFullYear(), today.getMonth() + 6, 0)
        break
      case "next_12":
        startMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        endMonth = new Date(today.getFullYear(), today.getMonth() + 12, 0)
        break
      case "current_year":
        startMonth = new Date(today.getFullYear(), 0, 1)
        endMonth = new Date(today.getFullYear(), 11, 31)
        break
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set("from_month", startMonth.toISOString().split("T")[0].slice(0, 7) + "-01")
    params.set("to_month", endMonth.toISOString().split("T")[0].slice(0, 7) + "-01")
    router.push(`/app/cashflow?${params.toString()}`)
  }

  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (fromMonth) {
      // Garantir formato YYYY-MM-01
      const fromDate = fromMonth.slice(0, 7) + "-01"
      params.set("from_month", fromDate)
    } else {
      params.delete("from_month")
    }

    if (toMonth) {
      const toDate = toMonth.slice(0, 7) + "-01"
      params.set("to_month", toDate)
    } else {
      params.delete("to_month")
    }

    if (selectedEntityId && selectedEntityId !== "all") {
      params.set("entity_id", selectedEntityId)
    } else {
      params.delete("entity_id")
    }

    if (selectedAccountId && selectedAccountId !== "all") {
      params.set("account_id", selectedAccountId)
    } else {
      params.delete("account_id")
    }

    if (showMode !== "both") {
      params.set("show", showMode)
    } else {
      params.delete("show")
    }

    router.push(`/app/cashflow?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="quick-period" className="sr-only">
          Período Rápido
        </Label>
        <Select onValueChange={handleQuickSelect}>
          <SelectTrigger id="quick-period" className="w-[180px]">
            <SelectValue placeholder="Seleção Rápida" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_6">Últimos 6 meses</SelectItem>
            <SelectItem value="last_12">Últimos 12 meses</SelectItem>
            <SelectItem value="next_6">Próximos 6 meses</SelectItem>
            <SelectItem value="next_12">Próximos 12 meses</SelectItem>
            <SelectItem value="current_year">Ano atual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[150px]">
          <Label htmlFor="from-month">Mês Inicial</Label>
          <Input
            id="from-month"
            type="month"
            value={fromMonth.slice(0, 7)}
            onChange={(e) => setFromMonth(e.target.value + "-01")}
            className="mt-1"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <Label htmlFor="to-month">Mês Final</Label>
          <Input
            id="to-month"
            type="month"
            value={toMonth.slice(0, 7)}
            onChange={(e) => setToMonth(e.target.value + "-01")}
            className="mt-1"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="entity-filter">Entidade</Label>
          <Select
            value={selectedEntityId || "all"}
            onValueChange={setSelectedEntityId}
          >
            <SelectTrigger id="entity-filter" className="mt-1">
              <SelectValue placeholder="Todas as Entidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Consolidado (todas as entidades)</SelectItem>
              {entities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.legal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="account-filter">Conta (opcional)</Label>
          <Select
            value={selectedAccountId || "all"}
            onValueChange={setSelectedAccountId}
          >
            <SelectTrigger id="account-filter" className="mt-1">
              <SelectValue placeholder="Todas as contas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas (consolidado)</SelectItem>
              {accounts
                .filter((acc) => !selectedEntityId || selectedEntityId === "all" || acc.entity_id === selectedEntityId)
                .map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <Label htmlFor="show-mode">Mostrar</Label>
          <Select
            value={showMode}
            onValueChange={(value) => setShowMode(value as "both" | "planned" | "realised")}
          >
            <SelectTrigger id="show-mode" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Ambos</SelectItem>
              <SelectItem value="planned">Somente Previsto</SelectItem>
              <SelectItem value="realised">Somente Realizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleApply} className="min-w-[100px]">
          Aplicar
        </Button>
      </div>
    </div>
  )
}

