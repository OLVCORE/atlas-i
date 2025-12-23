/**
 * MC13: API endpoint para sincronizar scraper
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncScraperConnection } from "@/lib/scrapers/sync"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { connectionId, accountType, startDate, endDate } = body

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId é obrigatório" },
        { status: 400 }
      )
    }

    // Executar sincronização
    const result = await syncScraperConnection(connectionId, {
      accountType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    return NextResponse.json({
      ok: result.success,
      result,
    })

  } catch (error: any) {
    console.error("[api:scrapers:sync] Erro:", error)
    
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao sincronizar scraper",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

