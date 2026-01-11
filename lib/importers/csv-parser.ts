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
 * Tenta múltiplas estratégias de matching para ser mais flexível
 */
function findColumnIndex(headers: string[], patterns: string[]): number | null {
  const normalizedHeaders = headers.map(h => normalizeColumnName(h))
  
  for (const pattern of patterns) {
    const normalizedPattern = pattern.toLowerCase().trim()
    
    // Estratégia 1: Match exato
    let index = normalizedHeaders.findIndex(h => h === normalizedPattern)
    if (index !== -1) return index
    
    // Estratégia 2: Header contém o padrão (ex: "data_lancamento" contém "data")
    index = normalizedHeaders.findIndex(h => h.includes(normalizedPattern))
    if (index !== -1) return index
    
    // Estratégia 3: Padrão contém o header (ex: "data" contém "dat")
    index = normalizedHeaders.findIndex(h => normalizedPattern.includes(h))
    if (index !== -1) return index
    
    // Estratégia 4: Match parcial mais flexível (remove espaços, underscores, etc)
    const patternClean = normalizedPattern.replace(/[_\s-]/g, '')
    index = normalizedHeaders.findIndex(h => {
      const headerClean = h.replace(/[_\s-]/g, '')
      return headerClean === patternClean || headerClean.includes(patternClean) || patternClean.includes(headerClean)
    })
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
  try {
    const date = new Date(cleaned)
    // Validar que a data é válida e está em um range razoável (1900-2100)
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear()
      if (year >= 1900 && year <= 2100) {
        const isoDate = date.toISOString().split('T')[0]
        // Validar formato ISO (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
          return isoDate
        }
      }
    }
  } catch (dateError) {
    // Ignorar erros de parsing
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
 * Detecta automaticamente a linha que contém os headers reais
 */
function detectHeaderRow(csvContent: string): number {
  const lines = csvContent.split('\n').slice(0, 20) // Verificar apenas as primeiras 20 linhas
  
  // Palavras-chave que indicam uma linha de header
  const headerKeywords = [
    'data', 'date', 'dat', 'dt',
    'lancamento', 'lançamento', 'lanc', 'histórico', 'historico', 'hist',
    'descrição', 'descricao', 'desc', 'description',
    'valor', 'value', 'debito', 'débito', 'debit', 'credito', 'crédito', 'credit',
    'saldo', 'balance', 'ag', 'agencia', 'agência'
  ]
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase()
    // Contar quantas palavras-chave aparecem nesta linha
    const matches = headerKeywords.filter(keyword => line.includes(keyword)).length
    
    // Se encontrar 2 ou mais palavras-chave, provavelmente é a linha de header
    if (matches >= 2) {
      return i
    }
  }
  
  // Se não encontrou, assume que o header está na primeira linha (índice 0)
  return 0
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
  
  // Detectar linha de header automaticamente
  const headerRowIndex = options?.skipLines !== undefined ? options.skipLines : detectHeaderRow(csvContent)
  
  // Parse CSV - se header não está na primeira linha, precisa fazer parse manual
  let parseResult: Papa.ParseResult<any>
  
  if (headerRowIndex > 0) {
    // Parse sem header primeiro para pegar todas as linhas
    const parseWithoutHeader = Papa.parse(csvContent, {
      header: false,
      skipEmptyLines: false, // Não pular vazias ainda para manter índices
      transform: (value) => (value || '').toString().trim(),
    })
    
    const allRows = parseWithoutHeader.data as string[][]
    
    // Filtrar linhas vazias manualmente
    const nonEmptyRows = allRows.filter(row => row.some(cell => cell && cell.trim().length > 0))
    
    if (nonEmptyRows.length <= headerRowIndex) {
      return {
        rows: [],
        errors: [{ row: 0, message: 'Arquivo não contém dados válidos após detecção de header', raw: {} }],
        metadata: {
          totalRows: nonEmptyRows.length,
          validRows: 0,
          invalidRows: nonEmptyRows.length,
          detectedFormat: 'unknown',
        },
      }
    }
    
    // Encontrar a linha de header real nos dados não vazios
    let actualHeaderRowIndex = 0
    for (let i = 0; i < Math.min(headerRowIndex + 5, nonEmptyRows.length); i++) {
      const rowText = nonEmptyRows[i].join(' ').toLowerCase()
      if (rowText.includes('data') && (rowText.includes('lançamento') || rowText.includes('lancamento') || rowText.includes('valor'))) {
        actualHeaderRowIndex = i
        break
      }
    }
    
    // Usar a linha detectada como header
    const headerRow = nonEmptyRows[actualHeaderRowIndex] || nonEmptyRows[0]
    const dataRows = nonEmptyRows.slice(actualHeaderRowIndex + 1)
    
    // Converter para formato com header
    const dataWithHeaders = dataRows.map(row => {
      const obj: Record<string, string> = {}
      headerRow.forEach((header, index) => {
        const headerKey = header.trim() || `col_${index}`
        obj[headerKey] = (row[index] || '').toString().trim()
      })
      return obj
    })
    
    parseResult = {
      data: dataWithHeaders,
      errors: parseWithoutHeader.errors || [],
      meta: parseWithoutHeader.meta || {},
    } as Papa.ParseResult<any>
  } else {
    // Parse normal com header na primeira linha
    parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
    })
  }
  
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
  
  // Encontrar índices das colunas (padrões expandidos para maior compatibilidade)
  const dateIndex = findColumnIndex(headers, [
    'data', 'date', 'data_lancamento', 'data_lanc', 'dat', 'dt',
    'data movimentacao', 'data movimentação', 'data movimento',
    'data_transacao', 'data_trans', 'data_transaction'
  ])
  const descriptionIndex = findColumnIndex(headers, [
    'descrição', 'descricao', 'desc', 'description', 'descri',
    'historico', 'historico_abreviado', 'hist', 'histórico',
    'estabelecimento', 'estab', 'estabelec',
    'detalhes', 'detalhe', 'obs', 'observacao', 'observação',
    'lançamento', 'lancamento', 'lanc', 'transacao', 'transação'
  ])
  const debitIndex = findColumnIndex(headers, [
    'debito', 'debit', 'deb', 'saida', 'saída', 'said',
    'valor_saida', 'valor_saída', 'valor_said', 'saidas', 'saídas',
    'despesa', 'expense', 'out', 'outflow'
  ])
  const creditIndex = findColumnIndex(headers, [
    'credito', 'credit', 'cred', 'entrada', 'entrad',
    'valor_entrada', 'valor_entrad', 'entradas',
    'receita', 'income', 'in', 'inflow'
  ])
  const amountIndex = findColumnIndex(headers, [
    'valor', 'value', 'amount', 'val', 'vlr',
    'total', 'tot', 'saldo', 'balance',
    'montante', 'mont', 'quantia'
  ])
  const accountIndex = findColumnIndex(headers, [
    'conta', 'account', 'acc', 'conta_corrente', 'conta_corr',
    'numero_conta', 'numero_conta', 'num_conta', 'n_conta'
  ])
  const categoryIndex = findColumnIndex(headers, [
    'categoria', 'category', 'cat', 'tipo', 'type',
    'classificacao', 'classificação', 'classif'
  ])
  
  // Função auxiliar para filtrar headers válidos (remover caracteres não imprimíveis/binários)
  const getValidHeaders = (headers: string[]): string => {
    const validHeaders = headers
      .map(h => h.trim())
      .filter(h => {
        // Remover headers que parecem ser binários ou corrompidos
        if (h.length === 0) return false
        if (h.length > 100) return false // Headers muito longos provavelmente são binários
        // Verificar se tem muitos caracteres não imprimíveis
        const nonPrintable = (h.match(/[^\x20-\x7E]/g) || []).length
        return nonPrintable < h.length * 0.3 // Menos de 30% de caracteres não imprimíveis
      })
      .slice(0, 20) // Limitar a 20 headers para não poluir a mensagem
    
    return validHeaders.length > 0 
      ? validHeaders.join(', ')
      : 'Nenhuma coluna válida detectada (arquivo pode estar corrompido ou em formato não suportado)'
  }
  
  // Validar colunas obrigatórias (com mensagem mais informativa)
  if (dateIndex === null) {
    const headersDisplay = getValidHeaders(headers)
    return {
      rows: [],
      errors: [{
        row: 0,
        message: `Coluna de data não encontrada. Colunas disponíveis: ${headersDisplay}. Procure por: Data, Date, Data Lancamento, Data Movimentação`,
        raw: {}
      }],
      metadata: {
        totalRows: data.length,
        validRows: 0,
        invalidRows: data.length,
        detectedFormat: format,
      },
    }
  }
  
  if (descriptionIndex === null) {
    const headersDisplay = getValidHeaders(headers)
    return {
      rows: [],
      errors: [{
        row: 0,
        message: `Coluna de descrição não encontrada. Colunas disponíveis: ${headersDisplay}. Procure por: Descrição, Histórico, Description, Estabelecimento`,
        raw: {}
      }],
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
      
      // Filtrar linhas que não são transações (saldo, headers, etc)
      const descriptionLower = (descriptionValue || '').toString().toLowerCase().trim()
      
      // Normalizar texto removendo acentos e caracteres especiais para melhor matching
      const normalizeText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ')
      
      const skipPatterns = [
        'saldo anterior',
        'saldo total disponivel',
        'saldo disponivel',
        'lancamentos',
        'lancamento',
      ]
      
      const normalizedDesc = normalizeText(descriptionLower)
      
      // Se a descrição corresponde a um padrão de linha a ser ignorada, pular silenciosamente
      if (skipPatterns.some(pattern => normalizedDesc.includes(normalizeText(pattern)))) {
        continue // Pular sem reportar erro
      }
      
      // Filtrar também linhas que têm valor zerado E descrição contém "saldo" (pode ser linha de saldo)
      if (descriptionLower.includes('saldo') && (!amountValue || amountValue === 0) && (!debitValue || debitValue === 0) && (!creditValue || creditValue === 0)) {
        continue // Pular linhas de saldo sem valor de transação
      }
      
      // Validar campos obrigatórios
      if (!dateValue || !descriptionValue || descriptionValue.trim().length === 0) {
        // Pular linhas vazias sem reportar erro (já foram filtradas acima)
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

