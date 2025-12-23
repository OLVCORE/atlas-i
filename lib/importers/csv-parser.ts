/**
 * MC12: Parser de CSV/Excel para importação de extratos bancários
 * 
 * Suporta formatos comuns de extratos:
 * - Conta corrente (BB, Itaú, Bradesco, etc)
 * - Cartão de crédito
 * - Investimentos
 * - Financiamentos
 */

import Papa from 'papaparse'

export type ParsedRow = {
  date: string // ISO date (YYYY-MM-DD)
  description: string
  amount: number // Valor absoluto (sempre positivo)
  type: 'income' | 'expense' // Determina se é entrada ou saída
  accountName?: string // Nome da conta (se houver coluna)
  category?: string // Categoria (opcional)
  raw: Record<string, string> // Dados brutos da linha
  validationErrors?: string[] // Erros de validação (se houver)
}

export type ParseResult = {
  rows: ParsedRow[]
  errors: Array<{ row: number; message: string; raw: Record<string, string> }>
  metadata: {
    totalRows: number
    validRows: number
    invalidRows: number
    detectedFormat: string
  }
}

/**
 * Detecta o formato do CSV baseado nos cabeçalhos
 */
function detectFormat(headers: string[]): string {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim())
  
  // Formato comum: Data, Descrição, Valor, Saldo
  if (
    normalizedHeaders.some(h => h.includes('data')) &&
    normalizedHeaders.some(h => h.includes('descrição') || h.includes('descricao') || h.includes('historico')) &&
    normalizedHeaders.some(h => h.includes('valor') || h.includes('debito') || h.includes('credito'))
  ) {
    return 'standard'
  }
  
  // Formato BB: Data, Histórico, Valor, Saldo
  if (
    normalizedHeaders.some(h => h.includes('data')) &&
    normalizedHeaders.some(h => h.includes('historico')) &&
    normalizedHeaders.some(h => h.includes('valor'))
  ) {
    return 'bb'
  }
  
  // Formato Itaú: Data, Descrição, Débito, Crédito, Saldo
  if (
    normalizedHeaders.some(h => h.includes('data')) &&
    normalizedHeaders.some(h => h.includes('descrição') || h.includes('descricao')) &&
    (normalizedHeaders.some(h => h.includes('debito')) || normalizedHeaders.some(h => h.includes('credito')))
  ) {
    return 'itau'
  }
  
  // Formato cartão: Data, Descrição, Valor, Parcela
  if (
    normalizedHeaders.some(h => h.includes('data')) &&
    normalizedHeaders.some(h => h.includes('descrição') || h.includes('descricao') || h.includes('estabelecimento')) &&
    normalizedHeaders.some(h => h.includes('valor') || h.includes('total'))
  ) {
    return 'card'
  }
  
  return 'auto' // Tentar detectar automaticamente
}

/**
 * Normaliza nome de coluna para facilitar matching
 */
function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Encontra índice de coluna por nome (com variações)
 */
function findColumnIndex(headers: string[], patterns: string[]): number | null {
  for (const pattern of patterns) {
    const index = headers.findIndex(h => 
      normalizeColumnName(h).includes(pattern.toLowerCase())
    )
    if (index !== -1) return index
  }
  return null
}

/**
 * Parse de valor monetário (remove formatação)
 */
function parseAmount(value: string): number {
  if (!value || value.trim() === '') return 0
  
  // Remove tudo exceto números, vírgula e ponto
  const cleaned = value.replace(/[^\d,.-]/g, '')
  
  // Detecta formato brasileiro (1.234,56) ou americano (1,234.56)
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  
  let normalized = cleaned
  
  if (hasComma && hasDot) {
    // Se tem ambos, o último separador é o decimal
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // Formato BR: 1.234,56
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // Formato US: 1,234.56
      normalized = cleaned.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Só vírgula: pode ser decimal BR ou separador de milhar
    if (cleaned.split(',').length === 2 && cleaned.split(',')[1].length <= 2) {
      // Decimal BR: 1234,56
      normalized = cleaned.replace(',', '.')
    } else {
      // Separador de milhar: 1,234
      normalized = cleaned.replace(',', '')
    }
  } else if (hasDot) {
    // Só ponto: pode ser decimal ou separador de milhar
    const parts = cleaned.split('.')
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal: 1234.56
      normalized = cleaned
    } else {
      // Separador de milhar: 1.234
      normalized = cleaned.replace(/\./g, '')
    }
  }
  
  const parsed = parseFloat(normalized)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Parse de data (suporta vários formatos)
 */
function parseDate(value: string): string | null {
  if (!value || value.trim() === '') return null
  
  // Remove espaços
  const cleaned = value.trim()
  
  // Formato ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned
  }
  
  // Formato BR: DD/MM/YYYY ou DD/MM/YY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    const [day, month, year] = cleaned.split('/')
    return `${year}-${month}-${day}`
  }
  
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(cleaned)) {
    const [day, month, year] = cleaned.split('/')
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`
    return `${fullYear}-${month}-${day}`
  }
  
  // Formato US: MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    // Tentar parse como Date e verificar se é válido
    const date = new Date(cleaned)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }
  
  // Tentar parse direto
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0]
  }
  
  return null
}

/**
 * Determina tipo da transação baseado no valor e formato
 */
function determineType(
  format: string,
  debitValue: number | null,
  creditValue: number | null,
  amountValue: number | null
): 'income' | 'expense' {
  // Se tem débito e crédito separados
  if (debitValue !== null && creditValue !== null) {
    if (debitValue > 0) return 'expense'
    if (creditValue > 0) return 'income'
  }
  
  // Se tem apenas valor único, assume que negativo = expense, positivo = income
  if (amountValue !== null) {
    return amountValue < 0 ? 'expense' : 'income'
  }
  
  // Default: expense (mais comum em extratos)
  return 'expense'
}

/**
 * Parse de CSV/Excel
 */
export function parseCSV(csvContent: string, options?: {
  format?: string
  skipLines?: number
}): ParseResult {
  const rows: ParsedRow[] = []
  const errors: Array<{ row: number; message: string; raw: Record<string, string> }> = []
  
  // Parse CSV
  const parseResult = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  })
  
  if (parseResult.errors.length > 0) {
    errors.push(...parseResult.errors.map(err => ({
      row: err.row || 0,
      message: err.message || 'Erro ao parsear linha',
      raw: {},
    })))
  }
  
  const data = parseResult.data as Record<string, string>[]
  if (data.length === 0) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'Arquivo vazio ou sem dados válidos', raw: {} }],
      metadata: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        detectedFormat: 'unknown',
      },
    }
  }
  
  // Detectar formato
  const headers = Object.keys(data[0])
  const format = options?.format || detectFormat(headers)
  
  // Encontrar índices das colunas
  const dateIndex = findColumnIndex(headers, ['data', 'date', 'data_lancamento'])
  const descriptionIndex = findColumnIndex(headers, ['descrição', 'descricao', 'historico', 'historico_abreviado', 'desc', 'description', 'estabelecimento'])
  const debitIndex = findColumnIndex(headers, ['debito', 'debit', 'saida', 'saída', 'valor_saida'])
  const creditIndex = findColumnIndex(headers, ['credito', 'credit', 'entrada', 'valor_entrada'])
  const amountIndex = findColumnIndex(headers, ['valor', 'value', 'amount', 'total', 'saldo'])
  const accountIndex = findColumnIndex(headers, ['conta', 'account', 'conta_corrente'])
  const categoryIndex = findColumnIndex(headers, ['categoria', 'category', 'tipo'])
  
  // Validar colunas obrigatórias
  if (dateIndex === null) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'Coluna de data não encontrada. Procure por: Data, Date', raw: {} }],
      metadata: {
        totalRows: data.length,
        validRows: 0,
        invalidRows: data.length,
        detectedFormat: format,
      },
    }
  }
  
  if (descriptionIndex === null) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'Coluna de descrição não encontrada. Procure por: Descrição, Histórico, Description', raw: {} }],
      metadata: {
        totalRows: data.length,
        validRows: 0,
        invalidRows: data.length,
        detectedFormat: format,
      },
    }
  }
  
  // Processar cada linha
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const rowNumber = i + 1
    
    try {
      // Extrair valores
      const dateValue = row[headers[dateIndex]]
      const descriptionValue = row[headers[descriptionIndex]]
      const debitValue = debitIndex !== null ? parseAmount(row[headers[debitIndex]]) : null
      const creditValue = creditIndex !== null ? parseAmount(row[headers[creditIndex]]) : null
      const amountValue = amountIndex !== null ? parseAmount(row[headers[amountIndex]]) : null
      const accountName = accountIndex !== null ? row[headers[accountIndex]] : undefined
      const category = categoryIndex !== null ? row[headers[categoryIndex]] : undefined
      
      // Validar campos obrigatórios
      if (!dateValue || !descriptionValue) {
        errors.push({
          row: rowNumber,
          message: 'Data ou descrição vazios',
          raw: row,
        })
        continue
      }
      
      // Parse de data
      const date = parseDate(dateValue)
      if (!date) {
        errors.push({
          row: rowNumber,
          message: `Data inválida: ${dateValue}`,
          raw: row,
        })
        continue
      }
      
      // Determinar valor e tipo
      let amount = 0
      let type: 'income' | 'expense' = 'expense'
      
      if (debitValue !== null && creditValue !== null) {
        // Formato com débito e crédito separados
        if (debitValue > 0) {
          amount = Math.abs(debitValue)
          type = 'expense'
        } else if (creditValue > 0) {
          amount = Math.abs(creditValue)
          type = 'income'
        } else {
          errors.push({
            row: rowNumber,
            message: 'Valor de débito e crédito ambos zerados',
            raw: row,
          })
          continue
        }
      } else if (amountValue !== null) {
        // Formato com valor único
        amount = Math.abs(amountValue)
        type = amountValue < 0 ? 'expense' : 'income'
      } else {
        errors.push({
          row: rowNumber,
          message: 'Nenhum valor encontrado (procure por: Valor, Débito, Crédito)',
          raw: row,
        })
        continue
      }
      
      // Validar valor
      if (amount === 0) {
        errors.push({
          row: rowNumber,
          message: 'Valor zerado',
          raw: row,
        })
        continue
      }
      
      // Validações adicionais
      const validationErrors: string[] = []
      
      // Validar valor não negativo
      if (amount < 0) {
        validationErrors.push('Valor negativo detectado (será convertido para positivo)')
      }
      
      // Validar valor muito grande (possível erro de formatação)
      if (amount > 1000000000) { // 1 bilhão
        validationErrors.push('Valor muito grande (possível erro de formatação)')
      }
      
      // Validar data não muito no futuro (mais de 1 ano)
      const dateObj = new Date(date)
      const oneYearFromNow = new Date()
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
      if (dateObj > oneYearFromNow) {
        validationErrors.push('Data muito no futuro (mais de 1 ano)')
      }
      
      // Validar data não muito no passado (mais de 10 anos)
      const tenYearsAgo = new Date()
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10)
      if (dateObj < tenYearsAgo) {
        validationErrors.push('Data muito no passado (mais de 10 anos)')
      }
      
      // Adicionar linha válida (mesmo com warnings de validação)
      rows.push({
        date,
        description: descriptionValue.trim(),
        amount,
        type,
        accountName,
        category,
        raw: row,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      })
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Erro desconhecido ao processar linha',
        raw: row,
      })
    }
  }
  
  return {
    rows,
    errors,
    metadata: {
      totalRows: data.length,
      validRows: rows.length,
      invalidRows: errors.length,
      detectedFormat: format,
    },
  }
}

