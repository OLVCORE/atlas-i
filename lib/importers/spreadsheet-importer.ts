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
  source?: 'csv' | 'scraper' // Origem da importação
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
  accountId: string | null,
  source: 'csv' | 'scraper' = 'csv'
): string {
  // Normalizar descrição (remover espaços extras, mas manter diferenças de parcelas)
  const normalizedDesc = row.description.trim().replace(/\s+/g, ' ')
  
  // Incluir account_id no hash para diferenciar transações da mesma descrição em contas diferentes
  const accountPart = accountId ? `_${accountId.substring(0, 8)}` : ''
  
  const hash = `${row.date}|${normalizedDesc}|${row.amount}|${row.type}${accountPart}|${source}`
  
  // Usar hash simples (em produção, poderia usar crypto)
  const hashValue = hash.split('').reduce((acc, char) => {
    const charCode = char.charCodeAt(0)
    return ((acc << 5) - acc) + charCode
  }, 0)
  
  return `${source}_${entityId}_${Math.abs(hashValue).toString(36)}`
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
  
  // Construir query para fuzzy matches
  let fuzzyQuery = supabase
    .from("transactions")
    .select("id, date, amount, description")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
    .eq("source", "csv")
    .gte("date", dateStart.toISOString().split('T')[0])
    .lte("date", dateEnd.toISOString().split('T')[0])
    .limit(10)
  
  // Só adicionar filtro de account_id se não for null
  if (accountId !== null && accountId !== undefined) {
    fuzzyQuery = fuzzyQuery.eq("account_id", accountId)
  } else {
    fuzzyQuery = fuzzyQuery.is("account_id", null)
  }
  
  const { data: fuzzyMatches, error: fuzzyError } = await fuzzyQuery
  
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
      opening_balance_as_of: new Date().toISOString().split('T')[0],
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
 * Faz baixa automática de parcelas de cartão quando detecta pagamentos nas transações importadas
 */
async function settleCardInstallmentsFromTransactions(
  entityId: string,
  accountId: string,
  transactions: Array<{ id: string; date: string; amount: number; description: string }>
): Promise<number> {
  const supabase = await createClient()
  const workspace = await getActiveWorkspace()
  
  let settledCount = 0
  
  // Verificar se a conta está vinculada a um cartão
  const { data: accountData } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("id", accountId)
    .eq("workspace_id", workspace.id)
    .single()
  
  if (!accountData) return 0
  
  // Buscar cartões da entidade
  const { data: cards } = await supabase
    .from("cards")
    .select("id, name, due_day")
    .eq("workspace_id", workspace.id)
    .eq("entity_id", entityId)
  
  if (!cards || cards.length === 0) return 0
  
  // Para cada transação importada, tentar fazer baixa de parcelas
  for (const transaction of transactions) {
    const txAmount = Math.abs(Number(transaction.amount))
    const txDate = new Date(transaction.date)
    
    // Buscar parcelas pendentes (scheduled) que podem ser pagas por esta transação
    // Critérios:
    // 1. Parcela está scheduled (não paga)
    // 2. Valor da parcela corresponde ao valor da transação (tolerância de 1 centavo)
    // 3. Data da transação é próxima ou após a data de vencimento da parcela
    // 4. Parcela pertence a um dos cartões da entidade
    
    for (const card of cards) {
      const { data: installments } = await supabase
        .from("card_installments")
        .select("id, amount, competence_month, due_date, status, posted_transaction_id")
        .eq("workspace_id", workspace.id)
        .eq("entity_id", entityId)
        .eq("card_id", card.id)
        .eq("status", "scheduled")
        .is("posted_transaction_id", null)
        .order("due_date", { ascending: true })
      
      if (!installments || installments.length === 0) continue
      
      // Tentar fazer match com parcelas
      for (const installment of installments) {
        const installmentAmount = Math.abs(Number(installment.amount))
        const amountMatch = Math.abs(installmentAmount - txAmount) <= 0.01 // 1 centavo de tolerância
        
        if (!amountMatch) continue
        
        // Verificar se a data da transação é próxima ou após o vencimento
        // Permitir pagamento até 30 dias após o vencimento
        const dueDate = installment.due_date ? new Date(installment.due_date) : null
        if (dueDate) {
          const daysDiff = (txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          if (daysDiff < -5 || daysDiff > 30) continue // Muito antes ou muito depois
        }
        
        // Fazer baixa da parcela
        const { error: updateError } = await supabase
          .from("card_installments")
          .update({
            status: "posted",
            posted_transaction_id: transaction.id,
          })
          .eq("id", installment.id)
        
        if (!updateError) {
          settledCount++
          break // Uma transação só pode pagar uma parcela
        }
      }
    }
  }
  
  return settledCount
}

/**
 * Concilia automaticamente transações importadas com schedules/commitments
 */
async function autoReconcileImportedTransactions(
  entityId: string,
  transactions: Array<{ id: string; date: string; amount: number; description: string }>
): Promise<number> {
  const { autoMatchSchedules, linkTransactionToSchedule } = await import('@/lib/realization')
  
  let reconciledCount = 0
  
  // Preparar transações no formato esperado
  const transactionsForMatch = transactions.map(tx => ({
    id: tx.id,
    amount: Number(tx.amount),
    date: tx.date,
    entity_id: entityId,
  }))
  
  // Buscar matches automáticos
  const candidates = await autoMatchSchedules(transactionsForMatch, {
    dateToleranceDays: 7,
    amountToleranceCents: 1,
    onlyUnlinked: true,
  })
  
  // Filtrar apenas matches de alta confiança (>= 80%)
  const highConfidenceMatches = candidates.filter(c => c.confidence >= 80)
  
  // Fazer conciliação automática apenas para matches de alta confiança
  for (const match of highConfidenceMatches) {
    try {
      await linkTransactionToSchedule(match.scheduleId, match.transactionId)
      reconciledCount++
    } catch (linkError) {
      console.error(`[import] Erro ao conciliar schedule ${match.scheduleId} com transaction ${match.transactionId}:`, linkError)
      // Continuar com os próximos matches mesmo se um falhar
    }
  }
  
  return reconciledCount
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
      // Preparar transação
      const amount = row.type === 'expense' ? -Math.abs(row.amount) : Math.abs(row.amount)
      
      // Gerar external_id (inclui accountId e source para diferenciar)
      const source = options.source || 'csv'
      const externalId = generateExternalId(row, options.entityId, accountId || null, source)
      
      // Verificar duplicata se solicitado
      if (options.skipDuplicates) {
        const duplicateCheck = await transactionExists(
          options.entityId,
          externalId,
          row.date,
          amount,
          row.description,
          accountId || null
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
      
      transactionsToInsert.push({
        workspace_id: workspace.id,
        entity_id: options.entityId,
        account_id: accountId || null,
        type: row.type,
        amount,
        currency: 'BRL',
        date: row.date,
        description: row.description,
        source: options.source || 'csv',
        external_id: externalId,
      })
    }
    
    // Inserir transações em lote
    let insertedTransactions: Array<{ id: string; date: string; amount: number; description: string }> = []
    
    if (transactionsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("transactions")
        .insert(transactionsToInsert)
        .select("id, date, amount, description")
      
      if (insertError) {
        result.errors.push({
          row: 0,
          message: `Erro ao inserir transações: ${insertError.message}`,
        })
        result.skipped.errors += transactionsToInsert.length
      } else {
        insertedTransactions = inserted || []
        result.imported.transactions = insertedTransactions.length
      }
    }
    
    // ATUALIZAÇÃO AUTOMÁTICA: Fazer baixa de parcelas de cartão quando detectar pagamentos
    if (insertedTransactions.length > 0 && accountId) {
      try {
        const installmentsSettled = await settleCardInstallmentsFromTransactions(
          options.entityId,
          accountId,
          insertedTransactions
        )
        
        if (installmentsSettled > 0) {
          result.warnings.push({
            message: `${installmentsSettled} parcela(s) de cartão foram baixadas automaticamente`,
          })
        }
      } catch (settleError) {
        console.error('[import] Erro ao fazer baixa de parcelas:', settleError)
        result.warnings.push({
          message: 'Erro ao fazer baixa automática de parcelas. Verifique manualmente.',
        })
      }
    }
    
    // Se autoReconcile, tentar conciliar automaticamente com schedules/commitments
    if (options.autoReconcile && insertedTransactions.length > 0) {
      try {
        const reconciledCount = await autoReconcileImportedTransactions(
          options.entityId,
          insertedTransactions
        )
        
        if (reconciledCount > 0) {
          result.warnings.push({
            message: `${reconciledCount} transação(ões) foram conciliadas automaticamente com schedules/commitments`,
          })
        }
      } catch (reconcileError) {
        console.error('[import] Erro ao conciliar automaticamente:', reconcileError)
        result.warnings.push({
          message: 'Erro ao conciliar automaticamente. Use a página de reconciliação para conciliar manualmente.',
        })
      }
    }
    
    result.success = result.imported.transactions > 0
    
  } catch (error) {
    console.error('[import] Erro não tratado ao importar:', error)
    console.error('[import] Stack:', error instanceof Error ? error.stack : 'N/A')
    result.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : 'Erro desconhecido ao importar',
    })
    result.skipped.errors++
  }
  
  return result
}

