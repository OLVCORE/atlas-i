import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchIndexValues, getIndexAccumulated, type IndexType } from "@/lib/providers/indices/bcb"

export const dynamic = 'force-dynamic'

/**
 * GET /api/indices/bcb
 * 
 * Busca valores de índices do Banco Central
 * 
 * Query params:
 * - index: IPCA | IGPM | CDI
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 * - accumulated: boolean (opcional, retorna valor acumulado)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const index = searchParams.get("index") as IndexType
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const accumulated = searchParams.get("accumulated") === "true"

    if (!index || !startDate || !endDate) {
      return NextResponse.json(
        { error: "index, startDate e endDate são obrigatórios" },
        { status: 400 }
      )
    }

    if (!['IPCA', 'IGPM', 'CDI'].includes(index)) {
      return NextResponse.json(
        { error: "Índice inválido. Use: IPCA, IGPM ou CDI" },
        { status: 400 }
      )
    }

    if (accumulated) {
      const value = await getIndexAccumulated(index, startDate, endDate)
      return NextResponse.json({ index, startDate, endDate, accumulated: value })
    } else {
      const values = await fetchIndexValues(index, startDate, endDate)
      return NextResponse.json({ index, startDate, endDate, values })
    }
  } catch (error: any) {
    console.error("[api/indices/bcb] Erro:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar índices do Banco Central" },
      { status: 500 }
    )
  }
}
