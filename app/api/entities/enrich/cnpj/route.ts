import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchCnpjData } from "@/lib/providers/cnpj"
import { validateCnpj, normalizeCnpj } from "@/lib/utils/cnpj"

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
    const { cnpj } = body

    if (!cnpj || typeof cnpj !== "string") {
      return NextResponse.json(
        { error: "CNPJ é obrigatório" },
        { status: 400 }
      )
    }

    // Validar CNPJ
    const validation = validateCnpj(cnpj)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "CNPJ inválido" },
        { status: 400 }
      )
    }

    // Buscar dados do provedor
    const result = await fetchCnpjData(cnpj)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Erro ao buscar dados de CNPJ:", error)
    console.error("Stack trace:", error?.stack)
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : "Erro ao buscar dados do CNPJ"
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}

