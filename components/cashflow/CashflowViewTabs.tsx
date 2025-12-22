"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

type CashflowViewTabsProps = {
  defaultView?: "monthly" | "operational"
  children: {
    monthly: React.ReactNode
    operational: React.ReactNode
  }
}

export function CashflowViewTabs({ defaultView = "monthly", children }: CashflowViewTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentView = (searchParams.get("view") as "monthly" | "operational") || defaultView

  const handleViewChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === defaultView) {
      params.delete("view")
    } else {
      params.set("view", value)
    }
    router.push(`/app/cashflow?${params.toString()}`)
  }

  return (
    <Tabs value={currentView} onValueChange={handleViewChange}>
      <TabsList>
        <TabsTrigger value="monthly">Visão Mensal (Planilha)</TabsTrigger>
        <TabsTrigger value="operational">Visão Operacional</TabsTrigger>
      </TabsList>
      <TabsContent value="monthly" className="mt-4">
        {children.monthly}
      </TabsContent>
      <TabsContent value="operational" className="mt-4">
        {children.operational}
      </TabsContent>
    </Tabs>
  )
}

