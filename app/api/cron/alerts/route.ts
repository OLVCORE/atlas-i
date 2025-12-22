/**
 * MC9.0.3: Endpoint Bridge GET para Vercel Cron Jobs
 * 
 * Chamado pelo Vercel Cron a cada 30 minutos
 * Protegido por Authorization: Bearer INTERNAL_CRON_TOKEN
 * Usa Service Role para bypass RLS e gravar alertas sem sessão de usuário
 */

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { runAlertsEvaluation } from "@/lib/alerts/run"

export const dynamic = 'force-dynamic'

/**
 * Retorna o token esperado (CRON_SECRET padrão, fallback INTERNAL_CRON_TOKEN)
 */
function getExpectedCronToken(): string | null {
  return process.env.CRON_SECRET ?? process.env.INTERNAL_CRON_TOKEN ?? null
}

/**
 * Valida token de autenticação (fail-closed)
 */
function validateToken(request: NextRequest): { valid: boolean; error?: string } {
  const expected = getExpectedCronToken()
  
  if (!expected) {
    console.error('[cron:alerts] CRON_SECRET e INTERNAL_CRON_TOKEN não configurados')
    return { valid: false, error: 'misconfig' }
  }

  const auth = request.headers.get('authorization') ?? ''
  
  if (auth !== `Bearer ${expected}`) {
    return { valid: false, error: 'unauthorized' }
  }

  return { valid: true }
}

export async function GET(request: NextRequest) {
  // Validar autenticação (fail-closed)
  const validation = validateToken(request)
  
  if (!validation.valid) {
    const statusCode = validation.error === 'misconfig' ? 500 : 401
    const message = validation.error === 'misconfig' 
      ? "Configuração ausente. Verifique variáveis de ambiente."
      : "Não autorizado. Token de autenticação obrigatório."
    
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
    // Verificar configuração crítica (fail-closed)
    const adminClient = createSupabaseAdminClient()
    
    // Executar avaliação para todos os workspaces (workspaceIds = [] = todos)
    const result = await runAlertsEvaluation({
      supabaseAdmin: adminClient,
      workspaceIds: [], // Array vazio = processar todos
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "evaluation_failed",
          message: result.errors?.[0] || "Erro ao avaliar alertas",
          errors: result.errors,
        },
        { status: 500 }
      )
    }

    // Resposta padronizada
    return NextResponse.json({
      ok: true,
      evaluated: result.evaluated,
      upserted: result.upserted,
      resolved_stale: result.resolved_stale,
      duration_ms: result.duration_ms,
    })
  } catch (error) {
    // Fail-closed: não expor stacktrace sensível
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    console.error('[cron:alerts] Erro:', errorMessage)

    // Se for erro de configuração (misconfig), retornar 500
    if (errorMessage.includes('não está definido') || errorMessage.includes('não configurado')) {
      return NextResponse.json(
        {
          ok: false,
          error: "misconfig",
          message: "Configuração ausente. Verifique variáveis de ambiente.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro interno ao processar alertas",
      },
      { status: 500 }
    )
  }
}

