/**
 * MC10.0.1: Endpoint de diagnóstico interno para verificar API Key do Pluggy
 * 
 * Protegido por INTERNAL_CRON_TOKEN (ou CRON_SECRET)
 * Retorna apenas status, sem expor o apiKey
 */

import { NextRequest, NextResponse } from "next/server"
import { getPluggyApiKey } from "@/lib/pluggy/auth"

export const dynamic = 'force-dynamic'

const INTERNAL_CRON_TOKEN = process.env.INTERNAL_CRON_TOKEN
const CRON_SECRET = process.env.CRON_SECRET

/**
 * Valida token de autenticação interno
 */
function validateInternalToken(request: NextRequest): boolean {
  const expectedToken = CRON_SECRET ?? INTERNAL_CRON_TOKEN

  if (!expectedToken) {
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.substring(7)
  return token === expectedToken
}

export async function POST(request: NextRequest) {
  // Validar autenticação (fail-closed)
  if (!validateInternalToken(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "Não autorizado. Token de autenticação obrigatório.",
      },
      { status: 401 }
    )
  }

  try {
    await getPluggyApiKey()

    return NextResponse.json({
      ok: true,
      hasApiKey: true,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    console.error('[pluggy:auth] Erro:', errorMessage)

    // Fail-closed: verificar se é erro de configuração
    if (errorMessage.includes('deve estar configurado')) {
      return NextResponse.json(
        {
          ok: false,
          error: "misconfig",
          message: "Configuração ausente. Verifique PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao verificar API Key do Pluggy",
      },
      { status: 500 }
    )
  }
}
