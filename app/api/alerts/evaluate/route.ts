/**
 * MC9.0.2: Endpoint de Automação para Avaliação de Alertas
 * 
 * Protegido por token interno (INTERNAL_CRON_TOKEN)
 * Usa Service Role para bypass RLS e gravar alertas sem sessão de usuário
 */

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { evaluateAlerts } from "@/lib/alerts/engine"
import { upsertAlertsWithClient, resolveStaleAlertsWithClient } from "@/lib/alerts/store"

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

    // Se não especificado, buscar todos os workspaces (via admin client)
    const adminClient = createSupabaseAdminClient()

    let targetWorkspaceIds: string[] = []

    if (workspaceIds && workspaceIds.length > 0) {
      targetWorkspaceIds = workspaceIds
    } else {
      // Buscar todos os workspaces ativos
      const { data: workspaces, error: workspacesError } = await adminClient
        .from("workspaces")
        .select("id")
        .limit(1000) // Limite razoável

      if (workspacesError) {
        throw new Error(`Erro ao listar workspaces: ${workspacesError.message}`)
      }

      targetWorkspaceIds = (workspaces || []).map((w: any) => w.id)
    }

    if (targetWorkspaceIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum workspace para processar",
        processed: 0,
      })
    }

    // Processar cada workspace
    let totalProcessed = 0
    let totalAlerts = 0
    const errors: string[] = []

    for (const workspaceId of targetWorkspaceIds) {
      try {
        // Avaliar alertas para este workspace
        const proposed = await evaluateAlerts({
          workspaceId,
          entityId: null,
          accountId: null,
        })

        // Persistir usando admin client (bypass RLS)
        await upsertAlertsWithClient(
          adminClient,
          workspaceId,
          proposed,
          null // created_by = null (automação)
        )

        // Resolver alertas stale
        await resolveStaleAlertsWithClient(adminClient, workspaceId)

        // Audit log usando admin client (actor_user_id NULL ok para automação)
        if (proposed.length > 0) {
          try {
            const { error: auditError } = await adminClient
              .from("audit_logs")
              .insert({
                workspace_id: workspaceId,
                actor_user_id: null, // Automação
                action: 'create',
                entity_type: 'alert',
                entity_id: workspaceId,
                before: null,
                after: {
                  count: proposed.length,
                  types: proposed.map((a) => a.type),
                },
              })

            if (auditError) {
              console.error('[alerts:evaluate] Erro ao gravar audit log:', auditError)
            }
          } catch (auditError) {
            // Log mas não falha
            console.error('[alerts:evaluate] Erro ao gravar audit log:', auditError)
          }
        }

        totalProcessed++
        totalAlerts += proposed.length
      } catch (workspaceError) {
        const errorMsg = workspaceError instanceof Error 
          ? workspaceError.message 
          : String(workspaceError)
        errors.push(`Workspace ${workspaceId}: ${errorMsg}`)
        console.error(`[alerts:evaluate] Erro ao processar workspace ${workspaceId}:`, workspaceError)
      }
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      total_workspaces: targetWorkspaceIds.length,
      total_alerts: totalAlerts,
      errors: errors.length > 0 ? errors : undefined,
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

