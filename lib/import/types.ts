/**
 * Tipos normalizados para importação de extratos bancários
 * 
 * Este módulo define uma estrutura de dados comum que funciona
 * para qualquer banco, independente do formato do extrato original.
 */

/**
 * Tipo de extrato
 */
export type ExtractType = 'checking' | 'credit_card' | 'investment'

/**
 * Tipo de transação normalizada
 */
export type NormalizedTransactionType = 'income' | 'expense' | 'transfer' | 'fee' | 'interest' | 'adjustment'

/**
 * Transação normalizada (formato universal)
 */
export type NormalizedTransaction = {
  // Identificação
  date: string // ISO date (YYYY-MM-DD)
  description: string // Descrição normalizada
  originalDescription?: string // Descrição original do extrato
  
  // Valores
  amount: number // Valor em BRL (positivo = entrada, negativo = saída)
  currency: string // Moeda original (BRL, USD, EUR, etc)
  originalAmount?: number // Valor na moeda original
  exchangeRate?: number // Cotação usada para conversão
  
  // Classificação
  type: NormalizedTransactionType // Tipo normalizado
  
  // Metadados opcionais
  counterparty?: {
    name?: string // Nome da contraparte (razão social, etc)
    document?: string // CPF/CNPJ
    account?: string // Número da conta (para transferências)
  }
  category?: string // Categoria sugerida
  tags?: string[] // Tags para agrupamento
  
  // Para rastreamento
  originalRow?: number // Linha original no CSV
  originalData?: Record<string, any> // Dados originais completos
}

/**
 * Saldo normalizado
 */
export type NormalizedBalance = {
  date: string // ISO date
  balance: number // Saldo em BRL
  availableBalance?: number // Saldo disponível (se diferente)
  currency: string // Moeda (geralmente BRL)
}

/**
 * Cabeçalho de extrato normalizado
 */
export type NormalizedExtractHeader = {
  accountNumber?: string
  accountName?: string
  branch?: string
  bank?: string
  periodStart?: string // ISO date
  periodEnd?: string // ISO date
  lastUpdate?: string // ISO timestamp
}

/**
 * Extrato normalizado completo
 */
export type NormalizedExtract = {
  type: ExtractType
  header: NormalizedExtractHeader
  transactions: NormalizedTransaction[]
  balances: NormalizedBalance[]
  metadata: {
    sourceFormat: string // Formato original (ex: 'itau_csv', 'santander_xlsx')
    parserVersion: string // Versão do parser usado
    importedAt: string // ISO timestamp
    totalTransactions: number
    totalAmount: number // Soma de todas as transações
    finalBalance?: number // Último saldo do extrato
  }
}

/**
 * Resultado do parsing
 */
export type ParseResult = {
  success: boolean
  extract?: NormalizedExtract
  errors: ParseError[]
  warnings: ParseWarning[]
}

/**
 * Erro de parsing
 */
export type ParseError = {
  row: number
  field?: string
  message: string
  severity: 'error' | 'warning'
}

/**
 * Aviso de parsing
 */
export type ParseWarning = {
  row: number
  message: string
  suggestion?: string
}

/**
 * Interface para parsers de extrato
 * 
 * Cada banco/formato implementa esta interface,
 * convertendo seu formato específico para o formato normalizado
 */
export interface ExtractParser {
  /**
   * Nome do parser (ex: 'itau_checking_csv', 'santander_credit_card_xlsx')
   */
  name: string
  
  /**
   * Formato suportado (ex: 'itau_csv', 'santander_xlsx')
   */
  supportedFormat: string
  
  /**
   * Tipo de extrato que este parser processa
   */
  extractType: ExtractType
  
  /**
   * Detectar se este parser pode processar os dados fornecidos
   * 
   * @param data Dados brutos (CSV string, array de linhas, etc)
   * @returns true se este parser pode processar os dados
   */
  canParse(data: string | string[]): boolean
  
  /**
   * Parsear dados brutos para formato normalizado
   * 
   * @param data Dados brutos
   * @returns Resultado do parsing com extrato normalizado
   */
  parse(data: string | string[]): Promise<ParseResult>
  
  /**
   * Validar formato antes de parsear
   * 
   * @param data Dados brutos
   * @returns Lista de erros de validação (vazio se válido)
   */
  validate(data: string | string[]): ParseError[]
}

/**
 * Configuração de importação
 */
export type ImportConfig = {
  accountId: string // ID da conta/cartão de destino
  entityId: string // ID da entidade
  updateBalance: boolean // Atualizar saldo da conta
  createTransactions: boolean // Criar transações
  ignoreDuplicates: boolean // Ignorar duplicatas
  duplicateToleranceDays: number // Tolerância para duplicatas (padrão: 2)
  duplicateToleranceAmount: number // Tolerância de valor (padrão: 0.01)
}

/**
 * Resultado da detecção de duplicatas
 */
export type DuplicateDetectionResult = {
  transaction: NormalizedTransaction
  isDuplicate: boolean
  duplicateIds?: string[] // IDs de transações duplicadas encontradas
  confidence: number // 0-1, confiança na detecção
  reason?: string // Razão da detecção
}

/**
 * Preview de importação
 */
export type ImportPreview = {
  totalTransactions: number
  newTransactions: number
  duplicateTransactions: number
  errors: number
  transactions: DuplicateDetectionResult[]
  estimatedFinalBalance?: number
  balanceDifference?: number // Diferença entre saldo atual e saldo do extrato
}
