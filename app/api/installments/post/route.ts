import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { postInstallmentToLedger } from "@/lib/cards/installments"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await request.json()
    const { installmentId, accountId, description } = body

    if (!installmentId) {
      return NextResponse.json(
        { error: "installmentId é obrigatório" },
        { status: 400 }
      )
    }

    await postInstallmentToLedger(
      installmentId,
      accountId || undefined,
      description || undefined
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Erro ao postar parcela:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao postar parcela" },
      { status: 500 }
    )
  }
}

