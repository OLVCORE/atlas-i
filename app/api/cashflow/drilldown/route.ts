import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listPlannedItemsForMonth, listRealisedItemsForMonth } from "@/lib/cashflow/drilldown"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const searchParams = request.nextUrl.searchParams
    const monthStart = searchParams.get("month_start")
    const kind = searchParams.get("kind") as "planned" | "realised" | null
    const direction = searchParams.get("direction") as "income" | "expense" | null
    const entityId = searchParams.get("entity_id") || undefined

    if (!monthStart) {
      return NextResponse.json({ error: "Parâmetro month_start obrigatório" }, { status: 400 })
    }

    if (!kind || (kind !== "planned" && kind !== "realised")) {
      return NextResponse.json({ error: "Parâmetro kind deve ser 'planned' ou 'realised'" }, { status: 400 })
    }

    const filters: any = {}
    if (entityId) filters.entity_id = entityId
    if (direction) filters.direction = direction

    let result

    if (kind === "planned") {
      result = await listPlannedItemsForMonth(monthStart, filters)
    } else {
      result = await listRealisedItemsForMonth(monthStart, filters)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[cashflow/drilldown] Erro:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  }
}

