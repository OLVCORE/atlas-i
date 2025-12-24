/**
 * MC13: API endpoint para deletar conexão de scraper
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deleteScraperConnection } from "@/lib/scrapers/connections"

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId é obrigatório" },
        { status: 400 }
      )
    }

    // Deletar conexão
    await deleteScraperConnection(connectionId)

    return NextResponse.json({
      ok: true,
      message: "Conexão deletada com sucesso",
    })

  } catch (error: any) {
    console.error("[api:scrapers:delete] Erro:", error)
    
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao deletar conexão",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

