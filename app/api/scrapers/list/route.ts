/**
 * MC13: API endpoint para listar conexões de scrapers
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listScraperConnections } from "@/lib/scrapers/connections"

export async function GET(request: NextRequest) {
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

    const connections = await listScraperConnections()

    return NextResponse.json({
      ok: true,
      connections,
    })

  } catch (error: any) {
    console.error("[api:scrapers:list] Erro:", error)
    
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao listar conexões",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

