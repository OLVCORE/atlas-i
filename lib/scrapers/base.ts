/**
 * MC13: Classe base para scrapers bancários
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import type { BankCode, ScrapingResult, ScraperCredentials } from './types'

export abstract class BaseScraper {
  protected browser: Browser | null = null
  protected page: Page | null = null

  constructor(
    protected bankCode: BankCode,
    protected credentials: ScraperCredentials
  ) {}

  /**
   * Inicializa o navegador
   */
  protected async initBrowser(): Promise<void> {
    if (this.browser) {
      return
    }

    // Usar Browserless.io se configurado, senão usar local
    const browserlessUrl = process.env.BROWSERLESS_URL
    const browserWSEndpoint = browserlessUrl
      ? `${browserlessUrl}?token=${process.env.BROWSERLESS_TOKEN || ''}`
      : undefined

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
      ...(browserWSEndpoint && {
        browserWSEndpoint,
      }),
    })

    this.page = await this.browser.newPage()
    
    // Configurar user agent para parecer um navegador real
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Timeout padrão
    this.page.setDefaultTimeout(30000)
  }

  /**
   * Fecha o navegador
   */
  protected async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }

  /**
   * Faz login no banco (implementado por cada scraper)
   */
  protected abstract login(): Promise<void>

  /**
   * Navega até a página de extratos/faturas
   */
  protected abstract navigateToStatements(): Promise<void>

  /**
   * Extrai transações da página atual
   */
  protected abstract extractTransactions(): Promise<ScrapingResult['transactions']>

  /**
   * Método principal: executa scraping completo
   */
  async scrape(options?: {
    accountType?: 'checking' | 'creditCard' | 'investment'
    startDate?: Date
    endDate?: Date
  }): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      transactions: [],
      errors: [],
      metadata: {
        bank: this.bankCode,
        accountType: options?.accountType || 'checking',
        period: {
          start: options?.startDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: options?.endDate?.toISOString() || new Date().toISOString(),
        },
        totalRows: 0,
      },
    }

    try {
      await this.initBrowser()

      // Login
      try {
        await this.login()
      } catch (error) {
        result.errors.push({
          message: 'Erro ao fazer login',
          details: error instanceof Error ? error.message : String(error),
        })
        return result
      }

      // Navegar até extratos
      try {
        await this.navigateToStatements()
      } catch (error) {
        result.errors.push({
          message: 'Erro ao navegar até extratos',
          details: error instanceof Error ? error.message : String(error),
        })
        return result
      }

      // Extrair transações
      try {
        result.transactions = await this.extractTransactions()
        result.metadata.totalRows = result.transactions.length
      } catch (error) {
        result.errors.push({
          message: 'Erro ao extrair transações',
          details: error instanceof Error ? error.message : String(error),
        })
        return result
      }

      result.success = true
    } catch (error) {
      result.errors.push({
        message: 'Erro geral no scraping',
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      await this.closeBrowser()
    }

    return result
  }

  /**
   * Aguarda elemento aparecer na página
   */
  protected async waitForSelector(
    selector: string,
    timeout = 10000
  ): Promise<void> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }
    await this.page.waitForSelector(selector, { timeout })
  }

  /**
   * Aguarda navegação
   */
  protected async waitForNavigation(timeout = 30000): Promise<void> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }
    await this.page.waitForNavigation({ timeout, waitUntil: 'networkidle2' })
  }
}

