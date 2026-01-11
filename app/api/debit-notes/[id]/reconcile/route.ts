import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { reconcileDebitNote } from "@/lib/debit-notes"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const workspace = await getActiveWorkspace()
    const debitNoteId = params.id
    const body = await request.json()

    const { transactionId } = body

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId é obrigatório" }, { status: 400 })
    }

    const debitNote = await reconcileDebitNote(debitNoteId, transactionId)

    return NextResponse.json(debitNote, { status: 200 })
  } catch (error: any) {
    console.error("[api/debit-notes/reconcile] Erro:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao reconciliar nota de débito" },
      { status: 500 }
    )
  }
}
