/**
 * MC12: API endpoint para importação de planilhas
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { importSpreadsheet, ImportOptions } from "@/lib/importers/spreadsheet-importer"

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

    const workspace = await getActiveWorkspace()

    // Parse FormData (arquivo CSV)
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const entityId = formData.get("entityId") as string | null
    const accountId = formData.get("accountId") as string | null
    const accountName = formData.get("accountName") as string | null
    const accountType = formData.get("accountType") as 'checking' | 'investment' | 'other' | null
    const skipDuplicates = formData.get("skipDuplicates") === "true"
    const autoReconcile = formData.get("autoReconcile") === "true"

    // Validações
    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não fornecido" },
        { status: 400 }
      )
    }

    if (!entityId) {
      return NextResponse.json(
        { error: "entityId não fornecido" },
        { status: 400 }
      )
    }

    // Validar tipo de arquivo
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain", // Alguns CSVs são detectados como text/plain
    ]

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: "Tipo de arquivo não suportado. Use CSV (.csv)" },
        { status: 400 }
      )
    }

    // Ler conteúdo do arquivo
    const csvContent = await file.text()

    // Preparar opções de importação
    const importOptions: ImportOptions = {
      entityId,
      accountId: accountId || null,
      accountName: accountName || undefined,
      accountType: accountType || 'checking',
      skipDuplicates,
      autoReconcile,
    }

    // Importar
    const result = await importSpreadsheet(csvContent, importOptions)

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Erro ao importar",
          details: result.errors,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      result,
    })

  } catch (error: any) {
    console.error("[api:import] Erro:", error)
    
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao importar planilha",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

