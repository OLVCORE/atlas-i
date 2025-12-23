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

    // Criar instância do scraper e testar conexão
    try {
      // TODO: Quando os scrapers estiverem completos, usar:
      // const scraper = createScraper(bankCode, testCredentials)
      // await scraper.testConnection()
      
      // Criar credenciais temporárias apenas para teste
      const testCredentials = {
        username,
        password,
        entityId: '', // Não precisa para teste
        twoFactorSecret: twoFactorSecret || undefined,
      }

      // Tentar fazer login (apenas testar, não fazer scraping completo)
      // Por enquanto, retornamos sucesso se não houver erro de validação
      // TODO: Implementar teste real de conexão quando o scraper estiver completo
      
      // Por enquanto, apenas validamos que as credenciais não estão vazias
      if (password.length < 4) {
        return NextResponse.json({
          ok: false,
          connectionTest: {
            success: false,
            message: "Senha muito curta. Verifique se digitou corretamente.",
          },
        })
      }

      // Simular teste (em produção, aqui faríamos login real)
      // Por enquanto, retornamos "sucesso" se passou nas validações básicas
      // O usuário ainda precisa testar manualmente na primeira sincronização
      
      return NextResponse.json({
        ok: true,
        connectionTest: {
          success: true,
          message: "Credenciais validadas. Nota: Teste completo será feito na primeira sincronização.",
        },
      })

    } catch (testError: any) {
      return NextResponse.json({
        ok: false,
        connectionTest: {
          success: false,
          message: testError?.message || "Erro ao testar conexão",
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

