/**
 * MC3.1: Gerenciamento de External Accounts (contas externas descobertas)
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export type ExternalAccount = {
  id: string
  workspace_id: string
  entity_id: string
  connection_id: string
  external_account_id: string
  display_name: string
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'other'
  currency: string
  status: string
  raw: Record<string, any>
  created_at: string
  updated_at: string
}

export type ExternalAccountMap = {
  id: string
  workspace_id: string
  external_account_id: string
  internal_account_id: string | null
  internal_card_id: string | null
  mapping_status: 'mapped' | 'unmapped' | 'disabled'
  created_at: string
  updated_at: string
}

/**
 * Lista contas externas do workspace
 */
export async function listExternalAccounts(connectionId?: string): Promise<ExternalAccount[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  let query = supabase
    .from("external_accounts")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("display_name", { ascending: true })

  if (connectionId) {
    query = query.eq("connection_id", connectionId)
  }

  const { data: accounts, error } = await query

  if (error) {
    throw new Error(`Erro ao listar contas externas: ${error.message}`)
  }

  return accounts || []
}

/**
 * Busca conta externa por ID
 */
export async function getExternalAccountById(accountId: string): Promise<ExternalAccount | null> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: account, error } = await supabase
    .from("external_accounts")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("id", accountId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar conta externa: ${error.message}`)
  }

  return account
}

/**
 * Busca mapeamento de conta externa
 */
export async function getExternalAccountMap(externalAccountId: string): Promise<ExternalAccountMap | null> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: map, error } = await supabase
    .from("external_account_map")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("external_account_id", externalAccountId)
    .maybeSingle()

  if (error) {
    throw new Error(`Erro ao buscar mapeamento: ${error.message}`)
  }

  return map
}

/**
 * Cria ou atualiza mapeamento de conta externa para conta/cartão interno
 */
export async function mapExternalAccount(
  externalAccountId: string,
  internalAccountId: string | null,
  internalCardId: string | null
): Promise<ExternalAccountMap> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  if (!internalAccountId && !internalCardId) {
    throw new Error("Deve mapear para account ou card")
  }

  if (internalAccountId && internalCardId) {
    throw new Error("Não é possível mapear para account e card simultaneamente")
  }

  // Buscar mapeamento existente
  const existing = await getExternalAccountMap(externalAccountId)

  if (existing) {
    // Atualizar
    const { data: map, error } = await supabase
      .from("external_account_map")
      .update({
        internal_account_id: internalAccountId,
        internal_card_id: internalCardId,
        mapping_status: 'mapped',
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erro ao atualizar mapeamento: ${error.message}`)
    }

    // Auditoria
    await supabase.from("connectors_audit_log").insert({
      workspace_id: workspace.id,
      actor_user_id: user.id,
      action: "external_account.map_account",
      resource_type: "external_account_map",
      resource_id: map.id,
      metadata: { external_account_id: externalAccountId, internal_account_id: internalAccountId, internal_card_id: internalCardId },
    })

    return map
  } else {
    // Criar novo
    const { data: map, error } = await supabase
      .from("external_account_map")
      .insert({
        workspace_id: workspace.id,
        external_account_id: externalAccountId,
        internal_account_id: internalAccountId,
        internal_card_id: internalCardId,
        mapping_status: 'mapped',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erro ao criar mapeamento: ${error.message}`)
    }

    // Auditoria
    await supabase.from("connectors_audit_log").insert({
      workspace_id: workspace.id,
      actor_user_id: user.id,
      action: "external_account.map_account",
      resource_type: "external_account_map",
      resource_id: map.id,
      metadata: { external_account_id: externalAccountId, internal_account_id: internalAccountId, internal_card_id: internalCardId },
    })

    return map
  }
}

/**
 * Remove mapeamento de conta externa
 */
export async function unmapExternalAccount(externalAccountId: string): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const map = await getExternalAccountMap(externalAccountId)
  if (!map) {
    return
  }

  const { error } = await supabase
    .from("external_account_map")
    .update({
      mapping_status: 'unmapped',
      updated_at: new Date().toISOString(),
    })
    .eq("id", map.id)

  if (error) {
    throw new Error(`Erro ao desmapear conta externa: ${error.message}`)
  }

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "external_account.unlink",
    resource_type: "external_account_map",
    resource_id: map.id,
    metadata: { external_account_id: externalAccountId },
  })
}

