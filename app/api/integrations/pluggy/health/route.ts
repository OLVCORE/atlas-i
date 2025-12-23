/**
 * MC10.0.1: Health check para credenciais Pluggy
 * 
 * Verifica se as credenciais estão configuradas e funcionais
 */

import { NextRequest, NextResponse } from "next/server"
import { getPluggyApiKey } from "@/lib/pluggy/auth"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Tentar obter API Key (testa se credenciais estão corretas)
    await getPluggyApiKey()

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    
    // Se for erro de configuração, retornar ok: false
    if (errorMessage.includes('deve estar configurado')) {
      return NextResponse.json(
        {
          ok: false,
          reason: "Credenciais não configuradas",
        },
        { status: 200 } // Retorna 200 mesmo com erro para não quebrar UI
      )
    }

    // Se for erro de autenticação na Pluggy, credenciais inválidas
    return NextResponse.json(
      {
        ok: false,
        reason: "Credenciais inválidas ou erro ao autenticar com Pluggy",
      },
      { status: 200 }
    )
  }
}

