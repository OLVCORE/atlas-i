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
      username,
      password,
      twoFactorSecret,
      accountId,
      scheduleFrequency,
      scheduleTime,
    } = body

    // Validações
    if (!bankCode || !entityId || !username || !password) {
      return NextResponse.json(
        { error: "bankCode, entityId, username e password são obrigatórios" },
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

    // Preparar credenciais
    const credentials: ScraperCredentials = {
      username,
      password,
      entityId,
      accountId: accountId || undefined,
      twoFactorSecret: twoFactorSecret || undefined,
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

