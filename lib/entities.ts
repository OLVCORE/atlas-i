import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export async function listEntities() {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar entities: ${error.message}`)
  }

  return data || []
}

export async function getEntityById(entityId: string) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("id", entityId)
    .eq("workspace_id", workspace.id)
    .single()

  if (error) {
    throw new Error(`Erro ao buscar entity: ${error.message}`)
  }

  return data
}

export async function checkDocumentExists(document: string, excludeEntityId?: string): Promise<boolean> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const normalizedDocument = document.replace(/\D/g, "")

  if (!normalizedDocument) {
    return false
  }

  let query = supabase
    .from("entities")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("document", normalizedDocument)
    .limit(1)

  if (excludeEntityId) {
    query = query.neq("id", excludeEntityId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Erro ao verificar documento existente:", error)
    throw new Error(`Erro ao verificar documento: ${error.message}`)
  }

  // Verificar se existe usando dados retornados
  const exists = data !== null && data.length > 0
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[checkDocumentExists] Documento ${normalizedDocument} - existe: ${exists}, data length: ${data?.length || 0}`)
  }
  
  return exists
}

export async function updateEntity(
  entityId: string,
  type: "PF" | "PJ",
  legalName: string,
  document: string,
  enrichmentData?: {
    tradeName?: string
    registrationStatus?: string
    registrationStatusDate?: string
    foundationDate?: string
    mainActivityCode?: string
    mainActivityDesc?: string
    addressStreet?: string
    addressNumber?: string
    addressComplement?: string
    addressDistrict?: string
    addressCity?: string
    addressState?: string
    addressZip?: string
    phone?: string
    email?: string
    sourceProvider?: string
    sourceFetchedAt?: string
    enrichmentPayload?: any
  }
) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  // Normalizar documento para verificação
  const normalizedDocument = document.replace(/\D/g, "")
  
  // Verificar se documento já existe (exceto para esta entidade)
  const documentExists = await checkDocumentExists(normalizedDocument, entityId)
  if (documentExists) {
    throw new Error("Já existe uma entidade com este CPF/CNPJ neste workspace")
  }

  // Atualizar entity
  const { data: entity, error } = await supabase
    .from("entities")
    .update({
      type,
      legal_name: legalName,
      document: document.replace(/\D/g, ""),
      trade_name: enrichmentData?.tradeName,
      registration_status: enrichmentData?.registrationStatus,
      registration_status_date: enrichmentData?.registrationStatusDate || null,
      foundation_date: enrichmentData?.foundationDate || null,
      main_activity_code: enrichmentData?.mainActivityCode,
      main_activity_desc: enrichmentData?.mainActivityDesc,
      address_street: enrichmentData?.addressStreet,
      address_number: enrichmentData?.addressNumber,
      address_complement: enrichmentData?.addressComplement,
      address_district: enrichmentData?.addressDistrict,
      address_city: enrichmentData?.addressCity,
      address_state: enrichmentData?.addressState,
      address_zip: enrichmentData?.addressZip,
      phone: enrichmentData?.phone,
      email: enrichmentData?.email,
      source_provider: enrichmentData?.sourceProvider,
      source_fetched_at: enrichmentData?.sourceFetchedAt || null,
    })
    .eq("id", entityId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar entity: ${error.message}`)
  }

  // Se houver dados de enriquecimento, criar log de auditoria
  if (enrichmentData?.enrichmentPayload && entity) {
    await supabase.from("entity_enrichment_logs").insert({
      workspace_id: workspace.id,
      entity_id: entity.id,
      provider: enrichmentData.sourceProvider || "unknown",
      document: document.replace(/\D/g, ""),
      payload_raw: enrichmentData.enrichmentPayload,
      fetched_by: user.id,
    })
  }

  return entity
}

export async function deleteEntity(entityId: string) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { error } = await supabase
    .from("entities")
    .delete()
    .eq("id", entityId)
    .eq("workspace_id", workspace.id)

  if (error) {
    throw new Error(`Erro ao deletar entity: ${error.message}`)
  }
}

export async function createEntity(
  type: "PF" | "PJ",
  legalName: string,
  document: string,
  enrichmentData?: {
    tradeName?: string
    registrationStatus?: string
    registrationStatusDate?: string
    foundationDate?: string
    mainActivityCode?: string
    mainActivityDesc?: string
    addressStreet?: string
    addressNumber?: string
    addressComplement?: string
    addressDistrict?: string
    addressCity?: string
    addressState?: string
    addressZip?: string
    phone?: string
    email?: string
    sourceProvider?: string
    sourceFetchedAt?: string
    enrichmentPayload?: any
  }
) {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  // Normalizar documento para verificação
  const normalizedDocument = document.replace(/\D/g, "")
  
  // Verificar se documento já existe
  const documentExists = await checkDocumentExists(normalizedDocument)
  if (documentExists) {
    throw new Error("Já existe uma entidade com este CPF/CNPJ neste workspace")
  }

  // Inserir entity
  const { data: entity, error } = await supabase
    .from("entities")
    .insert({
      workspace_id: workspace.id,
      type,
      legal_name: legalName,
      document: normalizedDocument,
      trade_name: enrichmentData?.tradeName,
      registration_status: enrichmentData?.registrationStatus,
      registration_status_date: enrichmentData?.registrationStatusDate || null,
      foundation_date: enrichmentData?.foundationDate || null,
      main_activity_code: enrichmentData?.mainActivityCode,
      main_activity_desc: enrichmentData?.mainActivityDesc,
      address_street: enrichmentData?.addressStreet,
      address_number: enrichmentData?.addressNumber,
      address_complement: enrichmentData?.addressComplement,
      address_district: enrichmentData?.addressDistrict,
      address_city: enrichmentData?.addressCity,
      address_state: enrichmentData?.addressState,
      address_zip: enrichmentData?.addressZip,
      phone: enrichmentData?.phone,
      email: enrichmentData?.email,
      source_provider: enrichmentData?.sourceProvider,
      source_fetched_at: enrichmentData?.sourceFetchedAt || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar entity: ${error.message}`)
  }

  // Se houver dados de enriquecimento, criar log de auditoria
  if (enrichmentData?.enrichmentPayload && entity) {
    await supabase.from("entity_enrichment_logs").insert({
      workspace_id: workspace.id,
      entity_id: entity.id,
      provider: enrichmentData.sourceProvider || "unknown",
      document: document,
      payload_raw: enrichmentData.enrichmentPayload,
      fetched_by: user.id,
    })
  }

  return entity
}

