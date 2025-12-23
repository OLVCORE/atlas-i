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

    // entityId é obrigatório - nunca "chutar"
    if (!entityId) {
      console.error('[api:connections:POST] entityId is required', {
        workspaceId: workspace.id,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: "entityId é obrigatório",
          message: "entityId deve ser fornecido ao criar conexão",
          details: "Nunca use entidade padrão. O entityId deve vir da UI.",
        },
        { status: 400 }
      )
    }

    // Validar que a entidade pertence ao workspace
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("id")
      .eq("id", entityId)
      .eq("workspace_id", workspace.id)
      .single()

    if (entityError || !entity) {
      console.error('[api:connections:POST] Entity not found or wrong workspace', {
        entityId,
        workspaceId: workspace.id,
        error: entityError?.message,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: "Entidade não encontrada",
          message: `Entidade '${entityId}' não encontrada neste workspace`,
          details: entityError?.message || "A entidade deve pertencer ao workspace ativo",
        },
        { status: 404 }
      )
    }

    const targetEntityId = entityId

    // Verificar se já existe conexão (idempotência)
    const { data: existingConnection } = await supabase
      .from("connections")
      .select("id, status, last_sync_at")
      .eq("workspace_id", workspace.id)
      .eq("entity_id", targetEntityId)
      .eq("provider_id", providerConfig.id)
      .eq("external_connection_id", externalConnectionId)
      .maybeSingle()

    let connection

    if (existingConnection) {
      // Conexão já existe, retornar existente (idempotência)
      console.log('[api:connections:POST] Connection already exists', {
        connectionId: existingConnection.id,
        userId: user.id,
        workspaceId: workspace.id,
        entityId: targetEntityId,
        externalConnectionId,
      })
      connection = existingConnection
    } else {
      // Inserir nova conexão
      const { data: newConnection, error: insertError } = await supabase
        .from("connections")
        .insert({
          workspace_id: workspace.id,
          entity_id: targetEntityId,
          provider_id: providerConfig.id,
          external_connection_id: externalConnectionId,
          status: 'active',
          last_error: null,
          metadata: { providerKey },
        })
        .select()
        .single()

      if (insertError || !newConnection) {
        // Se erro for de constraint unique violation, buscar existente
        if (insertError?.code === '23505') {
          const { data: conflictConnection } = await supabase
            .from("connections")
            .select("id, status, last_sync_at")
            .eq("workspace_id", workspace.id)
            .eq("entity_id", targetEntityId)
            .eq("provider_id", providerConfig.id)
            .eq("external_connection_id", externalConnectionId)
            .maybeSingle()

          if (conflictConnection) {
            connection = conflictConnection
          } else {
            console.error('[api:connections:POST] Insert error (conflict)', {
              error: insertError?.message,
              code: insertError?.code,
              userId: user.id,
              workspaceId: workspace.id,
            })
            return NextResponse.json(
              {
                error: "Erro ao criar conexão",
                message: "Conexão duplicada detectada mas não encontrada",
                details: insertError?.message || "Erro desconhecido",
              },
              { status: 500 }
            )
          }
        } else {
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
      } else {
        connection = newConnection
      }
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
