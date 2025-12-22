/**
 * MC3.1b: Gerenciamento do Provider Catalog (catálogo global)
 */

import { createClient } from "@/lib/supabase/server"

export type ProviderCatalog = {
  id: string
  code: string
  name: string
  kind: 'aggregator' | 'open_finance_direct'
  homepage: string | null
  docs_url: string | null
  is_active: boolean
  created_at: string
}

/**
 * Lista todos os providers disponíveis no catálogo
 */
export async function listProviderCatalog(): Promise<ProviderCatalog[]> {
  const supabase = await createClient()

  const { data: catalog, error } = await supabase
    .from("provider_catalog")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(`Erro ao listar catálogo de providers: ${error.message}`)
  }

  return catalog || []
}

/**
 * Busca provider do catálogo por código
 */
export async function getProviderCatalogByCode(code: string): Promise<ProviderCatalog | null> {
  const supabase = await createClient()

  const { data: provider, error } = await supabase
    .from("provider_catalog")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar provider do catálogo: ${error.message}`)
  }

  return provider
}

/**
 * Busca provider do catálogo por ID
 */
export async function getProviderCatalogById(id: string): Promise<ProviderCatalog | null> {
  const supabase = await createClient()

  const { data: provider, error } = await supabase
    .from("provider_catalog")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar provider do catálogo: ${error.message}`)
  }

  return provider
}

