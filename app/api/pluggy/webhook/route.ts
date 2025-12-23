/**
 * MC10.0.2: Webhook endpoint para receber eventos da Pluggy
 * 
 * Valida segredo de webhook e processa eventos
 */

import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

const PLUGGY_WEBHOOK_SECRET = process.env.PLUGGY_WEBHOOK_SECRET

/**
 * Valida segredo de webhook
 * Aceita x-pluggy-signature OU authorization: Bearer <secret>
 */
function validateWebhookSecret(request: NextRequest): { valid: boolean; error?: string } {
  if (!PLUGGY_WEBHOOK_SECRET) {
    return { valid: false, error: 'misconfig' }
  }

  // Tentar header x-pluggy-signature
  const signature = request.headers.get('x-pluggy-signature')
  if (signature === PLUGGY_WEBHOOK_SECRET) {
    return { valid: true }
  }

  // Tentar authorization: Bearer
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (token === PLUGGY_WEBHOOK_SECRET) {
      return { valid: true }
    }
  }

  return { valid: false, error: 'unauthorized' }
}

export async function POST(request: NextRequest) {
  // Validar segredo (fail-closed)
  const validation = validateWebhookSecret(request)
  
  if (!validation.valid) {
    const statusCode = validation.error === 'misconfig' ? 500 : 401
    const message = validation.error === 'misconfig'
      ? "Configuração ausente. Verifique PLUGGY_WEBHOOK_SECRET."
      : "Segredo de webhook inválido"
    
    return NextResponse.json(
      {
        ok: false,
        error: validation.error || 'unauthorized',
        message,
      },
      { status: statusCode }
    )
  }

  try {
    // Ler body como JSON (ou texto se falhar)
    let payload: any = {}
    try {
      const bodyText = await request.text()
      if (bodyText) {
        payload = JSON.parse(bodyText)
      }
    } catch {
      // Se não for JSON válido, continua com payload vazio
      payload = {}
    }
    
    // Log seguro (sem imprimir body completo se for grande)
    const logData: Record<string, any> = {
      timestamp: new Date().toISOString(),
    }
    
    if (payload.type) logData.type = payload.type
    if (payload.itemId) logData.itemId = payload.itemId
    if (payload.clientUserId) logData.clientUserId = payload.clientUserId
    if (payload.event) logData.event = payload.event

    console.log('[pluggy:webhook] Evento recebido:', logData)

    // Por enquanto, apenas log e retornar 200
    // Persistência será implementada em MC posterior

    return NextResponse.json({
      ok: true,
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

