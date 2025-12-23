/**
 * MC12: API endpoint para preview de planilha antes de importar
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { parseCSV } from "@/lib/importers/csv-parser"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não fornecido" },
        { status: 400 }
      )
    }

    // Validar tamanho (máximo 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Tamanho máximo: 10MB` },
        { status: 400 }
      )
    }

    // Ler conteúdo
    const csvContent = await file.text()

    // Parse apenas para preview (primeiras 20 linhas)
    const parseResult = parseCSV(csvContent)

    // Retornar preview (primeiras 10 linhas válidas + estatísticas)
    const previewRows = parseResult.rows.slice(0, 10)
    const previewErrors = parseResult.errors.slice(0, 5)

    return NextResponse.json({
      ok: true,
      preview: {
        rows: previewRows,
        errors: previewErrors,
        metadata: {
          totalRows: parseResult.metadata.totalRows,
          validRows: parseResult.metadata.validRows,
          invalidRows: parseResult.metadata.invalidRows,
          detectedFormat: parseResult.metadata.detectedFormat,
          hasMoreRows: parseResult.rows.length > 10,
        },
      },
    })

  } catch (error: any) {
    console.error("[api:import:preview] Erro:", error)
    
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao fazer preview da planilha",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

