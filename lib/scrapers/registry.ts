/**
 * MC13: Registro de scrapers disponíveis
 */

import type { BankCode, BankConfig } from './types'

export const AVAILABLE_BANKS: Record<BankCode, BankConfig> = {
  itau: {
    code: 'itau',
    name: 'Itaú',
    supports: {
      pf: true,
      pj: true,
      checking: true,
      creditCard: true,
      investment: true,
    },
    loginUrl: 'https://www.itau.com.br/',
    requires2FA: true,
  },
  santander: {
    code: 'santander',
    name: 'Santander',
    supports: {
      pf: true,
      pj: true,
      checking: true,
      creditCard: true,
      investment: false,
    },
    loginUrl: 'https://www.santander.com.br/',
    requires2FA: true,
  },
  btg: {
    code: 'btg',
    name: 'BTG Pactual',
    supports: {
      pf: true,
      pj: true,
      checking: true,
      creditCard: false,
      investment: true,
    },
    loginUrl: 'https://www.btgpactual.com/',
    requires2FA: true,
  },
  mercadopago: {
    code: 'mercadopago',
    name: 'Mercado Pago',
    supports: {
      pf: true,
      pj: true,
      checking: true,
      creditCard: true,
      investment: false,
    },
    loginUrl: 'https://www.mercadopago.com.br/',
    requires2FA: false,
  },
}

export function getBankConfig(code: BankCode): BankConfig {
  return AVAILABLE_BANKS[code]
}

export function listAvailableBanks(): BankConfig[] {
  return Object.values(AVAILABLE_BANKS)
}

