/**
 * MC10.0.1: Buscar contas de um item Pluggy
 */

import { NextRequest, NextResponse } from "next/server"
import { pluggyFetch } from "@/lib/pluggy/http"

export const dynamic = 'force-dynamic'

type PluggyAccount = {
  id: string
  type: string
  subtype: string
  name: string
  balance: number
  currencyCode: string
  itemId: string
  bankData?: any
  creditData?: any
}

type PluggyAccountsResponse = {
  results: PluggyAccount[]
  page: number
  total: number
  totalPages: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params

    if (!itemId) {
      return NextResponse.json(
        { ok: false, error: "itemId é obrigatório" },
        { status: 400 }
      )
    }

    const response = await pluggyFetch(`/accounts?itemId=${itemId}`, {
      method: 'GET',
    })

    const data = (await response.json()) as PluggyAccountsResponse

    return NextResponse.json({
      ok: true,
      accounts: data.results || [],
      page: data.page || 1,
      total: data.total || 0,
      totalPages: data.totalPages || 1,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    console.error('[pluggy:accounts] Erro:', errorMessage)

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao buscar contas",
      },
      { status: 500 }
    )
  }
}

