/**
 * MC3: Funções para gerenciar cartões e compras parceladas
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { resolveStatementMonth, addMonths, generateInstallments } from "./cycle"

export type Card = {
  id: string
  workspace_id: string
  entity_id: string
  name: string
  brand: string | null
  closing_day: number
  due_day: number
  currency: string
  is_active: boolean
  created_at: string
}

export type CardPurchase = {
  id: string
  workspace_id: string
  entity_id: string
  card_id: string
  purchase_date: string
  merchant: string | null
  description: string | null
  category_id: string | null
  total_amount: number
  installments: number
  first_installment_month: string | null
  created_by: string
  created_at: string
}

export type CardInstallment = {
  id: string
  workspace_id: string
  entity_id: string
  card_id: string
  purchase_id: string
  installment_number: number
  competence_month: string
  amount: number
  status: 'scheduled' | 'posted' | 'canceled'
  posted_transaction_id: string | null
  created_at: string
}

/**
 * Cria um novo cartão
 */
export async function createCard(
  entityId: string,
  name: string,
  closingDay: number,
  dueDay: number,
  brand?: string,
  isActive: boolean = true
): Promise<Card> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      workspace_id: workspace.id,
      entity_id: entityId,
      name,
      brand: brand || null,
      closing_day: closingDay,
      due_day: dueDay,
      currency: "BRL",
      is_active: isActive,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar cartão: ${error.message}`)
  }

  // Auditoria
  await supabase.from("card_audit_log").insert({
    workspace_id: workspace.id,
    actor_user_id: user.id,
    action: "card.created",
    resource_type: "card",
    resource_id: card.id,
    metadata: { name, brand, closing_day: closingDay, due_day: dueDay },
  })

  return card
}

/**
 * Lista todos os cartões do workspace ativo
 */
export async function listCards(): Promise<Card[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: cards, error } = await supabase
    .from("cards")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar cartões: ${error.message}`)
  }

  return cards || []
}

/**
 * Lista cartões de uma entidade específica
 */
export async function listCardsByEntity(entityId: string): Promise<Card[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: cards, error } = await supabase
    .from("cards")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(`Erro ao listar cartões da entidade: ${error.message}`)
  }

  return cards || []
}

/**
 * Busca um cartão por ID
 */
export async function getCardById(cardId: string): Promise<Card | null> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()

  const { data: card, error } = await supabase
    .from("cards")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("id", cardId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar cartão: ${error.message}`)
  }

  return card
}

/**
 * Cria uma compra parcelada e gera automaticamente as parcelas (agenda)
 */
export async function createCardPurchaseAndSchedule(
  cardId: string,
  entityId: string,
  purchaseDate: Date,
  totalAmount: number,
  installments: number,
  merchant?: string,
  description?: string,
  firstInstallmentMonth?: Date
): Promise<{ purchase: CardPurchase; installments: CardInstallment[] }> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Usuário não autenticado")
  }

  // Buscar dados do cartão
  const card = await getCardById(cardId)
  if (!card) {
    throw new Error("Cartão não encontrado")
  }

  // Determinar mês de competência inicial
  let initialMonth: Date
  if (firstInstallmentMonth) {
    // Usar o mês informado (garantir que seja primeiro dia)
    initialMonth = new Date(
      firstInstallmentMonth.getFullYear(),
      firstInstallmentMonth.getMonth(),
      1
    )
  } else {
    // Calcular baseado no ciclo do cartão
    initialMonth = resolveStatementMonth(purchaseDate, card.closing_day)
  }

  // Gerar valores das parcelas
  const installmentAmounts = generateInstallments(totalAmount, installments)

  // Criar a compra
  const { data: purchase, error: purchaseError } = await supabase
    .from("card_purchases")
    .insert({
      workspace_id: workspace.id,
      entity_id: entityId,
      card_id: cardId,
      purchase_date: purchaseDate.toISOString().split("T")[0],
      merchant: merchant || null,
      description: description || null,
      total_amount: totalAmount,
      installments,
      first_installment_month: initialMonth.toISOString().split("T")[0],
    })
    .select()
    .single()

  if (purchaseError) {
    throw new Error(`Erro ao criar compra: ${purchaseError.message}`)
  }

  // Gerar parcelas
  const installmentsToInsert = installmentAmounts.map((amount, index) => {
    const competenceMonth = addMonths(initialMonth, index)
    return {
      workspace_id: workspace.id,
      entity_id: entityId,
      card_id: cardId,
      purchase_id: purchase.id,
      installment_number: index + 1,
      competence_month: competenceMonth.toISOString().split("T")[0],
      amount,
      status: 'scheduled' as const,
    }
  })

  const { data: createdInstallments, error: installmentsError } = await supabase
    .from("card_installments")
    .insert(installmentsToInsert)
    .select()

  if (installmentsError) {
    // Rollback: deletar compra criada
    await supabase.from("card_purchases").delete().eq("id", purchase.id)
    throw new Error(`Erro ao gerar parcelas: ${installmentsError.message}`)
  }

  // Auditoria
  await supabase.from("card_audit_log").insert([
    {
      workspace_id: workspace.id,
      actor_user_id: user.id,
      action: "purchase.created",
      resource_type: "purchase",
      resource_id: purchase.id,
      metadata: { total_amount: totalAmount, installments },
    },
    {
      workspace_id: workspace.id,
      actor_user_id: user.id,
      action: "installments.generated",
      resource_type: "purchase",
      resource_id: purchase.id,
      metadata: { count: installments },
    },
  ])

  return {
    purchase,
    installments: createdInstallments || [],
  }
}

