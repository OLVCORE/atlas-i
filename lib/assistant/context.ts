/**
 * MC3.2: Assistant Context - Gather workspace context for AI assistant
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { listEntities } from "@/lib/entities"
import { listAllAccounts } from "@/lib/accounts"
import { listCards } from "@/lib/cards/purchases"
import { listConnections } from "@/lib/connectors/connections"
import { listProviders } from "@/lib/connectors/providers"

export type AssistantContext = {
  workspace: {
    id: string
    name: string
  }
  counts: {
    entities: number
    accounts: number
    cards: number
    transactions: number
    connections: number
    providers: number
  }
  recentTransactions: Array<{
    description: string
    date: string
    amount: number
    type: string
  }>
  providers: Array<{
    name: string
    status: string
  }>
  connections: Array<{
    status: string
    last_sync_at: string | null
  }>
}

/**
 * Gather context from the active workspace for the AI assistant
 */
export async function gatherAssistantContext(): Promise<AssistantContext> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  // Coletar dados com tratamento de erro para cada query
  // Se uma falhar, usar valores padrão para não quebrar o assistente
  let entities: any[] = []
  let accounts: any[] = []
  let cards: any[] = []
  let providers: any[] = []
  let connections: any[] = []
  let transactions: any[] = []

  try {
    entities = await listEntities()
  } catch (error) {
    console.error("Erro ao listar entidades para contexto:", error)
  }

  try {
    accounts = await listAllAccounts()
  } catch (error) {
    console.error("Erro ao listar contas para contexto:", error)
  }

  try {
    cards = await listCards()
  } catch (error) {
    console.error("Erro ao listar cartões para contexto:", error)
  }

  try {
    providers = await listProviders()
  } catch (error) {
    console.error("Erro ao listar providers para contexto:", error)
  }

  try {
    connections = await listConnections()
  } catch (error) {
    console.error("Erro ao listar conexões para contexto:", error)
  }

  try {
    const { data } = await supabase
      .from("transactions")
      .select("description, date, amount, type")
      .eq("workspace_id", workspace.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10)
    transactions = data || []
  } catch (error) {
    console.error("Erro ao listar transações para contexto:", error)
  }

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
    },
    counts: {
      entities: entities.length,
      accounts: accounts.length,
      cards: cards.length,
      transactions: transactions.length,
      connections: connections.length,
      providers: providers.length,
    },
    recentTransactions: transactions.map((t: any) => ({
      description: t.description,
      date: t.date,
      amount: Number(t.amount),
      type: t.type,
    })),
    providers: providers.map((p: any) => ({
      name: p.catalog_name || p.name,
      status: p.status,
    })),
    connections: connections.map((c: any) => ({
      status: c.status,
      last_sync_at: c.last_sync_at,
    })),
  }
}

