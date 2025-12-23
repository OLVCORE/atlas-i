/**
 * MC10.0.1: Endpoint para criar connect token do Pluggy
 * 
 * Gera connect token para o widget Pluggy
 */

import { NextRequest, NextResponse } from "next/server"
import { pluggyFetch } from "@/lib/pluggy/http"

export const dynamic = 'force-dynamic'

type ConnectTokenRequest = {
  clientUserId?: string
  webhookUrl?: string
  oauthRedirectUri?: string
  avoidDuplicates?: boolean
}

type PluggyConnectTokenResponse = {
  connectToken?: string
  accessToken?: string
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = (await request.json().catch(() => ({}))) as ConnectTokenRequest

    const requestBody: Record<string, any> = {}
    if (body.clientUserId) {
      requestBody.clientUserId = body.clientUserId
    }
    if (body.webhookUrl) {
      requestBody.webhookUrl = body.webhookUrl
    }
    if (body.oauthRedirectUri) {
      requestBody.oauthRedirectUri = body.oauthRedirectUri
    }
    if (body.avoidDuplicates !== undefined) {
      requestBody.avoidDuplicates = body.avoidDuplicates
    }

    const response = await pluggyFetch('/connect_token', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    const data = (await response.json()) as PluggyConnectTokenResponse

    // A Pluggy pode retornar como connectToken ou accessToken
    const connectToken = data.connectToken || data.accessToken

    if (!connectToken) {
      throw new Error('Pluggy response missing connectToken/accessToken')
    }

    const durationMs = Date.now() - startTime

    return NextResponse.json({
      ok: true,
      connectToken,
      issued_at: new Date().toISOString(),
      duration_ms: durationMs,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    console.error('[pluggy:connect-token] Erro:', errorMessage)

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
        message: "Erro ao criar connect token",
      },
      { status: 500 }
    )
  }
}
