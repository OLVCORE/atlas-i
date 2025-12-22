import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: templates, error } = await supabase
      .from("card_templates")
      .select("*")
      .eq("is_active", true)
      .order("issuer_name", { ascending: true })
      .order("program_name", { ascending: true })

    if (error) {
      throw new Error(`Erro ao buscar templates: ${error.message}`)
    }

    return NextResponse.json(templates || [])
  } catch (error: any) {
    console.error("Erro ao buscar templates de cartão:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar templates" },
      { status: 500 }
    )
  }
}

