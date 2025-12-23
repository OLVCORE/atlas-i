/**
 * MC13: Scraper Itaú (PF e PJ)
 * 
 * Suporta:
 * - Conta corrente
 * - Cartão de crédito
 * - Investimentos
 */

import { BaseScraper } from '../base'
import type { BankCode, ScrapingResult, ScraperCredentials } from '../types'

export class ItauScraper extends BaseScraper {
  constructor(credentials: ScraperCredentials) {
    super('itau', credentials)
  }

  /**
   * Faz login no Itaú
   */
  protected async login(): Promise<void> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    // Navegar para página de login
    await this.page.goto('https://www.itau.com.br/conta-corrente/acesse-sua-conta/', {
      waitUntil: 'networkidle2',
    })

    // Aguardar campo de agência/conta ou CPF/CNPJ
    try {
      // Tentar encontrar campo de login (pode variar)
      const loginSelector = 'input[name="agencia"], input[name="conta"], input[type="text"][placeholder*="CPF"], input[type="text"][placeholder*="CNPJ"]'
      await this.waitForSelector(loginSelector, 10000)

      // Preencher credenciais
      const username = this.credentials.username
      const password = this.credentials.password

      // Detectar se é CPF ou CNPJ (11 ou 14 dígitos)
      const isCNPJ = username.replace(/\D/g, '').length === 14
      
      if (isCNPJ) {
        // Login PJ: CNPJ
        const cnpjInput = await this.page.$('input[name="cnpj"], input[placeholder*="CNPJ"]')
        if (cnpjInput) {
          await cnpjInput.type(username.replace(/\D/g, ''), { delay: 100 })
        }
      } else {
        // Login PF: Agência + Conta ou CPF
        const agenciaInput = await this.page.$('input[name="agencia"]')
        const contaInput = await this.page.$('input[name="conta"]')
        const cpfInput = await this.page.$('input[name="cpf"], input[placeholder*="CPF"]')

        if (agenciaInput && contaInput) {
          // Login com agência/conta
          const parts = username.split('/')
          if (parts.length === 2) {
            await agenciaInput.type(parts[0].trim(), { delay: 100 })
            await contaInput.type(parts[1].trim(), { delay: 100 })
          }
        } else if (cpfInput) {
          // Login com CPF
          await cpfInput.type(username.replace(/\D/g, ''), { delay: 100 })
        }
      }

      // Preencher senha
      const passwordInput = await this.page.$('input[type="password"], input[name="senha"]')
      if (passwordInput) {
        await passwordInput.type(password, { delay: 100 })
      }

      // Clicar em entrar
      const loginButton = await this.page.$('button[type="submit"], button:has-text("Entrar"), a:has-text("Entrar")')
      if (loginButton) {
        await loginButton.click()
        await this.waitForNavigation()
      }

      // Verificar se precisa de 2FA
      if (this.credentials.twoFactorSecret) {
        await this.handle2FA()
      }

      // Aguardar login completar
      await this.page.waitForSelector('body', { timeout: 15000 })
      
      // Verificar se está logado (não está mais na página de login)
      const currentUrl = this.page.url()
      if (currentUrl.includes('login') || currentUrl.includes('acesse-sua-conta')) {
        throw new Error('Falha no login - ainda na página de login')
      }

    } catch (error) {
      throw new Error(`Erro ao fazer login no Itaú: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Lida com autenticação de dois fatores (2FA)
   */
  private async handle2FA(): Promise<void> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    // Aguardar página de 2FA
    try {
      await this.waitForSelector('input[type="text"][placeholder*="token"], input[type="text"][placeholder*="código"], input[name="token"]', 10000)
      
      // Por enquanto, lançar erro pedindo intervenção manual
      // TODO: Implementar geração de token TOTP se necessário
      throw new Error('2FA requerido - implementação de TOTP pendente')
    } catch (error) {
      // Se não encontrar campo de 2FA, pode não ser necessário
      if (!error.message.includes('2FA requerido')) {
        // Continua normalmente
      } else {
        throw error
      }
    }
  }

  /**
   * Navega até a página de extratos/faturas
   */
  protected async navigateToStatements(): Promise<void> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    try {
      // Navegar para extratos
      // O Itaú geralmente tem um menu de navegação
      const extratosLink = await this.page.$('a[href*="extrato"], a:has-text("Extrato"), nav a:has-text("Extratos")')
      
      if (extratosLink) {
        await extratosLink.click()
        await this.waitForNavigation()
      } else {
        // Tentar navegar diretamente
        await this.page.goto('https://www.itau.com.br/conta-corrente/extrato/', {
          waitUntil: 'networkidle2',
        })
      }

      // Aguardar carregamento da página de extratos
      await this.waitForSelector('table, .extrato, [data-testid*="extrato"]', 10000)

    } catch (error) {
      throw new Error(`Erro ao navegar até extratos: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Extrai transações da página atual
   */
  protected async extractTransactions(): Promise<ScrapingResult['transactions']> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    const transactions: ScrapingResult['transactions'] = []

    try {
      // Extrair transações da tabela de extratos
      // O Itaú geralmente tem uma estrutura de tabela
      const rows = await this.page.$$eval('table tbody tr, .extrato-item, [data-testid*="transaction"]', (elements) => {
        return elements.map((row) => {
          const cells = row.querySelectorAll('td, .extrato-coluna')
          const text = row.textContent || ''
          
          // Tentar extrair data, descrição e valor
          // Formato pode variar, então tentamos múltiplas estratégias
          let date = ''
          let description = ''
          let amount = 0
          let type: 'income' | 'expense' = 'expense'

          // Estratégia 1: Tabela estruturada
          if (cells.length >= 3) {
            date = cells[0]?.textContent?.trim() || ''
            description = cells[1]?.textContent?.trim() || ''
            const amountText = cells[2]?.textContent?.trim() || cells[3]?.textContent?.trim() || ''
            
            // Parsear valor (remover R$, pontos, vírgulas)
            const amountMatch = amountText.match(/([\d.,]+)/)
            if (amountMatch) {
              amount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'))
              
              // Determinar tipo (se tem sinal negativo ou positivo)
              if (amountText.includes('-') || amountText.includes('D')) {
                type = 'expense'
                amount = Math.abs(amount)
              } else {
                type = 'income'
              }
            }
          } else {
            // Estratégia 2: Texto livre (regex)
            const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/)
            if (dateMatch) {
              date = dateMatch[1]
            }

            const amountMatch = text.match(/R\$\s*([\d.,]+)/)
            if (amountMatch) {
              amount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'))
              type = text.includes('-') ? 'expense' : 'income'
              amount = Math.abs(amount)
            }

            // Descrição é o resto do texto
            description = text.replace(/\d{2}\/\d{2}\/\d{4}/g, '').replace(/R\$\s*[\d.,]+/g, '').trim()
          }

          return {
            date,
            description,
            amount,
            type,
            raw: { text, cellsCount: cells.length },
          }
        })
      })

      // Processar e normalizar transações
      for (const row of rows) {
        if (!row.date || !row.description || !row.amount) {
          continue // Pular linhas inválidas
        }

        // Converter data para ISO (DD/MM/YYYY -> YYYY-MM-DD)
        const dateParts = row.date.split('/')
        if (dateParts.length === 3) {
          const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
          
          transactions.push({
            date: isoDate,
            description: row.description,
            amount: row.amount,
            type: row.type,
            raw: row.raw,
          })
        }
      }

    } catch (error) {
      throw new Error(`Erro ao extrair transações: ${error instanceof Error ? error.message : String(error)}`)
    }

    return transactions
  }
}

