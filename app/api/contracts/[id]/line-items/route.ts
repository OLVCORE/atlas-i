import { NextResponse } from "next/server"
import { listContractLineItems } from "@/lib/contract-line-items"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const items = await listContractLineItems(id)
    
    return NextResponse.json({ items })
  } catch (error: any) {
    console.error("[api:contracts:line-items] Erro:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao listar itens do contrato" },
      { status: 500 }
    )
  }
}
