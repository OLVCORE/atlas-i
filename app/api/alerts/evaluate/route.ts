/**
 * MC9.0.2: Endpoint de Automação para Avaliação de Alertas
 * 
 * Protegido por token interno (INTERNAL_CRON_TOKEN)
 * Usa Service Role para bypass RLS e gravar alertas sem sessão de usuário
 */

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { runAlertsEvaluation } from "@/lib/alerts/run"

export const dynamic = 'force-dynamic'

const INTERNAL_CRON_TOKEN = process.env.INTERNAL_CRON_TOKEN

/**
 * Valida token de autenticação
 */
function validateToken(request: NextRequest): boolean {
  if (!INTERNAL_CRON_TOKEN) {
    console.error('[alerts:evaluate] INTERNAL_CRON_TOKEN não configurado')
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.substring(7) // Remove "Bearer "
  return token === INTERNAL_CRON_TOKEN
}

export async function POST(request: NextRequest) {
  // Validar autenticação
  if (!validateToken(request)) {
    return NextResponse.json(
      { error: "Não autorizado. Token de autenticação obrigatório." },
      { status: 401 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const workspaceIds = body.workspace_ids as string[] | undefined

    const adminClient = createSupabaseAdminClient()
    const result = await runAlertsEvaluation({
      supabaseAdmin: adminClient,
      workspaceIds,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.errors?.[0] || "Erro desconhecido",
          errors: result.errors,
        },
        { status: 500 }
      )
    }

    // Mantém formato de resposta compatível com implementação anterior
    return NextResponse.json({
      success: true,
      processed: result.evaluated,
      total_workspaces: result.evaluated,
      total_alerts: result.upserted,
      errors: result.errors,
    })
  } catch (error) {
    console.error('[alerts:evaluate] Erro:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

