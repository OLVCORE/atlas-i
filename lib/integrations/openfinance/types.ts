/**
 * Tipos base para integração Open Finance (ATLAS-i)
 * 
 * NOTA: Estas são definições de contrato. A implementação completa
 * do fluxo de ingestão e conciliação será desenvolvida no MC8.
 */

/**
 * Evento de ingestão de transação via Open Finance
 */
export type OpenFinanceIngestEvent = {
  id: string
  workspace_id: string
  connection_id: string
  external_account_id: string
  external_transaction_id: string
  posted_at: string // ISO date string
  amount: number
  direction: "inflow" | "outflow"
  description_raw: string
  description_norm: string
  balance_after?: number
  category_hint?: string
  raw: Record<string, unknown>
  ingested_at: string // ISO timestamp
}

/**
 * Resultado de conciliação entre transação ingerida e schedule/ledger
 */
export type ReconciliationResult = {
  external_transaction_id: string
  status: "matched" | "unmatched" | "ambiguous" | "anomaly"
  matched_schedule_id?: string
  matched_transaction_id?: string
  confidence: number // 0-1
  evidence?: {
    amount_match: boolean
    date_match: boolean
    description_similarity: number
    entity_hint?: string
  }
  anomaly_signals?: AnomalySignal[]
}

/**
 * Sinal de anomalia detectado durante conciliação
 */
export type AnomalySignal = {
  type:
    | "unexpected_amount"
    | "unexpected_date"
    | "duplicate_transaction"
    | "missing_schedule"
    | "schedule_mismatch"
    | "unknown_merchant"
  severity: "low" | "medium" | "high"
  message: string
  metadata?: Record<string, unknown>
}

/**
 * Resultado agregado de uma execução de conciliação em lote
 */
export type ReconciliationBatchResult = {
  batch_id: string
  workspace_id: string
  started_at: string
  finished_at: string
  total_events: number
  matched_count: number
  unmatched_count: number
  anomaly_count: number
  results: ReconciliationResult[]
}

