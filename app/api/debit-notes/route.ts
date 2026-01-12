import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { createDebitNote } from "@/lib/debit-notes"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const workspace = await getActiveWorkspace()
    const body = await request.json()

    const { contractId, scheduleIds, description, clientName, notes, expenses, discounts } = body

    if (!contractId || !scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json(
        { error: "contractId e scheduleIds são obrigatórios" },
        { status: 400 }
      )
    }

    const debitNote = await createDebitNote({
      contractId,
      scheduleIds,
      description: description || null,
      clientName: clientName || null,
      notes: notes || null,
      expenses: expenses || [],
      discounts: discounts || [],
    })

    return NextResponse.json(debitNote, { status: 201 })
  } catch (error: any) {
    console.error("[api/debit-notes] Erro:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao criar nota de débito" },
      { status: 500 }
    )
  }
}
