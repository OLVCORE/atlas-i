import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { findMatchingDebitNotes } from "@/lib/debit-notes"
import type { Transaction } from "@/lib/transactions"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const workspace = await getActiveWorkspace()
    const searchParams = request.nextUrl.searchParams
    const amount = parseFloat(searchParams.get("amount") || "0")
    const date = searchParams.get("date")

    if (!amount || amount <= 0 || !date) {
      return NextResponse.json(
        { error: "amount e date são obrigatórios" },
        { status: 400 }
      )
    }

    // Buscar notas compatíveis
    const matchingNotes = await findMatchingDebitNotes(amount, date)

    // Buscar transações não reconciliadas do workspace
    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("type", "income")
      .order("date", { ascending: false })
      .limit(50)

    if (transactionsError) {
      throw new Error(`Erro ao buscar transações: ${transactionsError.message}`)
    }

    // Filtrar transações que não estão vinculadas a notas de débito
    const { data: paidNotes, error: paidNotesError } = await supabase
      .from("debit_notes")
      .select("linked_transaction_id")
      .eq("workspace_id", workspace.id)
      .not("linked_transaction_id", "is", null)

    if (paidNotesError) {
      throw new Error(`Erro ao buscar notas pagas: ${paidNotesError.message}`)
    }

    const linkedTransactionIds = new Set(paidNotes?.map((n) => n.linked_transaction_id) || [])

    const unlinkedTransactions = (transactions || []).filter(
      (tx) => !linkedTransactionIds.has(tx.id)
    )

    // Filtrar transações compatíveis (valor e data)
    const dateObj = new Date(date + "T00:00:00")
    const toleranceDays = 2
    const minDate = new Date(dateObj)
    minDate.setDate(minDate.getDate() - toleranceDays)
    const maxDate = new Date(dateObj)
    maxDate.setDate(maxDate.getDate() + toleranceDays)

    const compatibleTransactions = unlinkedTransactions.filter((tx) => {
      const txDate = new Date(tx.date + "T00:00:00")
      const amountMatch = Math.abs(tx.amount - amount) <= 0.01
      const dateMatch = txDate >= minDate && txDate <= maxDate
      return amountMatch && dateMatch
    })

    return NextResponse.json({ transactions: compatibleTransactions }, { status: 200 })
  } catch (error: any) {
    console.error("[api/debit-notes/match] Erro:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar transações compatíveis" },
      { status: 500 }
    )
  }
}
