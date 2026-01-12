import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { getDebitNoteById } from "@/lib/debit-notes"
import { listContracts } from "@/lib/contracts"
import { listEntities } from "@/lib/entities"

// Detectar ambiente
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV

// Carregar módulos dinamicamente com múltiplos fallbacks
function loadPuppeteer() {
  let puppeteer: any
  let chromium: any

  if (isVercel) {
    // Vercel: usar @sparticuz/chromium (versão recomendada pela documentação)
    console.log("[PDF] Ambiente Vercel detectado")
    
    try {
      // Priorizar @sparticuz/chromium (versão completa recomendada)
      chromium = require("@sparticuz/chromium")
      puppeteer = require("puppeteer-core")
      console.log("[PDF] Usando @sparticuz/chromium + puppeteer-core")
      
      // Configurar chromium para Vercel (desabilitar modo gráfico para reduzir tamanho)
      if (chromium.setGraphicsMode) {
        chromium.setGraphicsMode(false)
      }
      
      // Configurar path do executável para Vercel
      if (chromium.font) {
        chromium.font("/var/task/.fonts")
      }
    } catch (error1: any) {
      console.log("[PDF] Fallback: tentando @sparticuz/chromium-min...")
      // Fallback: @sparticuz/chromium-min
      try {
        chromium = require("@sparticuz/chromium-min")
        puppeteer = require("puppeteer-core")
        console.log("[PDF] Usando @sparticuz/chromium-min + puppeteer-core")
      } catch (error2: any) {
        console.error("[PDF] Erro ao carregar módulos Vercel:", error2.message)
        throw new Error(`Erro ao carregar módulos: ${error2.message}`)
      }
    }
  } else {
    // Local: usar puppeteer normal
    console.log("[PDF] Ambiente local detectado, usando puppeteer")
    try {
      puppeteer = require("puppeteer")
      chromium = null
    } catch (error: any) {
      console.error("[PDF] Erro ao carregar puppeteer local:", error.message)
      throw new Error(`Erro ao carregar puppeteer: ${error.message}`)
    }
  }

  return { puppeteer, chromium }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let browser: any = null
  try {
    console.log("[PDF] Iniciando geração de PDF...")
    
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const workspace = await getActiveWorkspace()
    const debitNoteId = params.id

    console.log("[PDF] Buscando nota de débito:", debitNoteId)
    // Buscar nota de débito
    const debitNote = await getDebitNoteById(debitNoteId)

    // Buscar contrato
    const contracts = await listContracts()
    const contract = contracts.find((c) => c.id === debitNote.contract_id)
    if (!contract) {
      throw new Error("Contrato não encontrado")
    }

    // Buscar entidade (cliente)
    const entities = await listEntities()
    const entity = entities.find((e) => e.id === contract.counterparty_entity_id)
    if (!entity) {
      throw new Error("Entidade não encontrada")
    }

    // Gerar HTML da nota
    const html = generateDebitNoteHTML(debitNote, contract, entity)

    // Carregar puppeteer
    const { puppeteer, chromium } = loadPuppeteer()

    // Gerar PDF com Puppeteer
    console.log("[PDF] Preparando para gerar PDF...")
    
    const launchOptions: any = {
      headless: chromium ? chromium.headless : true,
      args: chromium ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
    }

    // Se estiver no Vercel, usar chromium executável com configuração recomendada
    if (chromium) {
      try {
        console.log("[PDF] Configurando chromium para Vercel...")
        
        // Obter executablePath do chromium (pode falhar no Vercel, então temos fallback)
        // No Vercel, o chromium pode não precisar de executablePath explícito
        try {
          // Tentar obter executablePath de forma assíncrona
          const executablePath = await chromium.executablePath()
          if (executablePath && executablePath.length > 0 && !executablePath.includes('/var/task/.next')) {
            launchOptions.executablePath = executablePath
            console.log("[PDF] Chromium executablePath obtido:", executablePath.substring(0, 50) + "...")
          } else {
            console.log("[PDF] executablePath inválido ou aponta para diretório inexistente, usando busca automática")
            // Não definir executablePath, deixar o puppeteer-core encontrar automaticamente
          }
        } catch (exeError: any) {
          // Se falhar, não definir executablePath - o puppeteer-core pode encontrar automaticamente
          console.log("[PDF] Erro ao obter executablePath (esperado no Vercel):", exeError.message)
          console.log("[PDF] Continuando sem executablePath explícito - puppeteer-core tentará encontrar automaticamente")
        }
        
        // Adicionar configurações padrão do chromium
        if (chromium.defaultViewport) {
          launchOptions.defaultViewport = chromium.defaultViewport
        }
        
        console.log("[PDF] Chromium configurado:", {
          hasExecutablePath: !!launchOptions.executablePath,
          argsCount: launchOptions.args?.length || 0,
          headless: launchOptions.headless,
        })
      } catch (chromiumError: any) {
        console.error("[PDF] Erro ao configurar chromium:", chromiumError.message, chromiumError.stack)
        // Continuar mesmo se houver erro na configuração, pode funcionar sem executablePath
        console.log("[PDF] Continuando sem configuração específica do chromium")
      }
    }

    console.log("[PDF] Iniciando browser...")
    try {
      browser = await puppeteer.launch(launchOptions)
      console.log("[PDF] Browser iniciado com sucesso")
    } catch (launchError: any) {
      console.error("[PDF] Erro ao iniciar browser:", launchError.message, launchError.stack)
      throw new Error(`Erro ao iniciar browser: ${launchError.message}`)
    }

    let page
    let pdfBuffer
    try {
      console.log("[PDF] Criando nova página...")
      page = await browser.newPage()
      console.log("[PDF] Carregando HTML...")
      await page.setContent(html, { waitUntil: "networkidle0" })
      console.log("[PDF] Gerando PDF...")
      pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "20mm",
          right: "15mm",
          bottom: "20mm",
          left: "15mm",
        },
      })
      console.log("[PDF] PDF gerado com sucesso, tamanho:", pdfBuffer.length)
      await browser.close()
      browser = null
    } catch (pdfError: any) {
      console.error("[PDF] Erro ao gerar PDF:", pdfError.message, pdfError.stack)
      if (browser) {
        await browser.close().catch(() => {})
      }
      throw new Error(`Erro ao gerar PDF: ${pdfError.message}`)
    }

    // Converter Buffer para Uint8Array para NextResponse
    const pdfArray = new Uint8Array(pdfBuffer)

    return new NextResponse(pdfArray, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="nota-debito-${debitNote.number}.pdf"`,
      },
    })
  } catch (error: any) {
    const errorMessage = error?.message || "Erro desconhecido"
    const errorStack = error?.stack || ""
    
    console.error("[api/debit-notes/pdf] Erro completo:", {
      message: errorMessage,
      stack: errorStack,
      name: error?.name,
      isVercel,
    })
    
    // Garantir que o browser seja fechado em caso de erro
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error("[PDF] Erro ao fechar browser:", closeError)
      }
    }
    
    // Retornar erro detalhado em desenvolvimento, genérico em produção
    const detailedError = process.env.NODE_ENV === 'development' 
      ? `${errorMessage}\n\nStack: ${errorStack}` 
      : errorMessage
    
    return NextResponse.json(
      { 
        error: detailedError,
        details: process.env.NODE_ENV === 'development' ? {
          stack: errorStack,
          name: error?.name,
          isVercel,
        } : undefined
      },
      { status: 500 }
    )
  }
}

function generateDebitNoteHTML(
  debitNote: any,
  contract: any,
  entity: any
): string {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR")
  }

  // Ordenar itens por item_order
  const sortedItems = [...debitNote.items].sort((a: any, b: any) => (a.item_order || 0) - (b.item_order || 0))
  
  // Separar itens por tipo
  const scheduleItems = sortedItems.filter((item: any) => item.contract_schedule_id !== null)
  const expenseItems = sortedItems.filter((item: any) => item.type === 'expense')
  const discountItems = sortedItems.filter((item: any) => item.type === 'discount')
  
  // Calcular subtotais
  const schedulesSubtotal = scheduleItems.reduce((sum, item) => sum + Number(item.amount), 0)
  const expensesSubtotal = expenseItems.reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0)
  // Descontos são sempre valores positivos no banco, mas devem ser subtraídos
  const discountsSubtotal = discountItems.reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0)
  
  // Gerar HTML dos itens
  let itemsHTML = ""
  
  // Itens dos schedules
  if (scheduleItems.length > 0) {
    itemsHTML += scheduleItems.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(item.amount)}</td>
      </tr>
    `).join("")
  }
  
  // Despesas adicionais
  if (expenseItems.length > 0) {
    itemsHTML += expenseItems.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description || "Despesa adicional"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(item.amount)}</td>
      </tr>
    `).join("")
  }
  
  // Descontos
  if (discountItems.length > 0) {
    itemsHTML += discountItems.map((item: any) => {
      const amount = Math.abs(Number(item.amount))
      return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description || "Desconto"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: #dc2626;">${formatCurrency(-amount)}</td>
      </tr>
    `
    }).join("")
  }
  
  // Subtotais
  let subtotalsHTML = ""
  if (expenseItems.length > 0 || discountItems.length > 0) {
    subtotalsHTML = `
      <tr class="subtotal-row">
        <td style="padding: 8px; border-top: 1px solid #ddd; font-weight: bold;">Subtotal (Schedules)</td>
        <td style="padding: 8px; border-top: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(schedulesSubtotal)}</td>
      </tr>
    `
    if (expenseItems.length > 0) {
      subtotalsHTML += `
        <tr class="subtotal-row">
          <td style="padding: 8px; font-weight: bold;">Subtotal (Despesas)</td>
          <td style="padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(expensesSubtotal)}</td>
        </tr>
      `
    }
    if (discountItems.length > 0) {
      subtotalsHTML += `
        <tr class="subtotal-row">
          <td style="padding: 8px; font-weight: bold;">Subtotal (Descontos)</td>
          <td style="padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(-discountsSubtotal)}</td>
        </tr>
      `
    }
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nota de Débito ${debitNote.number}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }
    .header .number {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
    .info-section {
      margin-bottom: 30px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .info-label {
      font-weight: bold;
      width: 150px;
    }
    .info-value {
      flex: 1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background-color: #f5f5f5;
      padding: 10px;
      text-align: left;
      border-bottom: 2px solid #333;
      font-weight: bold;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #ddd;
    }
    .subtotal-row {
      background-color: #f9f9f9;
    }
    .subtotal-row td {
      border-top: 1px solid #ddd;
      padding: 8px;
    }
    .total-row {
      font-weight: bold;
      font-size: 14px;
      background-color: #f0f0f0;
    }
    .total-row td {
      border-top: 2px solid #333;
      padding: 12px 8px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NOTA DE DÉBITO</h1>
      <div class="number">Número: ${debitNote.number}</div>
    </div>

    <div class="info-section">
      <div class="info-row">
        <div class="info-label">Entidade:</div>
        <div class="info-value">${entity.legal_name}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Cliente:</div>
        <div class="info-value">${debitNote.client_name || entity.legal_name}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Documento:</div>
        <div class="info-value">${entity.document}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Contrato:</div>
        <div class="info-value">${contract.title}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Data de Emissão:</div>
        <div class="info-value">${formatDate(debitNote.issued_date)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Data de Vencimento:</div>
        <div class="info-value">${formatDate(debitNote.due_date)}</div>
      </div>
      ${debitNote.description ? `
      <div class="info-row">
        <div class="info-label">Descrição:</div>
        <div class="info-value">${debitNote.description}</div>
      </div>
      ` : ""}
    </div>

    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th style="text-align: right;">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
        ${subtotalsHTML}
        <tr class="total-row">
          <td>TOTAL</td>
          <td style="text-align: right;">${formatCurrency(debitNote.total_amount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p>Esta nota de débito foi gerada automaticamente pelo sistema ATLAS-i</p>
      <p>Data de geração: ${new Date().toLocaleString("pt-BR")}</p>
    </div>
  </div>
</body>
</html>
  `
}
