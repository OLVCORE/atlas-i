/**
 * MC3.1b: Gerenciamento de Provider Configs (configuração de provider por workspace)
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export type Provider = {
  id: string
  workspace_id: string
  catalog_id: string | null
  kind: 'aggregator' | 'open_finance_direct'
  name: string
  status: 'active' | 'inactive'
  config: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Lista providers configs do workspace (com dados do catálogo)
 */
export async function listProviders(): Promise<(Provider & { catalog_code?: string; catalog_name?: string })[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Tentar primeiro com JOIN, se falhar, buscar sem JOIN
  let { data: providers, error } = await supabase
    .from("providers")
    .select(`
      *,
      provider_catalog (
        code,
        name
      )
    `)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })

  // Se a query com JOIN falhar (tabela pode não existir ou relacionamento não configurado),
  // buscar apenas providers básicos
  if (error) {
    const { data: basicProviders, error: basicError } = await supabase
      .from("providers")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })

    if (basicError) {
      throw new Error(`Erro ao listar providers: ${basicError.message}`)
    }

    providers = basicProviders
  }

  return (providers || []).map((p: any) => ({
    ...p,
    catalog_code: p.provider_catalog?.code,
    catalog_name: p.provider_catalog?.name,
  }))
}

/**
 * Busca provider por ID
 */
export async function getProviderById(providerId: string): Promise<Provider | null> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: provider, error } = await supabase
    .from("providers")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("id", providerId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar provider: ${error.message}`)
  }

  return provider
}

/**
 * Cria uma configuração de provider no workspace baseado em um provider do catálogo
 */
export async function createProviderConfig(
  catalogId: string,
  config?: Record<string, any>
): Promise<Provider> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  // Buscar dados do catálogo
  const { data: catalogItem, error: catalogError } = await supabase
    .from("provider_catalog")
    .select("*")
    .eq("id", catalogId)
    .single()

  if (catalogError || !catalogItem) {
    throw new Error("Provider do catálogo não encontrado")
  }

  // Verificar se já existe config para este catalog no workspace
  const { data: existing } = await supabase
    .from("providers")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("catalog_id", catalogId)
    .maybeSingle()

  if (existing) {
    throw new Error("Já existe uma configuração deste provider neste workspace")
  }

  const { data: provider, error } = await supabase
    .from("providers")
    .insert({
      workspace_id: workspace.id,
      catalog_id: catalogId,
      kind: catalogItem.kind,
      name: catalogItem.name,
      status: 'inactive',
      config: config || {},
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar configuração de provider: ${error.message}`)
  }

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "provider.created",
    resource_type: "provider",
    resource_id: provider.id,
    metadata: { catalog_id: catalogId, catalog_code: catalogItem.code },
  })

  return provider
}

/**
 * Atualiza status do provider
 */
export async function updateProviderStatus(
  providerId: string,
  status: 'active' | 'inactive'
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
    .from("providers")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspace.id)
    .eq("id", providerId)

  if (error) {
    throw new Error(`Erro ao atualizar provider: ${error.message}`)
  }

  // Auditoria
  await supabase.from("connectors_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "provider.updated",
    resource_type: "provider",
    resource_id: providerId,
    metadata: { status },
  })
}

