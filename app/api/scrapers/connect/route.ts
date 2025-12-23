/**
 * MC13: API endpoint para conectar scraper de banco
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createScraperConnection } from "@/lib/scrapers/connections"
import type { BankCode, ScraperCredentials } from "@/lib/scrapers/types"

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
      entityId,
      // Novos campos
      cpf,
      cnpj,
      agency,
      accountNumber,
      accountDigit,
      // Campos antigos (para compatibilidade)
      username,
      password,
      twoFactorSecret,
      accountId,
      scheduleFrequency,
      scheduleTime,
    } = body

    // Validações básicas
    if (!bankCode || !entityId || !password) {
      return NextResponse.json(
        { error: "bankCode, entityId e password são obrigatórios" },
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

    // Validações específicas por banco
    if (bankCode === 'itau') {
      // Itaú precisa de CPF ou CNPJ
      if (!cpf && !cnpj) {
        return NextResponse.json(
          { error: "CPF ou CNPJ é obrigatório para Itaú" },
          { status: 400 }
        )
      }
      // Se tem CPF, precisa de agência e conta (PF)
      if (cpf && (!agency || !accountNumber || !accountDigit)) {
        return NextResponse.json(
          { error: "Agência, número e dígito da conta são obrigatórios para Itaú PF" },
          { status: 400 }
        )
      }
    } else {
      // Outros bancos: CPF ou CNPJ
      if (!cpf && !cnpj && !username) {
        return NextResponse.json(
          { error: "CPF, CNPJ ou username é obrigatório" },
          { status: 400 }
        )
      }
    }

    // Preparar credenciais
    const credentials: ScraperCredentials = {
      password,
      entityId,
      accountId: accountId || undefined,
      twoFactorSecret: twoFactorSecret || undefined,
      // Novos campos
      cpf: cpf || undefined,
      cnpj: cnpj || undefined,
      agency: agency || undefined,
      accountNumber: accountNumber || undefined,
      accountDigit: accountDigit || undefined,
      // Campo antigo (compatibilidade)
      username: username || undefined,
    }

    // Criar conexão
    const connection = await createScraperConnection(
      bankCode,
      entityId,
      credentials,
      {
        accountId,
        scheduleFrequency,
        scheduleTime,
      }
    )

    return NextResponse.json({
      ok: true,
      connection,
    })

  } catch (error: any) {
    console.error("[api:scrapers:connect] Erro:", error)
    
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao conectar scraper",
        details: error?.message || "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

