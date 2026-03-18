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

    const workspace = await getActiveWorkspace()
    const body = await request.json()

    const { contractId, scheduleIds, entityId, description, clientName, notes, expenses, discounts, dueDate } = body

    const isAvulsa = contractId == null || contractId === "" || !Array.isArray(scheduleIds) || scheduleIds.length === 0
    if (!isAvulsa && (!contractId || !scheduleIds?.length)) {
      return NextResponse.json(
        { error: "Para nota com contrato, contractId e scheduleIds são obrigatórios" },
        { status: 400 }
      )
    }
    if (isAvulsa && !dueDate) {
      return NextResponse.json(
        { error: "Para nota avulsa, dueDate (data de vencimento) é obrigatório" },
        { status: 400 }
      )
    }

    const debitNote = await createDebitNote({
      contractId: contractId || null,
      scheduleIds: Array.isArray(scheduleIds) ? scheduleIds : [],
      entityId: entityId || null,
      dueDate: dueDate || undefined,
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
