import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listCardsByEntity } from "@/lib/cards/purchases"

export const dynamic = 'force-dynamic'

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
    const entityId = searchParams.get("entityId")

    if (!entityId) {
      return NextResponse.json(
        { error: "entityId é obrigatório" },
        { status: 400 }
      )
    }

    const cards = await listCardsByEntity(entityId)
    return NextResponse.json(cards)
  } catch (error: any) {
    console.error("Erro ao buscar cartões:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar cartões" },
      { status: 500 }
    )
  }
}

