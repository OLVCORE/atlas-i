import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { updateDebitNote, cancelDebitNote, deleteDebitNote } from "@/lib/debit-notes"

export async function PATCH(
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
    const body = await request.json()

    const { description, issuedDate, dueDate, expenses, discounts } = body

    const debitNote = await updateDebitNote(params.id, {
      description,
      issuedDate,
      dueDate,
      expenses: expenses || [],
      discounts: discounts || [],
    })

    return NextResponse.json(debitNote, { status: 200 })
  } catch (error: any) {
    console.error("[api/debit-notes/[id]] Erro:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar nota de débito" },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    await deleteDebitNote(params.id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error("[api/debit-notes/[id]] Erro:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao deletar nota de débito" },
      { status: 500 }
    )
  }
}
