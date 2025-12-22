/**
 * MC3.1: Orquestração de Sincronização
 * Nota: No MC3.1, não fazemos chamadas externas reais. Isso será implementado no MC8.
 * Aqui apenas criamos os sync_runs e preparamos a estrutura.
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { getConnectionById, updateConnectionStatus } from "./connections"

export type SyncRun = {
  id: string
  workspace_id: string
  connection_id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'failed'
  inserted_count: number
  updated_count: number
  deduped_count: number
  error_message: string | null
  created_at: string
}

/**
 * Cria um novo sync run
 */
export async function createSyncRun(connectionId: string): Promise<SyncRun> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  // Verificar conexão
  const connection = await getConnectionById(connectionId)
  if (!connection) {
    throw new Error("Conexão não encontrada")
  }

  if (connection.status !== 'active') {
    throw new Error("Conexão não está ativa")
  }

  // Criar sync run
  const { data: syncRun, error } = await supabase
    .from("sync_runs")
    .insert({
      workspace_id: workspace.id,
      connection_id: connectionId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar sync run: ${error.message}`)
  }

  // Atualizar last_sync_at da conexão
  await updateConnectionStatus(connectionId, 'active')

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "sync.sync_start",
    resource_type: "sync_run",
    resource_id: syncRun.id,
    metadata: { connection_id: connectionId },
  })

  return syncRun
}

/**
 * Finaliza um sync run com sucesso
 */
export async function finishSyncRunSuccess(
  syncRunId: string,
  insertedCount: number,
  updatedCount: number,
  dedupedCount: number
): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const { error } = await supabase
    .from("sync_runs")
    .update({
      status: 'success',
      finished_at: new Date().toISOString(),
      inserted_count: insertedCount,
      updated_count: updatedCount,
      deduped_count: dedupedCount,
    })
    .eq("workspace_id", workspace.id)
    .eq("id", syncRunId)

  if (error) {
    throw new Error(`Erro ao finalizar sync run: ${error.message}`)
  }

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "sync.sync_end",
    resource_type: "sync_run",
    resource_id: syncRunId,
    metadata: { status: 'success', inserted_count: insertedCount, updated_count: updatedCount, deduped_count: dedupedCount },
  })
}

/**
 * Finaliza um sync run com erro
 */
export async function finishSyncRunError(syncRunId: string, errorMessage: string): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const { error } = await supabase
    .from("sync_runs")
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("workspace_id", workspace.id)
    .eq("id", syncRunId)

  if (error) {
    throw new Error(`Erro ao finalizar sync run: ${error.message}`)
  }

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "sync.sync_end",
    resource_type: "sync_run",
    resource_id: syncRunId,
    metadata: { status: 'failed', error_message: errorMessage },
  })
}

/**
 * Lista sync runs de uma conexão
 */
export async function listSyncRuns(connectionId: string, limit: number = 50): Promise<SyncRun[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: syncRuns, error } = await supabase
    .from("sync_runs")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("connection_id", connectionId)
    .order("started_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Erro ao listar sync runs: ${error.message}`)
  }

  return syncRuns || []
}

export type AuditLog = {
  id: string
  workspace_id: string
  actor_user_id: string
  action: string
  resource_type: string
  resource_id: string
  metadata: Record<string, any> | null
  created_at: string
}

/**
 * Lista logs de auditoria do workspace (últimos N eventos)
 */
export async function listAuditLogs(limit: number = 20, connectionId?: string): Promise<AuditLog[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  let query = supabase
    .from("connectors_audit_log")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  // Filtrar por connection se especificado (via resource_id ou metadata)
  // Nota: filtro simples por resource_id, pois connection pode aparecer em resource_id ou metadata
  // Aplicar filtro adicional no cliente se necessário

  const { data: logs, error } = await query

  if (error) {
    throw new Error(`Erro ao listar logs de auditoria: ${error.message}`)
  }

  return logs || []
}

