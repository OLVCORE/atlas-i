/**
 * MC12: API endpoint para importação de planilhas
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { importSpreadsheet, ImportOptions } from "@/lib/importers/spreadsheet-importer"
import { convertExcelToCSV, isExcelFile } from "@/lib/importers/excel-converter"

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
      console.error("[api:import] Arquivo não fornecido")
      return NextResponse.json(
        { error: "Arquivo não fornecido" },
        { status: 400 }
      )
    }

    if (!entityId) {
      console.error("[api:import] entityId não fornecido. FormData keys:", Array.from(formData.keys()))
      return NextResponse.json(
        { error: "entityId não fornecido" },
        { status: 400 }
      )
    }

    // Validar tamanho do arquivo (máximo 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Tamanho máximo: 10MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB` },
        { status: 400 }
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Arquivo vazio" },
        { status: 400 }
      )
    }

    // Validar tipo de arquivo (suporta múltiplos formatos)
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "text/plain", // .txt ou CSVs detectados como text/plain
      "application/csv",
    ]
    
    const allowedExtensions = ['.csv', '.xls', '.xlsx', '.txt']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension)

    if (!isValidType) {
      return NextResponse.json(
        { error: `Tipo de arquivo não suportado. Use CSV, XLS, XLSX ou TXT. Tipo recebido: ${file.type || fileExtension}` },
        { status: 400 }
      )
    }

    // Detectar se é arquivo Excel e converter para CSV
    let csvContent: string
    try {
      console.log("[api:import] Nome do arquivo:", file.name, "Tipo MIME:", file.type)
      const isExcel = isExcelFile(file.name, file.type)
      console.log("[api:import] É arquivo Excel?", isExcel)
      
      if (isExcel) {
        console.log("[api:import] Convertendo Excel para CSV...")
        try {
          // Para Excel, ler como ArrayBuffer e converter
          const arrayBuffer = await file.arrayBuffer()
          console.log("[api:import] ArrayBuffer lido, tamanho:", arrayBuffer.byteLength)
          csvContent = convertExcelToCSV(arrayBuffer, file.name)
          console.log("[api:import] CSV convertido, tamanho:", csvContent.length, "linhas:", csvContent.split('\n').length)
        } catch (convertError) {
          console.error("[api:import] Erro ao converter Excel:", convertError)
          return NextResponse.json(
            { 
              error: `Erro ao converter Excel para CSV: ${convertError instanceof Error ? convertError.message : 'Erro desconhecido'}. Por favor, tente exportar o arquivo como CSV primeiro.` 
            },
            { status: 400 }
          )
        }
      } else {
        // Para CSV/TXT, ler como texto
        console.log("[api:import] Lendo arquivo como texto...")
        csvContent = await file.text()
        console.log("[api:import] Texto lido, tamanho:", csvContent.length)
      }
      
      // Validar apenas que o conteúdo não está vazio
      if (!csvContent || csvContent.trim().length === 0) {
        return NextResponse.json(
          { error: "Arquivo vazio ou sem dados válidos" },
          { status: 400 }
        )
      }
      
      // Validar que não é um arquivo binário mal interpretado
      // Arquivos Excel convertidos devem ter pelo menos algumas linhas de texto
      if (csvContent.length > 0 && csvContent.split('\n').length < 2 && !csvContent.includes(',')) {
        return NextResponse.json(
          { error: "Arquivo não parece ser um formato válido. Certifique-se de que é um CSV ou Excel com dados." },
          { status: 400 }
        )
      }
    } catch (readError) {
      console.error("[api:import] Erro ao ler/converter arquivo:", readError)
      console.error("[api:import] Stack:", readError instanceof Error ? readError.stack : 'N/A')
      return NextResponse.json(
        { 
          error: `Erro ao processar arquivo: ${readError instanceof Error ? readError.message : 'Erro desconhecido'}. Certifique-se de que o arquivo é um CSV ou Excel válido.` 
        },
        { status: 400 }
      )
    }

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
    console.log("[api:import] Iniciando importação...")
    const result = await importSpreadsheet(csvContent, importOptions)
    console.log("[api:import] Resultado da importação:", {
      success: result.success,
      imported: result.imported,
      skipped: result.skipped,
      errorsCount: result.errors.length,
    })

    if (!result.success) {
      console.error("[api:import] Importação falhou. Erros:", result.errors)
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
    console.error("[api:import] Stack:", error?.stack)
    
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

