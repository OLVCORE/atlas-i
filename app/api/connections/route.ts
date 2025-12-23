/**
 * MC10: Endpoint para persistir conexão Pluggy após widget
 * 
 * Recebe itemId do Pluggy e salva na tabela connections
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[api:connections:POST] Auth error:', authError?.message || 'No user')
      return NextResponse.json(
        { error: "Não autenticado", details: authError?.message },
        { status: 401 }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[api:connections:POST] JSON parse error:', parseError)
      return NextResponse.json(
        { error: "Body inválido", details: "JSON malformado" },
        { status: 400 }
      )
    }

    const { providerKey, externalConnectionId, entityId } = body

    if (!providerKey || !externalConnectionId) {
      console.error('[api:connections:POST] Missing required fields', {
        hasProviderKey: !!providerKey,
        hasExternalConnectionId: !!externalConnectionId,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: "Campos obrigatórios ausentes",
          message: "providerKey e externalConnectionId são obrigatórios",
          details: `providerKey: ${providerKey ? 'fornecido' : 'ausente'}, externalConnectionId: ${externalConnectionId ? 'fornecido' : 'ausente'}`,
        },
        { status: 400 }
      )
    }

    let workspace
    try {
      workspace = await getActiveWorkspace()
    } catch (workspaceError) {
      const errorMessage = workspaceError instanceof Error ? workspaceError.message : "Erro ao obter workspace"
      console.error('[api:connections:POST] Workspace error:', {
        message: errorMessage,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: "Workspace não encontrado",
          message: errorMessage,
          details: "Não foi possível determinar o workspace ativo",
        },
        { status: 400 }
      )
    }

    // Buscar provider pelo catalog code
    const { data: catalogItem, error: catalogError } = await supabase
      .from("provider_catalog")
      .select("id")
      .eq("code", providerKey)
      .eq("is_active", true)
      .single()

    if (catalogError || !catalogItem) {
      console.error('[api:connections:POST] Catalog item not found', {
        providerKey,
        error: catalogError?.message,
        userId: user.id,
        workspaceId: workspace.id,
      })
      return NextResponse.json(
        {
          error: "Provider não encontrado",
          message: `Provider '${providerKey}' não encontrado no catálogo`,
          details: catalogError?.message,
        },
        { status: 404 }
      )
    }

    // Buscar a configuração do provider no workspace
    const { data: providerConfig, error: providerConfigError } = await supabase
      .from("providers")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("catalog_id", catalogItem.id)
      .single()

    if (providerConfigError || !providerConfig) {
      console.error('[api:connections:POST] Provider config not found', {
        providerKey,
        catalogId: catalogItem.id,
        workspaceId: workspace.id,
        error: providerConfigError?.message,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: "Configuração do provider não encontrada",
          message: `Configuração do provider '${providerKey}' não encontrada para este workspace`,
          details: providerConfigError?.message || "Provider não configurado no workspace",
        },
        { status: 404 }
      )
    }

    // Se entityId não for fornecido, usar a primeira entidade do workspace
    let targetEntityId = entityId
    if (!targetEntityId) {
      const { data: entities, error: entitiesError } = await supabase
        .from("entities")
        .select("id")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true })
        .limit(1)

      if (entitiesError || !entities || entities.length === 0) {
        console.error('[api:connections:POST] No entities found', {
          workspaceId: workspace.id,
          error: entitiesError?.message,
          userId: user.id,
        })
        return NextResponse.json(
          {
            error: "Nenhuma entidade encontrada",
            message: "Nenhuma entidade encontrada para vincular a conexão",
            details: entitiesError?.message || "Crie uma entidade antes de criar conexões",
          },
          { status: 400 }
        )
      }
      targetEntityId = entities[0].id
    }

    // Inserir nova conexão
    const { data: connection, error: insertError } = await supabase
      .from("connections")
      .insert({
        workspace_id: workspace.id,
        entity_id: targetEntityId,
        provider_id: providerConfig.id,
        external_connection_id: externalConnectionId,
        status: 'active', // Status inicial como ativo
        metadata: { providerKey },
      })
      .select()
      .single()

    if (insertError || !connection) {
      console.error('[api:connections:POST] Insert error', {
        error: insertError?.message,
        code: insertError?.code,
        userId: user.id,
        workspaceId: workspace.id,
        providerId: providerConfig.id,
        entityId: targetEntityId,
      })
      return NextResponse.json(
        {
          error: "Erro ao criar conexão",
          message: "Falha ao inserir conexão no banco de dados",
          details: insertError?.message || "Erro desconhecido",
        },
        { status: 500 }
      )
    }

    // Auditoria
    const { error: auditError } = await supabase.from("connectors_audit_log").insert({
      workspace_id: workspace.id,
      actor_user_id: user.id,
      action: "connection.created_via_widget",
      resource_type: "connection",
      resource_id: connection.id,
      metadata: { providerKey, externalConnectionId, entityId: targetEntityId },
    })

    if (auditError) {
      console.warn('[api:connections:POST] Audit log error (non-blocking):', auditError.message)
    }

    return NextResponse.json({ ok: true, connectionId: connection.id }, { status: 201 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[api:connections:POST] Unexpected error:', {
      message: errorMessage,
      stack,
    })
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao persistir conexão",
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
