/**
 * MC10.0.1: Buscar transações de um item Pluggy
 */

import { NextRequest, NextResponse } from "next/server"
import { pluggyFetch } from "@/lib/pluggy/http"

export const dynamic = 'force-dynamic'

type PluggyTransaction = {
  id: string
  accountId: string
  amount: number
  date: string
  description: string
  category?: string
  type: string
  balance?: number
}

type PluggyTransactionsResponse = {
  results: PluggyTransaction[]
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
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') // YYYY-MM-DD
    const to = searchParams.get('to') // YYYY-MM-DD
    const accountId = searchParams.get('accountId')

    if (!itemId) {
      return NextResponse.json(
        { ok: false, error: "itemId é obrigatório" },
        { status: 400 }
      )
    }

    // Construir query params
    const queryParams = new URLSearchParams()
    queryParams.append('itemId', itemId)
    if (from) queryParams.append('from', from)
    if (to) queryParams.append('to', to)
    if (accountId) queryParams.append('accountId', accountId)

    const response = await pluggyFetch(`/transactions?${queryParams.toString()}`, {
      method: 'GET',
    })

    const data = (await response.json()) as PluggyTransactionsResponse

    return NextResponse.json({
      ok: true,
      transactions: data.results || [],
      page: data.page || 1,
      total: data.total || 0,
      totalPages: data.totalPages || 1,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    console.error('[pluggy:transactions] Erro:', errorMessage)

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Erro ao buscar transações",
      },
      { status: 500 }
    )
  }
}

