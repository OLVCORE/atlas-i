/**
 * MC10.0.1: Webhook endpoint para receber eventos da Pluggy
 * 
 * Valida token de webhook e processa eventos
 */

import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

const PLUGGY_WEBHOOK_TOKEN = process.env.PLUGGY_WEBHOOK_TOKEN

/**
 * Valida token de webhook
 */
function validateWebhookToken(request: NextRequest): boolean {
  if (!PLUGGY_WEBHOOK_TOKEN) {
    return false
  }

  const webhookToken = request.headers.get('x-olv-webhook-token')
  return webhookToken === PLUGGY_WEBHOOK_TOKEN
}

export async function POST(request: NextRequest) {
  // Validar token de webhook
  if (!validateWebhookToken(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "Token de webhook inválido",
      },
      { status: 401 }
    )
  }

  try {
    const payload = await request.json().catch(() => ({}))
    
    // Log seguro (sem segredos)
    console.log('[pluggy:webhook] Evento recebido:', {
      type: payload.type || 'unknown',
      timestamp: new Date().toISOString(),
    })

    // Por enquanto, apenas log e retornar 200
    // Persistência será implementada em MC posterior

    return NextResponse.json({
      ok: true,
      received: true,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    console.error('[pluggy:webhook] Erro ao processar webhook:', errorMessage)

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao processar webhook",
      },
      { status: 500 }
    )
  }
}

