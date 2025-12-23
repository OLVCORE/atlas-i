/**
 * MC13: Tipos e interfaces para sistema de scraping bancário
 */

export type BankCode = 'itau' | 'santander' | 'btg' | 'mercadopago'

export type BankConfig = {
  code: BankCode
  name: string
  supports: {
    pf: boolean // Pessoa Física
    pj: boolean // Pessoa Jurídica
    checking: boolean // Conta corrente
    creditCard: boolean // Cartão de crédito
    investment: boolean // Investimentos
  }
  loginUrl: string
  requires2FA?: boolean
}

export type ScraperCredentials = {
  username: string // CPF/CNPJ ou email
  password: string // Senha (criptografada)
  twoFactorSecret?: string // Para 2FA (criptografado)
  entityId: string // Entidade vinculada
  accountId?: string // Conta vinculada (opcional)
}

export type ScraperConnection = {
  id: string
  workspace_id: string
  bank_code: BankCode
  entity_id: string
  account_id?: string
  credentials_encrypted: string // JSON criptografado
  is_active: boolean
  last_sync_at?: string
  last_sync_status?: 'success' | 'error' | 'pending'
  last_sync_error?: string
  schedule_frequency?: 'daily' | 'weekly' | 'monthly'
  schedule_time?: string // HH:mm
  created_at: string
  updated_at: string
}

export type ScrapingResult = {
  success: boolean
  transactions: Array<{
    date: string // ISO date
    description: string
    amount: number
    type: 'income' | 'expense'
    accountName?: string
    raw: Record<string, any>
  }>
  errors: Array<{
    message: string
    details?: any
  }>
  metadata: {
    bank: BankCode
    accountType: 'checking' | 'creditCard' | 'investment'
    period: {
      start: string
      end: string
    }
    totalRows: number
  }
}

export type ScraperSyncResult = {
  success: boolean
  connectionId: string
  scrapingResult: ScrapingResult
  importResult?: {
    transactionsImported: number
    transactionsSkipped: number
    reconciliations: number
    errors: number
  }
  duration: number // ms
  timestamp: string
}

