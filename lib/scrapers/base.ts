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
    const browserlessToken = process.env.BROWSERLESS_TOKEN
    
    // Se Browserless está configurado, usar WebSocket endpoint
    let browserWSEndpoint: string | undefined = undefined
    
    if (browserlessUrl && browserlessToken) {
      // Browserless.io: usar puppeteer.connect() para conectar via WebSocket
      // Formato esperado: wss://chrome.browserless.io ou https://chrome.browserless.io
      // Token é passado como query parameter: ?token=TOKEN
      
      let wsUrl = browserlessUrl.trim()
      
      // Se a URL começa com https://, converter para wss://
      if (wsUrl.startsWith('https://')) {
        wsUrl = wsUrl.replace('https://', 'wss://')
      } 
      // Se começa com http://, converter para ws://
      else if (wsUrl.startsWith('http://')) {
        wsUrl = wsUrl.replace('http://', 'ws://')
      }
      // Se não tem protocolo, adicionar wss://
      else if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
        wsUrl = `wss://${wsUrl}`
      }
      
      // Construir URL completa com token
      const separator = wsUrl.includes('?') ? '&' : '?'
      browserWSEndpoint = `${wsUrl}${separator}token=${browserlessToken}`
      
      console.log('[BaseScraper] Conectando ao Browserless:', browserWSEndpoint.replace(browserlessToken, 'TOKEN_REDACTED'))
      
      // Usar puppeteer.connect() em vez de launch() para Browserless
      try {
        this.browser = await puppeteer.connect({
          browserWSEndpoint,
          defaultViewport: null,
        })
        
        // Criar nova página
        this.page = await this.browser.newPage()
        
        // Configurar user agent para parecer um navegador real
        await this.page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        this.page.setDefaultTimeout(30000)
        
        console.log('[BaseScraper] Conectado ao Browserless com sucesso')
        return // Sair aqui, já conectou
      } catch (error) {
        console.error('[BaseScraper] Erro ao conectar ao Browserless:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Falha ao conectar ao Browserless: ${errorMessage}. Verifique se BROWSERLESS_URL e BROWSERLESS_TOKEN estão corretos.`)
      }
    }

    // Fallback: usar Puppeteer local
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
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
      try {
        // Se conectado via Browserless (não foi criado localmente), desconectar
        const browserlessUrl = process.env.BROWSERLESS_URL
        if (browserlessUrl) {
          // Browserless: usar disconnect() em vez de close()
          await this.browser.disconnect()
        } else {
          // Local: usar close()
          await this.browser.close()
        }
      } catch (error) {
        console.error('[BaseScraper] Erro ao fechar browser:', error)
        // Continuar mesmo se houver erro ao fechar
      } finally {
        this.browser = null
        this.page = null
      }
    }
  }

  /**
   * Faz login no banco (implementado por cada scraper)
   */
  protected abstract login(): Promise<void>

  /**
   * Navega até a página de extratos/faturas e configura período
   */
  protected abstract navigateToStatements(options?: {
    accountType?: 'checking' | 'creditCard' | 'investment'
    startDate?: Date
    endDate?: Date
  }): Promise<void>

  /**
   * Extrai transações da página atual
   */
  protected abstract extractTransactions(): Promise<ScrapingResult['transactions']>

  /**
   * Testa login (sem fazer scraping completo)
   */
  async testLogin(): Promise<boolean> {
    try {
      await this.initBrowser()
      await this.login()
      
      // Se chegou aqui sem erro, login foi bem-sucedido
      // Verificar se realmente está logado (não está mais na página de login)
      if (this.page) {
        const currentUrl = this.page.url()
        // Se ainda está na página de login, falhou
        if (currentUrl.includes('login') || currentUrl.includes('acesse-sua-conta')) {
          return false
        }
      }
      
      return true
    } catch (error) {
      console.error('[testLogin] Erro:', error)
      return false
    } finally {
      await this.closeBrowser()
    }
  }

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

      // Navegar até extratos e configurar período
      try {
        await this.navigateToStatements({
          accountType: options?.accountType,
          startDate: options?.startDate,
          endDate: options?.endDate,
        })
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

