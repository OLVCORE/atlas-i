import { NextRequest, NextResponse } from "next/server"

// Endpoint de teste para verificar se Puppeteer funciona no Vercel
export async function GET(request: NextRequest) {
  try {
    const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV
    
    let puppeteer: any
    let chromium: any
    
    // Tentar carregar módulos
    try {
      if (isVercel) {
        try {
          chromium = require("@sparticuz/chromium-min")
          puppeteer = require("puppeteer-core")
        } catch {
          chromium = require("@sparticuz/chromium")
          puppeteer = require("puppeteer-core")
        }
      } else {
        puppeteer = require("puppeteer")
        chromium = null
      }
    } catch (loadError: any) {
      return NextResponse.json({
        success: false,
        error: "Erro ao carregar módulos",
        details: loadError.message,
        isVercel,
      }, { status: 500 })
    }
    
    // Tentar iniciar browser
    const launchOptions: any = {
      headless: true,
      args: chromium ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
    }
    
    if (chromium) {
      try {
        const executablePath = await chromium.executablePath()
        if (executablePath) {
          launchOptions.executablePath = executablePath
        }
        // Se não conseguir executablePath, continuar sem ele
      } catch (exeError: any) {
        // Não falhar se não conseguir executablePath, pode funcionar sem ele
        console.log("[TEST-PDF] executablePath não disponível:", exeError.message)
      }
      
      if (chromium.defaultViewport) {
        launchOptions.defaultViewport = chromium.defaultViewport
      }
      launchOptions.headless = chromium.headless
    }
    
    let browser
    try {
      browser = await puppeteer.launch(launchOptions)
    } catch (launchError: any) {
      return NextResponse.json({
        success: false,
        error: "Erro ao iniciar browser",
        details: launchError.message,
        isVercel,
        launchOptions: {
          hasExecutablePath: !!launchOptions.executablePath,
          argsCount: launchOptions.args?.length || 0,
        },
      }, { status: 500 })
    }
    
    // Tentar gerar PDF simples
    try {
      const page = await browser.newPage()
      await page.setContent("<h1>Teste PDF</h1>")
      const pdfBuffer = await page.pdf({ format: "A4" })
      await browser.close()
      
      return NextResponse.json({
        success: true,
        message: "PDF gerado com sucesso",
        pdfSize: pdfBuffer.length,
        isVercel,
      })
    } catch (pdfError: any) {
      await browser.close().catch(() => {})
      return NextResponse.json({
        success: false,
        error: "Erro ao gerar PDF",
        details: pdfError.message,
        isVercel,
      }, { status: 500 })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: "Erro geral",
      details: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
