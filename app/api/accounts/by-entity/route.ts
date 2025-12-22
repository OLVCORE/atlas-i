import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

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

    const workspace = await getActiveWorkspace()

    const { data: accounts, error } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .eq("entity_id", entityId)
      .order("name", { ascending: true })

    if (error) {
      throw new Error(`Erro ao buscar contas: ${error.message}`)
    }

    return NextResponse.json(accounts || [])
  } catch (error: any) {
    console.error("Erro ao buscar contas:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar contas" },
      { status: 500 }
    )
  }
}

