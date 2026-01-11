/**
 * Registry de parsers
 * 
 * Centraliza todos os parsers disponíveis e permite
 * detecção automática do parser adequado
 */

import type { ExtractParser, ExtractType } from '../types'
import { BaseParser } from './base'
// import { ItauCheckingParser } from './itau-checking' // Temporariamente desabilitado

/**
 * Registry de parsers
 */
class ParserRegistry {
  private parsers: ExtractParser[] = []
  
  /**
   * Registrar um parser
   */
  register(parser: ExtractParser) {
    this.parsers.push(parser)
  }
  
  /**
   * Encontrar parser adequado para os dados fornecidos
   */
  findParser(data: string | string[], extractType?: ExtractType): ExtractParser | null {
    const candidates = extractType
      ? this.parsers.filter(p => p.extractType === extractType)
      : this.parsers
    
    // Testar cada parser até encontrar um que possa processar
    for (const parser of candidates) {
      try {
        if (parser.canParse(data)) {
          return parser
        }
      } catch (error) {
        // Parser não pode processar, continuar
        continue
      }
    }
    
    return null
  }
  
  /**
   * Listar todos os parsers registrados
   */
  listParsers(): ExtractParser[] {
    return [...this.parsers]
  }
  
  /**
   * Listar parsers por tipo
   */
  listParsersByType(extractType: ExtractType): ExtractParser[] {
    return this.parsers.filter(p => p.extractType === extractType)
  }
}

// Singleton
export const parserRegistry = new ParserRegistry()

/**
 * Registrar todos os parsers disponíveis
 * 
 * IMPORTANTE: Adicione novos parsers aqui
 */
export function registerAllParsers() {
  // Registrar parsers do Itaú
  // parserRegistry.register(new ItauCheckingParser()) // Temporariamente desabilitado - arquivo removido
  
  // Futuros parsers:
  // parserRegistry.register(new ItauCreditCardParser())
  // parserRegistry.register(new SantanderCheckingParser())
  // parserRegistry.register(new BTGCheckingParser())
  // parserRegistry.register(new XPCheckingParser())
  // etc...
}
