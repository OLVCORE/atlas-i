import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { listSchedulesByContract } from "@/lib/schedules"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const workspace = await getActiveWorkspace()
    const searchParams = request.nextUrl.searchParams
    const contractId = searchParams.get("contractId")

    if (!contractId) {
      return NextResponse.json({ error: "contractId é obrigatório" }, { status: 400 })
    }

    // Buscar schedules do contrato
    const schedules = await listSchedulesByContract(contractId)

    // Filtrar apenas schedules disponíveis (planned, receivable)
    // e que não já tenham nota de débito PAGA (canceladas e deletadas liberam os schedules)
    const { data: existingNotes, error: existingError } = await supabase
      .from("debit_notes")
      .select("id, status")
      .eq("workspace_id", workspace.id)
      .eq("contract_id", contractId)
      .eq("status", "paid") // Apenas notas PAGAS bloqueiam schedules
      // .is("deleted_at", null) // Temporariamente desabilitado até migration ser executada

    if (existingError) {
      throw new Error(`Erro ao verificar notas existentes: ${existingError.message}`)
    }

    const paidNoteIds = new Set(existingNotes?.map((note) => note.id) || [])

    // Buscar items apenas de notas pagas
    let usedScheduleIds = new Set<string>()
    if (paidNoteIds.size > 0) {
      const { data: existingItems, error: itemsError } = await supabase
        .from("debit_note_items")
        .select("contract_schedule_id")
        .in("debit_note_id", Array.from(paidNoteIds))
        .not("contract_schedule_id", "is", null)

      if (itemsError) {
        throw new Error(`Erro ao verificar schedules existentes: ${itemsError.message}`)
      }

      usedScheduleIds = new Set(existingItems?.map((item) => item.contract_schedule_id) || [])
    }

    const availableSchedules = schedules.filter(
      (s) =>
        s.status === "planned" &&
        s.type === "receivable" &&
        !usedScheduleIds.has(s.id)
    )

    return NextResponse.json({ schedules: availableSchedules }, { status: 200 })
  } catch (error: any) {
    console.error("[api/debit-notes/schedules] Erro:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar schedules" },
      { status: 500 }
    )
  }
}
