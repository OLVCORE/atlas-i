/**
 * Parser base com funcionalidades comuns
 */

import type { ExtractParser, ParseResult, ParseError, NormalizedExtract } from '../types'

export abstract class BaseParser implements ExtractParser {
  abstract name: string
  abstract supportedFormat: string
  abstract extractType: 'checking' | 'credit_card' | 'investment'
  
  abstract canParse(data: string | string[]): boolean
  abstract parse(data: string | string[]): Promise<ParseResult>
  
  /**
   * Validação básica - pode ser sobrescrita
   */
  validate(data: string | string[]): ParseError[] {
    const errors: ParseError[] = []
    const lines = Array.isArray(data) ? data : data.split('\n')
    
    if (lines.length < 2) {
      errors.push({
        row: 0,
        message: 'Arquivo muito pequeno ou vazio',
        severity: 'error'
      })
    }
    
    return errors
  }
  
  /**
   * Normalizar data (suporta múltiplos formatos)
   */
  protected normalizeDate(dateStr: string): string | null {
    if (!dateStr || dateStr.trim() === '') return null
    
    // Remove espaços
    dateStr = dateStr.trim()
    
    // DD/MM/YYYY ou DD/MM/YY
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr)
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    
    const ddmmyy = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(dateStr)
    if (ddmmyy) {
      const [, day, month, year] = ddmmyy
      const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`
      return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    
    // YYYY-MM-DD (já normalizado)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }
    
    return null
  }
  
  /**
   * Normalizar valor (suporta múltiplos formatos)
   */
  protected normalizeAmount(valueStr: string | number): number {
    if (typeof valueStr === 'number') return valueStr
    if (!valueStr) return 0
    
    // Remove espaços, símbolos de moeda, etc
    let cleaned = valueStr.toString().trim()
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '') // Remove separador de milhar
      .replace(',', '.') // Converte vírgula para ponto
    
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  
  /**
   * Normalizar CPF/CNPJ (remove formatação)
   */
  protected normalizeDocument(doc: string): string {
    if (!doc) return ''
    return doc.replace(/[^\d]/g, '')
  }
  
  /**
   * Detectar tipo de transação baseado na descrição e valor
   */
  protected detectTransactionType(
    description: string,
    amount: number
  ): 'income' | 'expense' | 'transfer' | 'fee' | 'interest' | 'adjustment' {
    const desc = description.toUpperCase()
    
    // Rendimentos/juros
    if (
      desc.includes('RENDIMENTO') ||
      desc.includes('REND PAGO') ||
      desc.includes('JUROS') ||
      desc.includes('DIVIDENDO')
    ) {
      return 'interest'
    }
    
    // Taxas
    if (
      desc.includes('TARIFA') ||
      desc.includes('TAXA') ||
      desc.includes('IOF') ||
      desc.includes('SEGURO')
    ) {
      return 'fee'
    }
    
    // Recebimentos
    if (
      desc.includes('RECEBIDO') ||
      desc.includes('CREDITO') ||
      desc.includes('DEPOSITO') ||
      amount > 0
    ) {
      return 'income'
    }
    
    // Pagamentos/saídas
    if (
      desc.includes('PAGO') ||
      desc.includes('ENVIADO') ||
      desc.includes('DEBITO') ||
      desc.includes('SAQUE') ||
      amount < 0
    ) {
      return 'expense'
    }
    
    // Transferências
    if (
      desc.includes('TRANSF') ||
      desc.includes('TRANSFERENCIA') ||
      desc.includes('TED') ||
      desc.includes('DOC')
    ) {
      return 'transfer'
    }
    
    // Default baseado no valor
    return amount >= 0 ? 'income' : 'expense'
  }
  
  /**
   * Criar resultado de sucesso
   */
  protected createSuccessResult(extract: NormalizedExtract): ParseResult {
    return {
      success: true,
      extract,
      errors: [],
      warnings: []
    }
  }
  
  /**
   * Criar resultado de erro
   */
  protected createErrorResult(errors: ParseError[]): ParseResult {
    return {
      success: false,
      errors,
      warnings: []
    }
  }
}
