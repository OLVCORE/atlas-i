import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { getDebitNoteById } from "@/lib/debit-notes"
import { listContracts } from "@/lib/contracts"
import { listEntities } from "@/lib/entities"

// Detectar ambiente
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV

// Carregar módulos dinamicamente
function loadPuppeteer() {
  let puppeteer: any
  let chromium: any

  if (isVercel) {
    // Vercel: usar puppeteer-core com @sparticuz/chromium-min
    console.log("[PDF] Ambiente Vercel detectado, usando puppeteer-core + chromium-min")
    try {
      chromium = require("@sparticuz/chromium-min")
      puppeteer = require("puppeteer-core")
      console.log("[PDF] Módulos carregados com sucesso")
    } catch (error: any) {
      console.error("[PDF] Erro ao carregar módulos Vercel:", error.message, error.stack)
      throw new Error(`Erro ao carregar módulos: ${error.message}`)
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
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const workspace = await getActiveWorkspace()
    const debitNoteId = params.id

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
      headless: true,
      args: chromium ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
    }

    // Se estiver no Vercel, usar chromium executável
    if (chromium) {
      try {
        console.log("[PDF] Configurando chromium para Vercel...")
        launchOptions.executablePath = await chromium.executablePath()
        console.log("[PDF] Chromium executável configurado")
      } catch (chromiumError: any) {
        console.error("[PDF] Erro ao configurar chromium:", chromiumError.message, chromiumError.stack)
        throw new Error(`Erro ao configurar chromium: ${chromiumError.message}`)
      }
    }

    console.log("[PDF] Iniciando browser...")
    let browser
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
    console.error("[api/debit-notes/pdf] Erro completo:", error.message, error.stack)
    return NextResponse.json(
      { error: error.message || "Erro ao gerar PDF" },
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
  const expensesSubtotal = expenseItems.reduce((sum, item) => sum + Number(item.amount), 0)
  const discountsSubtotal = discountItems.reduce((sum, item) => sum + Number(item.amount), 0)
  
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
    itemsHTML += discountItems.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description || "Desconto"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(-item.amount)}</td>
      </tr>
    `).join("")
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
        <div class="info-label">Cliente:</div>
        <div class="info-value">${entity.legal_name}</div>
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
