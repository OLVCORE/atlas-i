/**
 * MC13: Factory para criar instâncias de scrapers
 */

import { ItauScraper } from "./banks/itau"
import { BaseScraper } from "./base"
import type { BankCode, ScraperCredentials } from "./types"

/**
 * Cria instância do scraper apropriado
 */
export function createScraper(
  bankCode: BankCode,
  credentials: ScraperCredentials
): BaseScraper {
  switch (bankCode) {
    case 'itau':
      return new ItauScraper(credentials)
    
    case 'santander':
      // TODO: Implementar SantanderScraper
      throw new Error('Scraper Santander ainda não implementado')
    
    case 'btg':
      // TODO: Implementar BTGScraper
      throw new Error('Scraper BTG ainda não implementado')
    
    case 'mercadopago':
      // TODO: Implementar MercadoPagoScraper
      throw new Error('Scraper Mercado Pago ainda não implementado')
    
    default:
      throw new Error(`Banco não suportado: ${bankCode}`)
  }
}

