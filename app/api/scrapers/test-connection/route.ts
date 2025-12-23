/**
 * MC13: API endpoint para TESTAR conexão de scraper (sem salvar)
 * 
 * IMPORTANTE: Este endpoint apenas testa se as credenciais funcionam,
 * mas NÃO salva nada no banco de dados.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { BankCode } from "@/lib/scrapers/types"

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

    const body = await request.json()
    const {
      bankCode,
      username,
      password,
      twoFactorSecret,
    } = body

    // Validações
    if (!bankCode || !username || !password) {
      return NextResponse.json(
        { error: "bankCode, username e password são obrigatórios" },
        { status: 400 }
      )
    }

    const validBankCodes: BankCode[] = ['itau', 'santander', 'btg', 'mercadopago']
    if (!validBankCodes.includes(bankCode)) {
      return NextResponse.json(
        { error: "bankCode inválido" },
        { status: 400 }
      )
    }

    // Criar instância do scraper e testar conexão REAL
    try {
      const { createScraper } = await import('@/lib/scrapers/factory')
      
      // Criar credenciais temporárias apenas para teste
      const testCredentials = {
        username,
        password,
        entityId: '', // Não precisa para teste
        twoFactorSecret: twoFactorSecret || undefined,
      }

      // Criar scraper e testar login REAL
      const scraper = createScraper(bankCode, testCredentials)
      
      // Testar login (faz login real no banco)
      const loginSuccess = await scraper.testLogin()
      
      if (loginSuccess) {
        return NextResponse.json({
          ok: true,
          connectionTest: {
            success: true,
            message: "✅ Login realizado com sucesso! As credenciais estão corretas.",
          },
        })
      } else {
        return NextResponse.json({
          ok: false,
          connectionTest: {
            success: false,
            message: "❌ Falha ao fazer login. Verifique se o CPF/CNPJ e senha estão corretos.",
          },
        })
      }

    } catch (testError: any) {
      const errorMessage = testError?.message || "Erro desconhecido ao testar conexão"
      
      // Erros comuns do Itaú
      if (errorMessage.includes('Falha no login') || errorMessage.includes('ainda na página de login')) {
        return NextResponse.json({
          ok: false,
          connectionTest: {
            success: false,
            message: "❌ Credenciais inválidas. Verifique CPF/CNPJ e senha.",
          },
        })
      }
      
      return NextResponse.json({
        ok: false,
        connectionTest: {
          success: false,
          message: `❌ Erro ao testar conexão: ${errorMessage}`,
        },
      })
    }

  } catch (error: any) {
    console.error("[api:scrapers:test-connection] Erro:", error)
    
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao testar conexão",
        details: error?.message || "Erro desconhecido",
        connectionTest: {
          success: false,
          message: error?.message || "Erro desconhecido ao testar conexão",
        },
      },
      { status: 500 }
    )
  }
}

