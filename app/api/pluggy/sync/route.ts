/**
 * MC10: Endpoint para sincronizar dados do Pluggy
 * 
 * Busca accounts, transactions e cards do Pluggy e faz upsert nas tabelas do sistema
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncPluggyConnection } from "@/lib/pluggy/sync"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[api:pluggy:sync] Auth error:', authError?.message || 'No user')
      return NextResponse.json(
        { error: "Não autenticado", details: authError?.message },
        { status: 401 }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[api:pluggy:sync] JSON parse error:', parseError)
      return NextResponse.json(
        { error: "Body inválido", details: "JSON malformado" },
        { status: 400 }
      )
    }

    const { connectionId } = body

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId é obrigatório" },
        { status: 400 }
      )
    }

    const result = await syncPluggyConnection(connectionId)

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[api:pluggy:sync] Unexpected error:', {
      message: errorMessage,
      stack,
    })

    // Detectar erros específicos de configuração
    if (errorMessage.includes('PLUGGY_CLIENT_ID') || errorMessage.includes('PLUGGY_CLIENT_SECRET')) {
      return NextResponse.json(
        {
          error: "configuration_error",
          message: "Credenciais Pluggy não configuradas",
          details: "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nas variáveis de ambiente da Vercel",
        },
        { status: 500 }
      )
    }

    // Detectar erro 403 da API Pluggy (autenticação falhou)
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return NextResponse.json(
        {
          error: "pluggy_auth_error",
          message: "Erro de autenticação com a API Pluggy",
          details: "Verifique se PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET estão corretos na Vercel",
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: "internal_error",
        message: "Erro ao sincronizar dados do Pluggy",
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

