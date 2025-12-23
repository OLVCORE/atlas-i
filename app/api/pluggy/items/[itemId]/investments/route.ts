/**
 * MC10.0.1: Buscar investimentos de um item Pluggy
 */

import { NextRequest, NextResponse } from "next/server"
import { pluggyFetch } from "@/lib/pluggy/http"

export const dynamic = 'force-dynamic'

type PluggyInvestment = {
  id: string
  type: string
  subtype: string
  name: string
  balance: number
  currencyCode: string
  itemId: string
  code?: string
  value?: number
}

type PluggyInvestmentsResponse = {
  results: PluggyInvestment[]
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

    const response = await pluggyFetch(`/investments?itemId=${itemId}`, {
      method: 'GET',
    })

    const data = (await response.json()) as PluggyInvestmentsResponse

    return NextResponse.json({
      ok: true,
      investments: data.results || [],
      page: data.page || 1,
      total: data.total || 0,
      totalPages: data.totalPages || 1,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    console.error('[pluggy:investments] Erro:', errorMessage)

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao buscar investimentos",
      },
      { status: 500 }
    )
  }
}

