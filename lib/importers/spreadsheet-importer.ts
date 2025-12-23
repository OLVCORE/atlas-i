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
 * Baseado em: data + descrição normalizada + valor + entity_id + account_id
 * 
 * IMPORTANTE: Parcelas diferentes (ex: "Parcela 3/10" vs "Parcela 4/10") 
 * terão external_ids diferentes, permitindo múltiplas importações da mesma compra.
 */
function generateExternalId(
  row: ParsedRow, 
  entityId: string, 
  accountId: string | null
): string {
  // Normalizar descrição (remover espaços extras, mas manter diferenças de parcelas)
  const normalizedDesc = row.description.trim().replace(/\s+/g, ' ')
  
  // Incluir account_id no hash para diferenciar transações da mesma descrição em contas diferentes
  const accountPart = accountId ? `_${accountId.substring(0, 8)}` : ''
  
  const hash = `${row.date}|${normalizedDesc}|${row.amount}|${row.type}${accountPart}`
  
  // Usar hash simples (em produção, poderia usar crypto)
  const hashValue = hash.split('').reduce((acc, char) => {
    const charCode = char.charCodeAt(0)
    return ((acc << 5) - acc) + charCode
  }, 0)
  
  return `csv_${entityId}_${Math.abs(hashValue).toString(36)}`
}

/**
 * Verifica se transação já existe (idempotência)
 * 
 * Estratégia de detecção de duplicatas:
 * 1. Por external_id (mais preciso - mesma data + descrição + valor + conta)
 * 2. Por matching fuzzy (data próxima + valor igual + descrição similar) - fallback
 */
async function transactionExists(
  entityId: string,
  externalId: string,
  date: string,
  amount: number,
  description: string,
  accountId: string | null
): Promise<{ exists: boolean; transactionId?: string; matchType?: 'exact' | 'fuzzy' }> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  // 1. Verificar por external_id (match exato)
  const { data: exactMatch, error: exactError } = await supabase
    .from("transactions")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .eq("source", "csv")
    .eq("external_id", externalId)
    .limit(1)
    .maybeSingle()
  
  if (exactError) {
    console.error('[import] Erro ao verificar transação existente:', exactError)
    return { exists: false }
  }
  
  if (exactMatch) {
    return { exists: true, transactionId: exactMatch.id, matchType: 'exact' }
  }
  
  // 2. Verificar por matching fuzzy (data próxima + valor igual + descrição similar)
  // Isso evita duplicatas quando a descrição muda ligeiramente mas é a mesma transação
  const dateObj = new Date(date)
  const dateStart = new Date(dateObj)
  dateStart.setDate(dateStart.getDate() - 1) // 1 dia antes
  const dateEnd = new Date(dateObj)
  dateEnd.setDate(dateEnd.getDate() + 1) // 1 dia depois
  
  const amountTolerance = 0.01 // 1 centavo de tolerância
  
  const { data: fuzzyMatches, error: fuzzyError } = await supabase
    .from("transactions")
    .select("id, date, amount, description")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .eq("source", "csv")
    .gte("date", dateStart.toISOString().split('T')[0])
    .lte("date", dateEnd.toISOString().split('T')[0])
    .eq("account_id", accountId) // Mesma conta
    .limit(10)
  
  if (fuzzyError) {
    console.error('[import] Erro ao verificar matches fuzzy:', fuzzyError)
    return { exists: false }
  }
  
  // Verificar se algum match fuzzy tem valor igual e descrição similar
  if (fuzzyMatches) {
    for (const match of fuzzyMatches) {
      const matchAmount = Math.abs(Number(match.amount))
      const rowAmount = Math.abs(amount)
      
      // Valor igual (com tolerância)
      if (Math.abs(matchAmount - rowAmount) <= amountTolerance) {
        // Descrição similar (normalizar e comparar)
        const matchDesc = (match.description || '').trim().toLowerCase()
        const rowDesc = description.trim().toLowerCase()
        
        // Se descrições são idênticas ou muito similares (>80% de similaridade)
        if (matchDesc === rowDesc || calculateSimilarity(matchDesc, rowDesc) > 0.8) {
          return { exists: true, transactionId: match.id, matchType: 'fuzzy' }
        }
      }
    }
  }
  
  return { exists: false }
}

/**
 * Calcula similaridade simples entre duas strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  
  // Normalizar: remover acentos, espaços extras, caracteres especiais
  const normalize = (s: string) => s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  
  const n1 = normalize(str1)
  const n2 = normalize(str2)
  
  if (n1 === n2) return 0.95
  
  // Calcular similaridade por caracteres comuns
  const longer = n1.length > n2.length ? n1 : n2
  const shorter = n1.length > n2.length ? n2 : n1
  
  if (longer.length === 0) return 1.0
  
  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++
    }
  }
  
  return matches / longer.length
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
      const externalId = generateExternalId(row, options.entityId, accountId)
      
      // Verificar duplicata se solicitado
      if (options.skipDuplicates) {
        const amount = row.type === 'expense' ? -Math.abs(row.amount) : Math.abs(row.amount)
        const duplicateCheck = await transactionExists(
          options.entityId,
          externalId,
          row.date,
          amount,
          row.description,
          accountId
        )
        
        if (duplicateCheck.exists) {
          result.skipped.duplicates++
          
          // Adicionar aviso se foi match fuzzy (pode indicar descrição ligeiramente diferente)
          if (duplicateCheck.matchType === 'fuzzy') {
            result.warnings.push({
              message: `Linha pulada (duplicata detectada por similaridade): ${row.description.substring(0, 50)}...`,
            })
          }
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

