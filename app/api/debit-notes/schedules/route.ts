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
    // e que não já tenham nota de débito
    const { data: existingItems, error: existingError } = await supabase
      .from("debit_note_items")
      .select("contract_schedule_id")
      .in(
        "contract_schedule_id",
        schedules.map((s) => s.id)
      )

    if (existingError) {
      throw new Error(`Erro ao verificar schedules existentes: ${existingError.message}`)
    }

    const usedScheduleIds = new Set(existingItems?.map((item) => item.contract_schedule_id) || [])

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
