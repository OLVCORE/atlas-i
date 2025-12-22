/**
 * MC9.0.3: Core Evaluator para Reuso (UI + Automação)
 * 
 * Extraído para evitar duplicação entre POST /api/alerts/evaluate e GET /api/cron/alerts
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateAlerts } from "./engine"
import { upsertAlertsWithClient, resolveStaleAlertsWithClient } from "./store"

export type RunAlertsEvaluationOptions = {
  supabaseAdmin: SupabaseClient<any>
  workspaceIds?: string[]
}

export type RunAlertsEvaluationResult = {
  ok: boolean
  evaluated: number
  upserted: number
  resolved_stale: number
  duration_ms: number
  errors?: string[]
}

/**
 * Executa avaliação de alertas para lista de workspaces
 */
export async function runAlertsEvaluation(
  opts: RunAlertsEvaluationOptions
): Promise<RunAlertsEvaluationResult> {
  const startTime = Date.now()
  const { supabaseAdmin, workspaceIds: providedWorkspaceIds } = opts

  try {
    // Determinar lista de workspaces a processar
    let targetWorkspaceIds: string[] = []

    if (providedWorkspaceIds && providedWorkspaceIds.length > 0) {
      targetWorkspaceIds = providedWorkspaceIds
    } else {
      // Buscar todos os workspaces ativos
      const { data: workspaces, error: workspacesError } = await supabaseAdmin
        .from("workspaces")
        .select("id")
        .limit(1000) // Limite razoável

      if (workspacesError) {
        throw new Error(`Erro ao listar workspaces: ${workspacesError.message || 'Erro desconhecido'}`)
      }

      targetWorkspaceIds = (workspaces || []).map((w: any) => w.id)
    }

    if (targetWorkspaceIds.length === 0) {
      return {
        ok: true,
        evaluated: 0,
        upserted: 0,
        resolved_stale: 0,
        duration_ms: Date.now() - startTime,
      }
    }

    // Processar cada workspace
    let totalEvaluated = 0
    let totalUpserted = 0
    let totalResolvedStale = 0
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
          supabaseAdmin,
          workspaceId,
          proposed,
          null // created_by = null (automação)
        )

        // Resolver alertas stale
        await resolveStaleAlertsWithClient(supabaseAdmin, workspaceId)

        // Audit log usando admin client (actor_user_id NULL ok para automação)
        if (proposed.length > 0) {
          try {
            const { error: auditError } = await supabaseAdmin
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
              console.error('[alerts:run] Erro ao gravar audit log:', auditError.message || 'Erro desconhecido')
            }
          } catch (auditError) {
            // Log mas não falha
            console.error('[alerts:run] Erro ao gravar audit log:', auditError instanceof Error ? auditError.message : 'Erro desconhecido')
          }
        }

        totalEvaluated++
        totalUpserted += proposed.length
        // Nota: resolveStaleAlertsWithClient não retorna count, então contabilizamos que foi executado
        totalResolvedStale += 1 // Indica que o processo de resolução foi executado para este workspace
      } catch (workspaceError) {
        const errorMsg = workspaceError instanceof Error 
          ? workspaceError.message 
          : String(workspaceError)
        errors.push(`Workspace ${workspaceId}: ${errorMsg}`)
        console.error(`[alerts:run] Erro ao processar workspace ${workspaceId}:`, workspaceError)
      }
    }

    return {
      ok: true,
      evaluated: totalEvaluated,
      upserted: totalUpserted,
      resolved_stale: totalResolvedStale,
      duration_ms: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro desconhecido"
    console.error('[alerts:run] Erro:', error)
    
    return {
      ok: false,
      evaluated: 0,
      upserted: 0,
      resolved_stale: 0,
      duration_ms: Date.now() - startTime,
      errors: [errorMsg],
    }
  }
}

