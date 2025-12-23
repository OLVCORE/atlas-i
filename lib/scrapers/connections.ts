/**
 * MC13: Gerenciamento de conexões de scrapers
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { encryptCredentials, decryptCredentials } from "./crypto"
import type { BankCode, ScraperConnection, ScraperCredentials } from "./types"

/**
 * Lista todas as conexões de scrapers do workspace
 */
export async function listScraperConnections(): Promise<ScraperConnection[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: connections, error } = await supabase
    .from("scraper_connections")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar conexões: ${error.message}`)
  }

  return connections || []
}

/**
 * Busca conexão por ID
 */
export async function getScraperConnectionById(
  connectionId: string
): Promise<ScraperConnection | null> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: connection, error } = await supabase
    .from("scraper_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("workspace_id", workspace.id)
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
 * Cria nova conexão de scraper
 */
export async function createScraperConnection(
  bankCode: BankCode,
  entityId: string,
  credentials: ScraperCredentials,
  options?: {
    accountId?: string
    scheduleFrequency?: 'daily' | 'weekly' | 'monthly'
    scheduleTime?: string
  }
): Promise<ScraperConnection> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Criptografar credenciais
  const credentialsEncrypted = encryptCredentials(workspace.id, credentials)

  const { data: connection, error } = await supabase
    .from("scraper_connections")
    .insert({
      workspace_id: workspace.id,
      bank_code: bankCode,
      entity_id: entityId,
      account_id: options?.accountId || null,
      credentials_encrypted: credentialsEncrypted,
      is_active: true,
      schedule_frequency: options?.scheduleFrequency || null,
      schedule_time: options?.scheduleTime || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar conexão: ${error.message}`)
  }

  return connection
}

/**
 * Atualiza conexão de scraper
 */
export async function updateScraperConnection(
  connectionId: string,
  updates: {
    credentials?: ScraperCredentials
    isActive?: boolean
    scheduleFrequency?: 'daily' | 'weekly' | 'monthly' | null
    scheduleTime?: string | null
    accountId?: string | null
  }
): Promise<ScraperConnection> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const updateData: any = {}

  if (updates.credentials) {
    updateData.credentials_encrypted = encryptCredentials(workspace.id, updates.credentials)
  }

  if (updates.isActive !== undefined) {
    updateData.is_active = updates.isActive
  }

  if (updates.scheduleFrequency !== undefined) {
    updateData.schedule_frequency = updates.scheduleFrequency
  }

  if (updates.scheduleTime !== undefined) {
    updateData.schedule_time = updates.scheduleTime
  }

  if (updates.accountId !== undefined) {
    updateData.account_id = updates.accountId
  }

  const { data: connection, error } = await supabase
    .from("scraper_connections")
    .update(updateData)
    .eq("id", connectionId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar conexão: ${error.message}`)
  }

  return connection
}

/**
 * Remove conexão de scraper
 */
export async function deleteScraperConnection(connectionId: string): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { error } = await supabase
    .from("scraper_connections")
    .delete()
    .eq("id", connectionId)
    .eq("workspace_id", workspace.id)

  if (error) {
    throw new Error(`Erro ao deletar conexão: ${error.message}`)
  }
}

/**
 * Descriptografa credenciais de uma conexão
 */
export async function getDecryptedCredentials(
  connectionId: string
): Promise<ScraperCredentials> {
  const connection = await getScraperConnectionById(connectionId)
  
  if (!connection) {
    throw new Error('Conexão não encontrada')
  }

  const workspace = await getActiveWorkspace()
  return decryptCredentials(workspace.id, connection.credentials_encrypted)
}

/**
 * Atualiza status de última sincronização
 */
export async function updateLastSyncStatus(
  connectionId: string,
  status: 'success' | 'error',
  errorMessage?: string
): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { error } = await supabase
    .from("scraper_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_error: errorMessage || null,
    })
    .eq("id", connectionId)
    .eq("workspace_id", workspace.id)

  if (error) {
    throw new Error(`Erro ao atualizar status: ${error.message}`)
  }
}

