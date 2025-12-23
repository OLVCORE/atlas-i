/**
 * MC10: Endpoint para atualizar/deletar conexões individuais
 * 
 * PATCH /api/connections/[connectionId] - Atualizar conexão (status, etc)
 * DELETE /api/connections/[connectionId] - Deletar conexão (soft delete ou hard delete)
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/connections/[connectionId]
 * Atualiza uma conexão (ex: status, last_error)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[api:connections:PATCH] Auth error:', authError?.message || 'No user')
      return NextResponse.json(
        { error: "Não autenticado", details: authError?.message },
        { status: 401 }
      )
    }

    const workspace = await getActiveWorkspace()
    const { connectionId } = params

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId é obrigatório" },
        { status: 400 }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[api:connections:PATCH] JSON parse error:', parseError)
      return NextResponse.json(
        { error: "Body inválido", details: "JSON malformado" },
        { status: 400 }
      )
    }

    // Validar que a conexão pertence ao workspace do usuário
    const { data: existingConnection, error: fetchError } = await supabase
      .from("connections")
      .select("id, workspace_id")
      .eq("id", connectionId)
      .eq("workspace_id", workspace.id)
      .single()

    if (fetchError || !existingConnection) {
      console.error('[api:connections:PATCH] Connection not found', {
        connectionId,
        workspaceId: workspace.id,
        error: fetchError?.message,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: "Conexão não encontrada",
          message: `Conexão '${connectionId}' não encontrada neste workspace`,
          details: fetchError?.message || "A conexão deve pertencer ao workspace ativo",
        },
        { status: 404 }
      )
    }

    // Preparar dados de atualização (permitir apenas campos seguros)
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    // Permitir atualizar status
    if (body.status !== undefined) {
      const allowedStatuses = ['active', 'inactive', 'revoked', 'error', 'needs_setup']
      if (allowedStatuses.includes(body.status)) {
        updateData.status = body.status
      } else {
        return NextResponse.json(
          {
            error: "Status inválido",
            message: `Status '${body.status}' não é permitido`,
            details: `Status permitidos: ${allowedStatuses.join(', ')}`,
          },
          { status: 400 }
        )
      }
    }

    // Permitir atualizar last_error
    if (body.last_error !== undefined) {
      updateData.last_error = body.last_error
    }

    // Atualizar conexão
    const { data: updatedConnection, error: updateError } = await supabase
      .from("connections")
      .update(updateData)
      .eq("id", connectionId)
      .eq("workspace_id", workspace.id)
      .select()
      .single()

    if (updateError || !updatedConnection) {
      console.error('[api:connections:PATCH] Update error:', {
        connectionId,
        workspaceId: workspace.id,
        error: updateError?.message,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: "Erro ao atualizar conexão",
          message: "Falha ao atualizar conexão",
          details: updateError?.message || "Erro desconhecido",
        },
        { status: 500 }
      )
    }

    console.log('[api:connections:PATCH] Connection updated', {
      connectionId,
      status: updatedConnection.status,
      workspaceId: workspace.id,
      userId: user.id,
    })

    return NextResponse.json({
      ok: true,
      connection: updatedConnection,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[api:connections:PATCH] Unexpected error:', {
      message: errorMessage,
      stack,
    })

    return NextResponse.json(
      {
        error: "internal_error",
        message: "Erro ao atualizar conexão",
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/connections/[connectionId]
 * Revoga/desativa uma conexão (marca como revoked em vez de deletar)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[api:connections:DELETE] Auth error:', authError?.message || 'No user')
      return NextResponse.json(
        { error: "Não autenticado", details: authError?.message },
        { status: 401 }
      )
    }

    const workspace = await getActiveWorkspace()
    const { connectionId } = params

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId é obrigatório" },
        { status: 400 }
      )
    }

    // Validar que a conexão pertence ao workspace do usuário
    const { data: existingConnection, error: fetchError } = await supabase
      .from("connections")
      .select("id, workspace_id, status")
      .eq("id", connectionId)
      .eq("workspace_id", workspace.id)
      .single()

    if (fetchError || !existingConnection) {
      console.error('[api:connections:DELETE] Connection not found', {
        connectionId,
        workspaceId: workspace.id,
        error: fetchError?.message,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: "Conexão não encontrada",
          message: `Conexão '${connectionId}' não encontrada neste workspace`,
          details: fetchError?.message || "A conexão deve pertencer ao workspace ativo",
        },
        { status: 404 }
      )
    }

    // Marcar como revoked (soft delete - preserva histórico)
    const { data: updatedConnection, error: updateError } = await supabase
      .from("connections")
      .update({
        status: 'revoked',
        last_error: 'Conexão revogada pelo usuário',
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .eq("workspace_id", workspace.id)
      .select()
      .single()

    if (updateError || !updatedConnection) {
      console.error('[api:connections:DELETE] Update error:', {
        connectionId,
        workspaceId: workspace.id,
        error: updateError?.message,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: "Erro ao revogar conexão",
          message: "Falha ao revogar conexão",
          details: updateError?.message || "Erro desconhecido",
        },
        { status: 500 }
      )
    }

    console.log('[api:connections:DELETE] Connection revoked', {
      connectionId,
      workspaceId: workspace.id,
      userId: user.id,
    })

    return NextResponse.json({
      ok: true,
      message: "Conexão revogada com sucesso",
      connection: updatedConnection,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[api:connections:DELETE] Unexpected error:', {
      message: errorMessage,
      stack,
    })

    return NextResponse.json(
      {
        error: "internal_error",
        message: "Erro ao revogar conexão",
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

