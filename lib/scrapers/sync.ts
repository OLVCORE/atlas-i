/**
 * MC13: Sincronização de scrapers com sistema de importação
 */

import { createScraper } from "./factory"
import { getScraperConnectionById, getDecryptedCredentials, updateLastSyncStatus } from "./connections"
import { importSpreadsheet, ImportOptions } from "@/lib/importers/spreadsheet-importer"
import { createClient } from "@/lib/supabase/server"
import type { ScraperSyncResult, ScrapingResult } from "./types"
import Papa from 'papaparse'

/**
 * Sincroniza conexão de scraper (executa scraping e importa)
 */
export async function syncScraperConnection(
  connectionId: string,
  options?: {
    accountType?: 'checking' | 'creditCard' | 'investment'
    startDate?: Date
    endDate?: Date
  }
): Promise<ScraperSyncResult> {
  const startTime = Date.now()
  
  try {
    // Buscar conexão
    const connection = await getScraperConnectionById(connectionId)
    if (!connection) {
      throw new Error('Conexão não encontrada')
    }

    // Descriptografar credenciais
    const credentials = await getDecryptedCredentials(connectionId)

    // Criar scraper
    const scraper = createScraper(connection.bank_code, credentials)

    // Executar scraping
    const scrapingResult = await scraper.scrape({
      accountType: options?.accountType,
      startDate: options?.startDate,
      endDate: options?.endDate,
    })

    if (!scrapingResult.success || scrapingResult.transactions.length === 0) {
      // Atualizar status de erro
      await updateLastSyncStatus(
        connectionId,
        'error',
        scrapingResult.errors[0]?.message || 'Nenhuma transação encontrada'
      )

      return {
        success: false,
        connectionId,
        scrapingResult,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }
    }

    // Converter transações para CSV (formato compatível com importador)
    const csvContent = convertTransactionsToCSV(scrapingResult.transactions)

    // Preparar opções de importação
    const importOptions: ImportOptions = {
      entityId: connection.entity_id,
      accountId: connection.account_id || undefined,
      skipDuplicates: true,
      autoReconcile: true,
      source: 'scraper', // Identificar origem como scraper
    }

    // Importar usando o importador existente
    const importResult = await importSpreadsheet(csvContent, importOptions)

    // Salvar log de sincronização
    const supabase = await createClient()
    const { data: log } = await supabase
      .from("scraper_sync_logs")
      .insert({
        workspace_id: connection.workspace_id,
        connection_id: connectionId,
        status: importResult.success ? 'success' : 'error',
        transactions_found: scrapingResult.transactions.length,
        transactions_imported: importResult.imported.transactions,
        transactions_skipped: importResult.skipped.duplicates,
        reconciliations: 0, // TODO: Adicionar cardInstallments ao ImportResult quando implementado
        error_message: importResult.errors.length > 0 ? importResult.errors[0].message : null,
        duration_ms: Date.now() - startTime,
        metadata: {
          bank: connection.bank_code,
          accountType: options?.accountType,
          scrapingErrors: scrapingResult.errors,
          importErrors: importResult.errors,
        },
      })
      .select()
      .single()

    // Atualizar status de sucesso
    await updateLastSyncStatus(connectionId, importResult.success ? 'success' : 'error')

    return {
      success: importResult.success,
      connectionId,
      scrapingResult,
      importResult: {
        transactionsImported: importResult.imported.transactions,
        transactionsSkipped: importResult.skipped.duplicates,
        reconciliations: importResult.imported.cardInstallments || 0,
        errors: importResult.errors.length,
      },
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }

  } catch (error) {
    // Atualizar status de erro
    await updateLastSyncStatus(
      connectionId,
      'error',
      error instanceof Error ? error.message : String(error)
    )

    return {
      success: false,
      connectionId,
      scrapingResult: {
        success: false,
        transactions: [],
        errors: [{
          message: error instanceof Error ? error.message : String(error),
        }],
        metadata: {
          bank: 'unknown' as any,
          accountType: 'checking',
          period: {
            start: new Date().toISOString(),
            end: new Date().toISOString(),
          },
          totalRows: 0,
        },
      },
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Converte transações para CSV (compatível com importador)
 */
function convertTransactionsToCSV(
  transactions: ScrapingResult['transactions']
): string {
  // Criar array de objetos para o Papa Parse
  const csvData = transactions.map((tx) => ({
    Data: tx.date,
    Descrição: tx.description,
    Valor: tx.type === 'expense' 
      ? `-${tx.amount.toFixed(2).replace('.', ',')}` 
      : tx.amount.toFixed(2).replace('.', ','),
  }))

  // Converter para CSV
  return Papa.unparse(csvData, {
    header: true,
    delimiter: ',',
  })
}

