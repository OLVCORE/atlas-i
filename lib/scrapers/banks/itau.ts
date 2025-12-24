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

    console.log('[ItauScraper] Iniciando login...')
    console.log('[ItauScraper] Credenciais:', {
      hasCpf: !!this.credentials.cpf,
      hasCnpj: !!this.credentials.cnpj,
      hasAgency: !!this.credentials.agency,
      hasAccountNumber: !!this.credentials.accountNumber,
      hasAccountDigit: !!this.credentials.accountDigit,
    })

    // Navegar para página de login do Itaú
    // O Itaú pode ter diferentes URLs de login, vamos tentar a principal
    const loginUrl = 'https://www.itau.com.br/conta-corrente/acesse-sua-conta/'
    console.log('[ItauScraper] Navegando para:', loginUrl)
    
    try {
      await this.page.goto(loginUrl, {
        waitUntil: 'domcontentloaded', // Mais rápido que networkidle2
        timeout: 30000,
      })
      
      // Aguardar um pouco para JavaScript carregar
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      console.log('[ItauScraper] Página carregada. URL atual:', this.page.url())
      console.log('[ItauScraper] Título da página:', await this.page.title())
    } catch (error) {
      console.error('[ItauScraper] Erro ao navegar:', error)
      throw new Error(`Falha ao carregar página de login: ${error instanceof Error ? error.message : String(error)}`)
    }

      // Capturar screenshot para debug (base64 para logs)
      try {
        const screenshot = await this.page.screenshot({ encoding: 'base64', fullPage: false })
        console.log('[ItauScraper] Screenshot capturado (base64, primeiros 100 chars):', screenshot.substring(0, 100))
      } catch (e) {
        console.log('[ItauScraper] Não foi possível capturar screenshot:', e)
      }
      
      // Obter HTML da página para debug
      try {
        const pageContent = await this.page.content()
        console.log('[ItauScraper] Tamanho do HTML:', pageContent.length, 'caracteres')
        // Procurar por palavras-chave no HTML
        const hasCpf = pageContent.toLowerCase().includes('cpf')
        const hasAgencia = pageContent.toLowerCase().includes('agência') || pageContent.toLowerCase().includes('agencia')
        const hasConta = pageContent.toLowerCase().includes('conta')
        console.log('[ItauScraper] Palavras-chave no HTML:', { hasCpf, hasAgencia, hasConta })
      } catch (e) {
        console.log('[ItauScraper] Não foi possível obter HTML:', e)
      }

    // Aguardar campo de login aparecer
    try {
      // Seletores mais amplos para encontrar campos de login
      const possibleSelectors = [
        'input[name="agencia"]',
        'input[name="conta"]',
        'input[id*="agencia"]',
        'input[id*="conta"]',
        'input[placeholder*="CPF"]',
        'input[placeholder*="CNPJ"]',
        'input[placeholder*="cpf"]',
        'input[placeholder*="cnpj"]',
        'input[type="text"]',
        '#agencia',
        '#conta',
        '#cpf',
        '#cnpj',
      ]
      
      console.log('[ItauScraper] Procurando campos de login...')
      
      // Tentar encontrar qualquer campo de input
      let foundSelector = null
      for (const selector of possibleSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 })
          foundSelector = selector
          console.log('[ItauScraper] Campo encontrado:', selector)
          break
        } catch (e) {
          // Continuar tentando
        }
      }
      
      if (!foundSelector) {
        // Se não encontrou, listar todos os inputs da página para debug
        const allInputs = await this.page.$$eval('input', (inputs) => {
          return inputs.map((input: any) => ({
            name: input.name || '',
            id: input.id || '',
            type: input.type || '',
            placeholder: input.placeholder || '',
            className: input.className || '',
          }))
        })
        console.log('[ItauScraper] Inputs encontrados na página:', JSON.stringify(allInputs, null, 2))
        throw new Error('Nenhum campo de login encontrado na página. Verifique se a URL está correta.')
      }

      // Preencher credenciais (usar novos campos)
      const { cpf, cnpj, agency, accountNumber, accountDigit, password } = this.credentials

      console.log('[ItauScraper] Preenchendo credenciais...')

      // Login PJ: CNPJ
      if (cnpj) {
        console.log('[ItauScraper] Modo: PJ (CNPJ)')
        const cnpjSelectors = [
          'input[name="cnpj"]',
          'input[id="cnpj"]',
          'input[id*="cnpj"]',
          'input[placeholder*="CNPJ"]',
          'input[placeholder*="cnpj"]',
          '#cnpj',
        ]
        
        let cnpjInput = null
        for (const selector of cnpjSelectors) {
          cnpjInput = await this.page.$(selector)
          if (cnpjInput) {
            console.log('[ItauScraper] Campo CNPJ encontrado:', selector)
            break
          }
        }
        
        if (cnpjInput) {
          await cnpjInput.type(cnpj.replace(/\D/g, ''), { delay: 100 })
          console.log('[ItauScraper] CNPJ preenchido')
        } else {
          throw new Error('Campo CNPJ não encontrado na página de login')
        }
      } 
      // Login PF: CPF + Agência + Conta + Dígito
      else if (cpf && agency && accountNumber && accountDigit) {
        console.log('[ItauScraper] Modo: PF (CPF + Agência + Conta)')
        
        // Preencher CPF primeiro
        const cpfSelectors = [
          'input[name="cpf"]',
          'input[id="cpf"]',
          'input[id*="cpf"]',
          'input[placeholder*="CPF"]',
          'input[placeholder*="cpf"]',
          '#cpf',
        ]
        
        let cpfInput = null
        for (const selector of cpfSelectors) {
          cpfInput = await this.page.$(selector)
          if (cpfInput) {
            console.log('[ItauScraper] Campo CPF encontrado:', selector)
            break
          }
        }
        
        if (cpfInput) {
          await cpfInput.type(cpf.replace(/\D/g, ''), { delay: 100 })
          console.log('[ItauScraper] CPF preenchido:', cpf.replace(/\D/g, ''))
          
          // Clicar em "Continuar" ou aguardar próxima etapa
          const continueButton = await this.page.$('button[type="submit"], button:has-text("Continuar"), a:has-text("Continuar")')
          if (continueButton) {
            console.log('[ItauScraper] Clicando em Continuar...')
            await continueButton.click()
            await this.waitForNavigation()
          } else {
            // Aguardar campos aparecerem
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        } else {
          throw new Error('Campo CPF não encontrado na página de login')
        }

        // Preencher Agência
        const agenciaSelectors = [
          'input[name="agencia"]',
          'input[id="agencia"]',
          'input[id*="agencia"]',
          'input[placeholder*="agência"]',
          'input[placeholder*="Agencia"]',
          '#agencia',
        ]
        
        let agenciaInput = null
        for (const selector of agenciaSelectors) {
          agenciaInput = await this.page.$(selector)
          if (agenciaInput) {
            console.log('[ItauScraper] Campo Agência encontrado:', selector)
            break
          }
        }
        
        if (agenciaInput) {
          await agenciaInput.type(agency.replace(/\D/g, ''), { delay: 100 })
          console.log('[ItauScraper] Agência preenchida:', agency.replace(/\D/g, ''))
        } else {
          throw new Error('Campo Agência não encontrado na página de login')
        }

        // Preencher Conta (número + dígito)
        const contaSelectors = [
          'input[name="conta"]',
          'input[id="conta"]',
          'input[id*="conta"]',
          'input[placeholder*="conta"]',
          'input[placeholder*="Conta"]',
          '#conta',
        ]
        
        let contaInput = null
        for (const selector of contaSelectors) {
          contaInput = await this.page.$(selector)
          if (contaInput) {
            console.log('[ItauScraper] Campo Conta encontrado:', selector)
            break
          }
        }
        
        if (contaInput) {
          const contaCompleta = `${accountNumber.replace(/\D/g, '')}-${accountDigit.replace(/\D/g, '')}`
          await contaInput.type(contaCompleta, { delay: 100 })
          console.log('[ItauScraper] Conta preenchida:', contaCompleta)
        } else {
          throw new Error('Campo Conta não encontrado na página de login')
        }
      } 
      // Fallback: tentar usar username (compatibilidade)
      else if (this.credentials.username) {
        const username = this.credentials.username
        const isCNPJ = username.replace(/\D/g, '').length === 14
        
        if (isCNPJ) {
          const cnpjInput = await this.page.$('input[name="cnpj"], input[placeholder*="CNPJ"]')
          if (cnpjInput) {
            await cnpjInput.type(username.replace(/\D/g, ''), { delay: 100 })
          }
        } else {
          const cpfInput = await this.page.$('input[name="cpf"], input[placeholder*="CPF"]')
          if (cpfInput) {
            await cpfInput.type(username.replace(/\D/g, ''), { delay: 100 })
          }
        }
      } else {
        throw new Error('Credenciais incompletas: é necessário CPF+Agência+Conta+Dígito (PF) ou CNPJ (PJ)')
      }

      // Preencher senha
      console.log('[ItauScraper] Procurando campo de senha...')
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="senha"]',
        'input[id*="senha"]',
        'input[id*="password"]',
        '#senha',
        '#password',
      ]
      
      let passwordInput = null
      for (const selector of passwordSelectors) {
        passwordInput = await this.page.$(selector)
        if (passwordInput) {
          console.log('[ItauScraper] Campo senha encontrado:', selector)
          break
        }
      }
      
      if (passwordInput) {
        await passwordInput.type(password, { delay: 100 })
        console.log('[ItauScraper] Senha preenchida')
      } else {
        throw new Error('Campo senha não encontrado na página de login')
      }

      // Clicar em entrar
      console.log('[ItauScraper] Procurando botão de login...')
      const loginButtonSelectors = [
        'button[type="submit"]',
        'button:has-text("Entrar")',
        'button:has-text("Acessar")',
        'a:has-text("Entrar")',
        'a:has-text("Acessar")',
        'button.btn-entrar',
        'button.btn-acessar',
      ]
      
      let loginButton = null
      for (const selector of loginButtonSelectors) {
        try {
          loginButton = await this.page.$(selector)
          if (loginButton) {
            console.log('[ItauScraper] Botão de login encontrado:', selector)
            break
          }
        } catch (e) {
          // Continuar tentando
        }
      }
      
      if (loginButton) {
        console.log('[ItauScraper] Clicando em Entrar...')
        await loginButton.click()
        await this.waitForNavigation()
        console.log('[ItauScraper] Navegação após login. URL atual:', this.page.url())
      } else {
        console.log('[ItauScraper] Botão de login não encontrado, tentando pressionar Enter...')
        await this.page.keyboard.press('Enter')
        await new Promise(resolve => setTimeout(resolve, 2000))
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
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('2FA requerido')) {
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

