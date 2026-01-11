import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export type ContractLineItem = {
  id: string
  contract_id: string
  workspace_id: string
  type: 'expense' | 'discount'
  description: string | null
  amount: number
  item_order: number
  created_at: string
  updated_at: string
}

export type CreateContractLineItemInput = {
  contractId: string
  type: 'expense' | 'discount'
  description?: string | null
  amount: number
  itemOrder?: number
}

export type UpdateContractLineItemInput = {
  description?: string | null
  amount?: number
  itemOrder?: number
}

/**
 * Lista todos os itens de linha de um contrato
 */
export async function listContractLineItems(contractId: string): Promise<ContractLineItem[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const { data, error } = await supabase
    .from("contract_line_items")
    .select("*")
    .eq("contract_id", contractId)
    .eq("workspace_id", workspace.id)
    .order("item_order", { ascending: true })
    .order("created_at", { ascending: true })
  
  if (error) {
    throw new Error(`Erro ao listar itens do contrato: ${error.message}`)
  }
  
  return data || []
}

/**
 * Cria um item de linha em um contrato
 */
export async function createContractLineItem(input: CreateContractLineItemInput): Promise<ContractLineItem> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar último item_order
  const { data: existingItems } = await supabase
    .from("contract_line_items")
    .select("item_order")
    .eq("contract_id", input.contractId)
    .eq("workspace_id", workspace.id)
    .order("item_order", { ascending: false })
    .limit(1)
  
  const nextOrder = existingItems && existingItems.length > 0 
    ? (existingItems[0].item_order || 0) + 1 
    : 0
  
  const { data: item, error } = await supabase
    .from("contract_line_items")
    .insert({
      contract_id: input.contractId,
      workspace_id: workspace.id,
      type: input.type,
      description: input.description || null,
      amount: input.amount,
      item_order: input.itemOrder !== undefined ? input.itemOrder : nextOrder,
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao criar item do contrato: ${error.message}`)
  }
  
  return item
}

/**
 * Cria múltiplos itens de linha em um contrato
 */
export async function createContractLineItems(
  contractId: string,
  items: Array<{ type: 'expense' | 'discount'; description?: string | null; amount: number }>
): Promise<ContractLineItem[]> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Buscar último item_order
  const { data: existingItems } = await supabase
    .from("contract_line_items")
    .select("item_order")
    .eq("contract_id", contractId)
    .eq("workspace_id", workspace.id)
    .order("item_order", { ascending: false })
    .limit(1)
  
  let nextOrder = existingItems && existingItems.length > 0 
    ? (existingItems[0].item_order || 0) + 1 
    : 0
  
  const itemsToInsert = items.map((item, index) => ({
    contract_id: contractId,
    workspace_id: workspace.id,
    type: item.type,
    description: item.description || null,
    amount: item.amount,
    item_order: nextOrder + index,
  }))
  
  const { data: insertedItems, error } = await supabase
    .from("contract_line_items")
    .insert(itemsToInsert)
    .select()
  
  if (error) {
    throw new Error(`Erro ao criar itens do contrato: ${error.message}`)
  }
  
  return insertedItems || []
}

/**
 * Atualiza um item de linha
 */
export async function updateContractLineItem(
  itemId: string,
  input: UpdateContractLineItemInput
): Promise<ContractLineItem> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const updateData: any = {}
  if (input.description !== undefined) updateData.description = input.description
  if (input.amount !== undefined) updateData.amount = input.amount
  if (input.itemOrder !== undefined) updateData.item_order = input.itemOrder
  
  const { data: item, error } = await supabase
    .from("contract_line_items")
    .update(updateData)
    .eq("id", itemId)
    .eq("workspace_id", workspace.id)
    .select()
    .single()
  
  if (error) {
    throw new Error(`Erro ao atualizar item do contrato: ${error.message}`)
  }
  
  return item
}

/**
 * Deleta um item de linha
 */
export async function deleteContractLineItem(itemId: string): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const { error } = await supabase
    .from("contract_line_items")
    .delete()
    .eq("id", itemId)
    .eq("workspace_id", workspace.id)
  
  if (error) {
    throw new Error(`Erro ao deletar item do contrato: ${error.message}`)
  }
}

/**
 * Deleta todos os itens de linha de um contrato
 */
export async function deleteContractLineItemsByContract(contractId: string): Promise<void> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const { error } = await supabase
    .from("contract_line_items")
    .delete()
    .eq("contract_id", contractId)
    .eq("workspace_id", workspace.id)
  
  if (error) {
    throw new Error(`Erro ao deletar itens do contrato: ${error.message}`)
  }
}
