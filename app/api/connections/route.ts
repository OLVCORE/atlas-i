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
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { providerKey, externalConnectionId, entityId } = body

    if (!providerKey || !externalConnectionId) {
      return NextResponse.json(
        { error: "providerKey e externalConnectionId são obrigatórios" },
        { status: 400 }
      )
    }

    const workspace = await getActiveWorkspace()

    // Buscar provider pelo catalog code
    const { data: catalogItem, error: catalogError } = await supabase
      .from("provider_catalog")
      .select("id")
      .eq("code", providerKey)
      .eq("is_active", true)
      .single()

    if (catalogError || !catalogItem) {
      return NextResponse.json(
        { error: `Provider '${providerKey}' não encontrado no catálogo` },
        { status: 404 }
      )
    }

    // Buscar provider config do workspace
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("catalog_id", catalogItem.id)
      .single()

    if (providerError || !provider) {
      return NextResponse.json(
        { error: `Provider '${providerKey}' não configurado neste workspace` },
        { status: 404 }
      )
    }

    // Se entityId não foi fornecido, usar a primeira entidade do workspace
    let targetEntityId = entityId
    if (!targetEntityId) {
      const { data: firstEntity } = await supabase
        .from("entities")
        .select("id")
        .eq("workspace_id", workspace.id)
        .limit(1)
        .single()

      if (!firstEntity) {
        return NextResponse.json(
          { error: "Nenhuma entidade encontrada no workspace. Crie uma entidade primeiro." },
          { status: 400 }
        )
      }

      targetEntityId = firstEntity.id
    }

    // Criar conexão
    const { data: connection, error: insertError } = await supabase
      .from("connections")
      .insert({
        workspace_id: workspace.id,
        entity_id: targetEntityId,
        provider_id: provider.id,
        status: 'active',
        external_connection_id: externalConnectionId,
        metadata: {},
      })
      .select()
      .single()

    if (insertError) {
      console.error('[connections:POST] Erro ao criar conexão:', insertError)
      return NextResponse.json(
        { error: `Erro ao criar conexão: ${insertError.message}` },
        { status: 500 }
      )
    }

    // Auditoria
    await supabase.from("connectors_audit_log").insert({
      workspace_id: workspace.id,
      actor_user_id: user.id,
      action: "connection.created",
      resource_type: "connection",
      resource_id: connection.id,
      metadata: { provider_key: providerKey, external_connection_id: externalConnectionId },
    })

    return NextResponse.json(
      { 
        ok: true,
        connection: {
          id: connection.id,
          external_connection_id: connection.external_connection_id,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    console.error('[connections:POST] Erro:', errorMessage)
    return NextResponse.json(
      { error: "Erro interno ao criar conexão" },
      { status: 500 }
    )
  }
}

