/**
 * MC12: Importador de planilhas (CSV/Excel)
 * 
 * Importa transações de extratos bancários mantendo:
 * - Rastreamento via source='csv' e external_id
 * - Idempotência (não duplica transações)
 * - Conciliação automática com schedules/commitments
 */

import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { parseCSV, ParsedRow } from "./csv-parser"
import { listAllAccounts } from "@/lib/accounts"
import { createTransaction } from "@/lib/transactions"

export type ImportOptions = {
  entityId: string
  accountId?: string | null // Se null, tenta encontrar ou criar conta
  accountName?: string // Nome da conta se precisar criar
  accountType?: 'checking' | 'investment' | 'other'
  skipDuplicates?: boolean // Pular transações já importadas (por external_id)
  autoReconcile?: boolean // Tentar conciliar automaticamente com schedules
}

export type ImportResult = {
  success: boolean
  imported: {
    transactions: number
    accounts: number
  }
  skipped: {
    duplicates: number
    errors: number
  }
  errors: Array<{
    row: number
    message: string
    raw?: Record<string, string>
  }>
  warnings: Array<{
    message: string
    details?: any
  }>
}

/**
 * Gera external_id único para uma transação importada
 * Baseado em: data + descrição + valor + entity_id
 */
function generateExternalId(row: ParsedRow, entityId: string): string {
  const hash = `${row.date}|${row.description.trim()}|${row.amount}|${row.type}`
  // Usar hash simples (em produção, poderia usar crypto)
  const hashValue = hash.split('').reduce((acc, char) => {
    const charCode = char.charCodeAt(0)
    return ((acc << 5) - acc) + charCode
  }, 0)
  
  return `csv_${entityId}_${Math.abs(hashValue).toString(36)}`
}

/**
 * Verifica se transação já existe (idempotência)
 */
async function transactionExists(
  entityId: string,
  externalId: string
): Promise<boolean> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .eq("source", "csv")
    .eq("external_id", externalId)
    .limit(1)
    .maybeSingle()
  
  if (error) {
    console.error('[import] Erro ao verificar transação existente:', error)
    return false
  }
  
  return data !== null
}

/**
 * Encontra ou cria conta baseado no nome
 */
async function findOrCreateAccount(
  entityId: string,
  accountName: string,
  accountType: 'checking' | 'investment' | 'other' = 'checking'
): Promise<string | null> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // Tentar encontrar conta existente
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .ilike("name", accountName)
    .limit(1)
    .maybeSingle()
  
  if (existing) {
    return existing.id
  }
  
  // Criar nova conta
  const { data: newAccount, error } = await supabase
    .from("accounts")
    .insert({
      workspace_id: workspace.id,
      entity_id: entityId,
      name: accountName,
      type: accountType,
      currency: 'BRL',
      opening_balance: 0,
      opening_balance_date: new Date().toISOString().split('T')[0],
      source: 'csv', // Marcar como importada
    })
    .select("id")
    .single()
  
  if (error) {
    console.error('[import] Erro ao criar conta:', error)
    return null
  }
  
  return newAccount.id
}

/**
 * Importa planilha CSV
 */
export async function importSpreadsheet(
  csvContent: string,
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: {
      transactions: 0,
      accounts: 0,
    },
    skipped: {
      duplicates: 0,
      errors: 0,
    },
    errors: [],
    warnings: [],
  }
  
  try {
    // Parse CSV
    const parseResult = parseCSV(csvContent)
    
    if (parseResult.errors.length > 0) {
      result.errors.push(...parseResult.errors)
      result.skipped.errors = parseResult.errors.length
    }
    
    if (parseResult.rows.length === 0) {
      result.errors.push({
        row: 0,
        message: 'Nenhuma linha válida encontrada no arquivo',
      })
      return result
    }
    
    const supabase = await createClient()
    const workspace = await getActiveWorkspace()
    
    // Resolver accountId
    let accountId = options.accountId
    
    if (!accountId && options.accountName) {
      // Tentar encontrar ou criar conta
      accountId = await findOrCreateAccount(
        options.entityId,
        options.accountName,
        options.accountType || 'checking'
      )
      
      if (accountId) {
        result.imported.accounts = 1
        result.warnings.push({
          message: `Conta "${options.accountName}" criada automaticamente`,
        })
      }
    }
    
    // Se ainda não tem accountId, tentar usar a primeira conta da entidade
    if (!accountId) {
      const accounts = await listAllAccounts()
      const entityAccount = accounts.find(acc => acc.entity_id === options.entityId)
      
      if (entityAccount) {
        accountId = entityAccount.id
        result.warnings.push({
          message: `Usando conta existente: ${entityAccount.name}`,
        })
      } else {
        result.warnings.push({
          message: 'Nenhuma conta encontrada. Transações serão criadas sem conta específica.',
        })
      }
    }
    
    // Importar transações
    const transactionsToInsert: Array<{
      workspace_id: string
      entity_id: string
      account_id: string | null
      type: 'income' | 'expense' | 'transfer'
      amount: number
      currency: string
      date: string
      description: string
      source: string
      external_id: string
    }> = []
    
    for (const row of parseResult.rows) {
      const externalId = generateExternalId(row, options.entityId)
      
      // Verificar duplicata se solicitado
      if (options.skipDuplicates) {
        const exists = await transactionExists(options.entityId, externalId)
        if (exists) {
          result.skipped.duplicates++
          continue
        }
      }
      
      // Preparar transação
      const amount = row.type === 'expense' ? -Math.abs(row.amount) : Math.abs(row.amount)
      
      transactionsToInsert.push({
        workspace_id: workspace.id,
        entity_id: options.entityId,
        account_id: accountId,
        type: row.type,
        amount,
        currency: 'BRL',
        date: row.date,
        description: row.description,
        source: 'csv',
        external_id: externalId,
      })
    }
    
    // Inserir transações em lote
    if (transactionsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("transactions")
        .insert(transactionsToInsert)
        .select("id")
      
      if (insertError) {
        result.errors.push({
          row: 0,
          message: `Erro ao inserir transações: ${insertError.message}`,
        })
        result.skipped.errors += transactionsToInsert.length
      } else {
        result.imported.transactions = inserted?.length || 0
      }
    }
    
    // Se autoReconcile, tentar conciliar automaticamente
    if (options.autoReconcile && result.imported.transactions > 0) {
      // TODO: Implementar conciliação automática
      // Por enquanto, apenas avisar que precisa ser feita manualmente
      result.warnings.push({
        message: 'Conciliação automática ainda não implementada. Use a página de reconciliação para conciliar manualmente.',
      })
    }
    
    result.success = result.imported.transactions > 0
    
  } catch (error) {
    result.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : 'Erro desconhecido ao importar',
    })
    result.skipped.errors++
  }
  
  return result
}

