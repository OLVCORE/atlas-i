"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function CashflowPeriodFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""

  const handleQuickSelect = (period: "current_month" | "next_month" | "next_3_months") => {
    const today = new Date()
    let startDate: Date
    let endDate: Date

    switch (period) {
      case "current_month":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        break
      case "next_month":
        startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
        endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0)
        break
      case "next_3_months":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0)
        break
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set("from", startDate.toISOString().split("T")[0])
    params.set("to", endDate.toISOString().split("T")[0])
    router.push(`/app/cashflow?${params.toString()}`)
  }

  const handleCustomDateChange = (field: "from" | "to", value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(field, value)
    } else {
      params.delete(field)
    }
    router.push(`/app/cashflow?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="quick-period" className="text-sm font-medium">
          Período Rápido:
        </Label>
        <Select onValueChange={handleQuickSelect}>
          <SelectTrigger id="quick-period" className="w-[180px]">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current_month">Mês Atual</SelectItem>
            <SelectItem value="next_month">Próximo Mês</SelectItem>
            <SelectItem value="next_3_months">Próximos 3 Meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="from-date" className="text-sm font-medium">
          De:
        </Label>
        <Input
          id="from-date"
          type="date"
          value={from}
          onChange={(e) => handleCustomDateChange("from", e.target.value)}
          className="w-[150px]"
        />
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="to-date" className="text-sm font-medium">
          Até:
        </Label>
        <Input
          id="to-date"
          type="date"
          value={to}
          onChange={(e) => handleCustomDateChange("to", e.target.value)}
          className="w-[150px]"
        />
      </div>
    </div>
  )
}

