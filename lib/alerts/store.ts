/**
 * MC9: Persistência de Alertas (Upsert + Deduplicação)
 * MC9.0.2: Refatorado para suportar cliente como parâmetro (UI + Automação)
 * 
 * Gerencia persistência de alertas com deduplicação por fingerprint
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import type { ProposedAlert } from "./engine"
import type { SupabaseClient } from "@supabase/supabase-js"

export type Alert = {
  id: string
  workspace_id: string
  entity_id: string | null
  account_id: string | null
  type: string
  severity: 'info' | 'warning' | 'critical'
  state: 'open' | 'dismissed' | 'snoozed' | 'resolved'
  title: string
  message: string
  fingerprint: string
  context: Record<string, any>
  first_seen_at: string
  last_seen_at: string
  resolved_at: string | null
  dismissed_at: string | null
  snoozed_until: string | null
  created_by: string | null
  updated_at: string
}

/**
 * MC9.0.2: Versão com cliente como parâmetro (para uso em automação)
 */
export async function upsertAlertsWithClient(
  supabase: SupabaseClient<any>,
  workspaceId: string,
  proposed: ProposedAlert[],
  actorId?: string | null
): Promise<void> {
  if (proposed.length === 0) {
    return
  }

  const now = new Date().toISOString()

  // Para cada alerta proposto, fazer upsert
  for (const alert of proposed) {
    // Verificar se já existe pelo fingerprint
    const { data: existing, error: fetchError } = await supabase
      .from("alerts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("fingerprint", alert.fingerprint)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = not found (ok), outros erros são problemas
      console.error(`[alerts:store] Erro ao buscar alerta existente: ${fetchError.message}`)
      continue
    }

    if (existing) {
      // Alerta já existe
      const existingAlert = existing as any

      // Se está snoozed e já expirou, reabrir
      if (existingAlert.state === 'snoozed' && existingAlert.snoozed_until) {
        const snoozedUntil = new Date(existingAlert.snoozed_until)
        if (snoozedUntil < new Date()) {
          // Reabrir (mudar para open)
          const { error: updateError } = await supabase
            .from("alerts")
            .update({
              state: 'open',
              last_seen_at: now,
              message: alert.message,
              context: alert.context,
              severity: alert.severity,
              updated_at: now,
              snoozed_until: null,
            })
            .eq("id", existingAlert.id)

          if (updateError) {
            console.error(`[alerts:store] Erro ao reabrir alerta: ${updateError?.message || 'Erro desconhecido'}`)
          }
          continue
        }
      }

      // Se está dismissed, não reabrir automaticamente (apenas atualizar last_seen_at para métricas)
      if (existingAlert.state === 'dismissed' || existingAlert.state === 'resolved') {
        // Atualizar apenas last_seen_at (para métricas)
        const { error: updateError } = await supabase
          .from("alerts")
          .update({
            last_seen_at: now,
          })
          .eq("id", existingAlert.id)

        if (updateError) {
          console.error(`[alerts:store] Erro ao atualizar last_seen_at: ${updateError?.message || 'Erro desconhecido'}`)
        }
        continue
      }

      // Se está open, atualizar dados mas manter state
      if (existingAlert.state === 'open') {
        const { error: updateError } = await supabase
          .from("alerts")
          .update({
            last_seen_at: now,
            message: alert.message,
            context: alert.context,
            severity: alert.severity,
            updated_at: now,
          })
          .eq("id", existingAlert.id)

        if (updateError) {
          console.error(`[alerts:store] Erro ao atualizar alerta: ${updateError?.message || 'Erro desconhecido'}`)
        }
        continue
      }

      // Se está snoozed e não expirou, não fazer nada
      if (existingAlert.state === 'snoozed') {
        continue
      }
    } else {
      // Não existe, criar novo
      const { error: insertError } = await supabase
        .from("alerts")
        .insert({
          workspace_id: workspaceId,
          entity_id: alert.entity_id || null,
          account_id: alert.account_id || null,
          type: alert.type,
          severity: alert.severity,
          state: 'open',
          title: alert.title,
          message: alert.message,
          fingerprint: alert.fingerprint,
          context: alert.context,
          first_seen_at: now,
          last_seen_at: now,
          created_by: actorId || null,
        })

      if (insertError) {
        console.error(`[alerts:store] Erro ao criar alerta: ${insertError?.message || 'Erro desconhecido'}`)
      }
    }
  }
}

/**
 * Upsert de alertas (insert ou update baseado em fingerprint)
 * Versão que usa session-based client (UI)
 * 
 * Regras:
 * - Se não existe: insert (first_seen_at, last_seen_at = now)
 * - Se existe e state=open: update last_seen_at, message, context, severity, updated_at
 * - Se existe e state=dismissed/snoozed: não reabrir automaticamente, apenas atualizar last_seen_at
 *   (exceto se snoozed_until < now(), aí reabre)
 */
export async function upsertAlerts(
  proposed: ProposedAlert[],
  actorId?: string
): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  return upsertAlertsWithClient(supabase, workspace.id, proposed, actorId)

  if (proposed.length === 0) {
    return
  }

  const now = new Date().toISOString()

  // Para cada alerta proposto, fazer upsert
  for (const alert of proposed) {
    // Verificar se já existe pelo fingerprint
    const { data: existing, error: fetchError } = await supabase
      .from("alerts")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("fingerprint", alert.fingerprint)
      .single()

    if (fetchError) {
      const errorCode = fetchError?.code
      if (errorCode && errorCode !== 'PGRST116') {
        // PGRST116 = not found (ok), outros erros são problemas
        console.error(`[alerts:store] Erro ao buscar alerta existente: ${fetchError?.message || 'Erro desconhecido'}`)
        continue
      }
      // Se é PGRST116 ou null, continuar normalmente (não encontrado = criar novo)
    }

    if (existing) {
      // Alerta já existe
      const existingAlert = existing as any

      // Se está snoozed e já expirou, reabrir
      if (existingAlert.state === 'snoozed' && existingAlert.snoozed_until) {
        const snoozedUntil = new Date(existingAlert.snoozed_until)
        if (snoozedUntil < new Date()) {
          // Reabrir (mudar para open)
          const { error: updateError } = await supabase
            .from("alerts")
            .update({
              state: 'open',
              last_seen_at: now,
              message: alert.message,
              context: alert.context,
              severity: alert.severity,
              updated_at: now,
              snoozed_until: null,
            })
            .eq("id", existingAlert.id)

          if (updateError) {
            console.error(`[alerts:store] Erro ao reabrir alerta: ${updateError?.message || 'Erro desconhecido'}`)
          }
          continue
        }
      }

      // Se está dismissed, não reabrir automaticamente (apenas atualizar last_seen_at para métricas)
      if (existingAlert.state === 'dismissed' || existingAlert.state === 'resolved') {
        // Atualizar apenas last_seen_at (para métricas)
        const { error: updateError } = await supabase
          .from("alerts")
          .update({
            last_seen_at: now,
          })
          .eq("id", existingAlert.id)

        if (updateError) {
          console.error(`[alerts:store] Erro ao atualizar last_seen_at: ${updateError?.message || 'Erro desconhecido'}`)
        }
        continue
      }

      // Se está open, atualizar dados mas manter state
      if (existingAlert.state === 'open') {
        const { error: updateError } = await supabase
          .from("alerts")
          .update({
            last_seen_at: now,
            message: alert.message,
            context: alert.context,
            severity: alert.severity,
            updated_at: now,
          })
          .eq("id", existingAlert.id)

        if (updateError) {
          console.error(`[alerts:store] Erro ao atualizar alerta: ${updateError?.message || 'Erro desconhecido'}`)
        }
        continue
      }

      // Se está snoozed e não expirou, não fazer nada
      if (existingAlert.state === 'snoozed') {
        continue
      }
    } else {
      // Não existe, criar novo
      const { error: insertError } = await supabase
        .from("alerts")
        .insert({
          workspace_id: workspace.id,
          entity_id: alert.entity_id || null,
          account_id: alert.account_id || null,
          type: alert.type,
          severity: alert.severity,
          state: 'open',
          title: alert.title,
          message: alert.message,
          fingerprint: alert.fingerprint,
          context: alert.context,
          first_seen_at: now,
          last_seen_at: now,
          created_by: actorId || null,
        })

      if (insertError) {
        console.error(`[alerts:store] Erro ao criar alerta: ${insertError?.message || 'Erro desconhecido'}`)
      }
    }
  }
}

/**
 * MC9.0.2: Versão com cliente como parâmetro (para uso em automação)
 */
export async function resolveStaleAlertsWithClient(
  supabase: SupabaseClient<any>,
  workspaceId: string
): Promise<void> {
  // Alertas open que não foram vistos nas últimas 2 horas
  const twoHoursAgo = new Date()
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)
  const twoHoursAgoISO = twoHoursAgo.toISOString()

  // Tipos que podem ser auto-resolvidos se não reaparecerem
  const autoResolvableTypes = ['cash_negative', 'worst_point_soon', 'schedules_due_soon']

  const { error } = await supabase
    .from("alerts")
    .update({
      state: 'resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("state", 'open')
    .in("type", autoResolvableTypes)
    .lt("last_seen_at", twoHoursAgoISO)

  if (error) {
    console.error(`[alerts:store] Erro ao resolver alertas stale: ${error.message}`)
  }
}

/**
 * Resolve alertas "stale" (não vistos nesta rodada de avaliação)
 * Versão que usa session-based client (UI)
 * 
 * Regra: alertas open que não foram vistos (last_seen_at < now() - interval) podem ser marcados resolved
 * Apenas para tipos que são "condições" (ex: cash_negative) se não reaparecerem
 */
export async function resolveStaleAlerts(workspaceId: string): Promise<void> {
  const supabase = await createClient()
  return resolveStaleAlertsWithClient(supabase, workspaceId)
}

/**
 * Lista alertas do workspace
 */
export async function listAlerts(filters?: {
  entityId?: string | null
  severity?: 'info' | 'warning' | 'critical'
  state?: 'open' | 'dismissed' | 'snoozed' | 'resolved'
}): Promise<Alert[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  let query = supabase
    .from("alerts")
    .select("*")
    .eq("workspace_id", workspace.id)

  if (filters?.entityId !== undefined) {
    if (filters.entityId === null) {
      query = query.is("entity_id", null)
    } else {
      query = query.eq("entity_id", filters.entityId)
    }
  }

  if (filters?.severity) {
    query = query.eq("severity", filters.severity)
  }

  if (filters?.state) {
    query = query.eq("state", filters.state)
  }

  query = query.order("severity", { ascending: false }) // critical primeiro
    .order("last_seen_at", { ascending: false })

  const { data, error } = await query

  if (error) {
    throw new Error(`Erro ao listar alertas: ${error.message}`)
  }

  return (data || []) as Alert[]
}

/**
 * Busca alerta por ID
 */
export async function getAlertById(alertId: string): Promise<Alert | null> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("id", alertId)
    .eq("workspace_id", workspace.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar alerta: ${error.message}`)
  }

  return data as Alert
}

