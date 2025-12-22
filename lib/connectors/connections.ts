/**
 * MC3.1: Gerenciamento de Connections (conexões com provedores)
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export type Connection = {
  id: string
  workspace_id: string
  entity_id: string
  provider_id: string
  status: 'needs_setup' | 'connecting' | 'active' | 'error' | 'revoked'
  external_connection_id: string | null
  last_sync_at: string | null
  last_error: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Lista conexões do workspace
 */
export async function listConnections(): Promise<Connection[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: connections, error } = await supabase
    .from("connections")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar conexões: ${error.message}`)
  }

  return connections || []
}

/**
 * Lista conexões por entidade
 */
export async function listConnectionsByEntity(entityId: string): Promise<Connection[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: connections, error } = await supabase
    .from("connections")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar conexões da entidade: ${error.message}`)
  }

  return connections || []
}

/**
 * Busca conexão por ID
 */
export async function getConnectionById(connectionId: string): Promise<Connection | null> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: connection, error } = await supabase
    .from("connections")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("id", connectionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar conexão: ${error.message}`)
  }

  return connection
}

/**
 * Cria uma nova conexão (providerId agora é o ID da config do workspace)
 */
export async function createConnection(
  entityId: string,
  providerConfigId: string,
  metadata?: Record<string, any>
): Promise<Connection> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const { data: connection, error } = await supabase
    .from("connections")
    .insert({
      workspace_id: workspace.id,
      entity_id: entityId,
      provider_id: providerConfigId,
      status: 'connecting',
      metadata: metadata || {},
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar conexão: ${error.message}`)
  }

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "connection.connect",
    resource_type: "connection",
    resource_id: connection.id,
    metadata: { entity_id: entityId, provider_id: providerConfigId },
  })

  return connection
}

/**
 * Atualiza status da conexão
 */
export async function updateConnectionStatus(
  connectionId: string,
  status: Connection['status'],
  externalConnectionId?: string,
  error?: string
): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (externalConnectionId) {
    updateData.external_connection_id = externalConnectionId
  }

  if (error !== undefined) {
    updateData.last_error = error
  }

  const { error: updateError } = await supabase
    .from("connections")
    .update(updateData)
    .eq("workspace_id", workspace.id)
    .eq("id", connectionId)

  if (updateError) {
    throw new Error(`Erro ao atualizar conexão: ${updateError.message}`)
  }

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "connection.status_updated",
    resource_type: "connection",
    resource_id: connectionId,
    metadata: { status, external_connection_id: externalConnectionId },
  })
}

/**
 * Revoga uma conexão
 */
export async function revokeConnection(connectionId: string): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const { error } = await supabase
    .from("connections")
    .update({
      status: 'revoked',
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspace.id)
    .eq("id", connectionId)

  if (error) {
    throw new Error(`Erro ao revogar conexão: ${error.message}`)
  }

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "connection.revoke",
    resource_type: "connection",
    resource_id: connectionId,
  })
}

