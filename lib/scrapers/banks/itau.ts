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
   * Helper para capturar screenshot e logar (base64 para logs)
   */
  private async _takeScreenshot(filenameSuffix: string): Promise<void> {
    try {
      const screenshot = await this.page!.screenshot({ encoding: 'base64', fullPage: false })
      console.log(`[ItauScraper] Screenshot (${filenameSuffix}) capturado (base64, primeiros 100 chars):`, screenshot.substring(0, 100))
    } catch (e) {
      console.log(`[ItauScraper] Não foi possível capturar screenshot (${filenameSuffix}):`, e)
    }
  }

  /**
   * Estratégia robusta de preenchimento de campos
   * Remove disabled/readonly, limpa, digita, verifica e tem fallback via JS
   */
  private async _fillInputRobustly(
    input: any,
    value: string,
    fieldName: string
  ): Promise<void> {
    try {
      console.log(`[ItauScraper] Preenchendo campo ${fieldName} com estratégia robusta...`)
      
      // Estratégia 1: Remover disabled/readonly via JavaScript
      await this.page!.evaluate((el) => {
        el.removeAttribute('disabled')
        el.removeAttribute('readonly')
        ;(el as HTMLInputElement).disabled = false
        ;(el as HTMLInputElement).readOnly = false
      }, input)

      // Estratégia 2: Focar e limpar
      await input.click({ clickCount: 3 }) // Selecionar tudo
      await this.page!.keyboard.press('Backspace') // Limpar

      // Estratégia 3: Digitar com delay
      await input.type(value, { delay: 100 })

      // Estratégia 4: Verificar se valor foi setado
      const actualValue = await this.page!.evaluate((el: any) => el.value, input)
      if (actualValue !== value) {
        console.warn(`[ItauScraper] Campo ${fieldName} não preenchido corretamente via .type(), tentando via JS.`)
        // Fallback: Set via JavaScript
        await this.page!.evaluate((el: any, val: string) => {
          el.value = val
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
          el.dispatchEvent(new Event('blur', { bubbles: true }))
        }, input, value)
      }

      // Verificação final
      const finalValue = await this.page!.evaluate((el: any) => el.value, input)
      const success = finalValue === value || finalValue.includes(value.replace(/\D/g, ''))
      console.log(`[ItauScraper] Campo ${fieldName} preenchido: ${success ? '✓' : '✗'} (valor final: '${finalValue}', esperado: '${value}')`)

      if (!success) {
        throw new Error(`Erro ao preencher campo ${fieldName}: Valor final '${finalValue}' diferente do esperado '${value}'`)
      }
    } catch (error) {
      console.error(`[ItauScraper] Erro na estratégia robusta de preenchimento para ${fieldName}:`, error)
      throw error
    }
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
          await this._fillInputRobustly(cpfInput, cpf.replace(/\D/g, ''), 'CPF')
          
          // Clicar em "Continuar" ou aguardar próxima etapa
          // Usar XPath para encontrar botão com texto "Continuar" (Puppeteer não suporta :has-text)
          const continueButton = await this.page.evaluateHandle(() => {
            // Procurar por botão ou link com texto "Continuar"
            const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'))
            return buttons.find((el: any) => {
              const text = el.textContent?.toLowerCase() || el.value?.toLowerCase() || ''
              return text.includes('continuar') || text.includes('próximo') || text.includes('avançar')
            }) || null
          })
          
          if (continueButton && continueButton.asElement()) {
            console.log('[ItauScraper] Clicando em Continuar...')
            await (continueButton.asElement() as any).click()
            await this.waitForNavigation()
            // Aguardar campos aparecerem dinamicamente
            await new Promise(resolve => setTimeout(resolve, 3000))
            console.log('[ItauScraper] URL após Continuar:', this.page.url())
          } else {
            // Tentar pressionar Enter ou aguardar campos aparecerem
            console.log('[ItauScraper] Botão Continuar não encontrado, tentando Enter...')
            await this.page.keyboard.press('Enter')
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        } else {
          throw new Error('Campo CPF não encontrado na página de login')
        }

        // Preencher Agência - COM RETRY E LOGS DETALHADOS
        console.log('[ItauScraper] Procurando campo Agência...')
        let agenciaInput = null
        let attempts = 0
        const maxAttempts = 10
        
        while (!agenciaInput && attempts < maxAttempts) {
          attempts++
          console.log(`[ItauScraper] Tentativa ${attempts}/${maxAttempts} de encontrar campo Agência...`)
          
          const agenciaSelectors = [
            'input[name="agencia"]',
            'input[name*="agencia"]',
            'input[id="agencia"]',
            'input[id*="agencia"]',
            'input[placeholder*="agência"]',
            'input[placeholder*="Agencia"]',
            'input[placeholder*="AGÊNCIA"]',
            'input[type="text"][name*="ag"]',
            'input[type="number"][name*="ag"]',
            '#agencia',
            '[data-testid*="agencia"]',
          ]
          
          for (const selector of agenciaSelectors) {
            try {
              agenciaInput = await this.page.$(selector)
              if (agenciaInput) {
                console.log('[ItauScraper] Campo Agência encontrado:', selector)
                break
              }
            } catch (e) {
              // Continuar
            }
          }
          
          if (!agenciaInput) {
            // Log detalhado do que está na página
            const pageInfo = await this.page.evaluate(() => {
              const inputs = Array.from(document.querySelectorAll('input'))
              return {
                url: window.location.href,
                inputCount: inputs.length,
                inputs: inputs.map((inp: any) => ({
                  name: inp.name || '',
                  id: inp.id || '',
                  placeholder: inp.placeholder || '',
                  type: inp.type || '',
                  visible: inp.offsetParent !== null,
                })),
              }
            })
            
            console.log('[ItauScraper] Informações da página (tentativa', attempts, '):', JSON.stringify(pageInfo, null, 2))
            
            // Aguardar mais um pouco
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        if (agenciaInput) {
          await this._fillInputRobustly(agenciaInput, agency.replace(/\D/g, ''), 'Agência')
        } else {
          // Log final detalhado antes de lançar erro
          const finalPageInfo = await this.page.evaluate(() => {
            return {
              url: window.location.href,
              title: document.title,
              allInputs: Array.from(document.querySelectorAll('input')).map((inp: any) => ({
                name: inp.name,
                id: inp.id,
                placeholder: inp.placeholder,
                type: inp.type,
                value: inp.value,
              })),
              bodyText: document.body.innerText.substring(0, 500),
            }
          })
          console.error('[ItauScraper] ERRO: Campo Agência não encontrado. Informações da página:', JSON.stringify(finalPageInfo, null, 2))
          throw new Error('Campo Agência não encontrado na página de login após múltiplas tentativas')
        }

        // Preencher Conta (número + dígito) - COM RETRY
        console.log('[ItauScraper] Procurando campo Conta...')
        let contaInput = null
        let contaAttempts = 0
        const maxContaAttempts = 5
        
        while (!contaInput && contaAttempts < maxContaAttempts) {
          contaAttempts++
          const contaSelectors = [
            'input[name="conta"]',
            'input[name*="conta"]',
            'input[id="conta"]',
            'input[id*="conta"]',
            'input[placeholder*="conta"]',
            'input[placeholder*="Conta"]',
            'input[placeholder*="CONTA"]',
            'input[type="text"][name*="conta"]',
            'input[type="number"][name*="conta"]',
            '#conta',
            '[data-testid*="conta"]',
          ]
          
          for (const selector of contaSelectors) {
            try {
              contaInput = await this.page.$(selector)
              if (contaInput) {
                console.log('[ItauScraper] Campo Conta encontrado:', selector)
                break
              }
            } catch (e) {
              // Continuar
            }
          }
          
          if (!contaInput) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        if (contaInput) {
          // Tentar diferentes formatos: "12345-6" ou "123456"
          const accountFormats = [
            `${accountNumber.replace(/\D/g, '')}-${accountDigit.replace(/\D/g, '')}`,
            `${accountNumber.replace(/\D/g, '')}${accountDigit.replace(/\D/g, '')}`,
            accountNumber.replace(/\D/g, '')
          ]
          let accountFilled = false
          
          for (const format of accountFormats) {
            try {
              await this._fillInputRobustly(contaInput, format, 'Conta')
              accountFilled = true
              break
            } catch (e) {
              console.warn(`[ItauScraper] Formato '${format}' falhou, tentando próximo...`)
              // Tentar próximo formato
            }
          }
          
          if (!accountFilled) {
            // Log detalhado antes de lançar erro
            const contaInfo = await this.page.evaluate((el: any) => {
              return {
                value: el.value,
                disabled: el.disabled,
                readonly: el.readOnly,
                className: el.className,
                name: el.name,
                id: el.id,
                placeholder: el.placeholder,
              }
            }, contaInput)
            console.error('[ItauScraper] ERRO: Campo Conta não preenchido. Informações do campo:', JSON.stringify(contaInfo, null, 2))
            throw new Error('Erro ao preencher campo Conta após tentar todos os formatos')
          }
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
        await this._fillInputRobustly(passwordInput, password, 'Senha')
      } else {
        throw new Error('Campo senha não encontrado na página de login')
      }

      // Clicar em entrar
      console.log('[ItauScraper] Procurando botão de login...')
      // Usar XPath/evaluate para encontrar botão com texto (Puppeteer não suporta :has-text)
      const loginButton = await this.page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'))
        return buttons.find((el: any) => {
          const text = (el.textContent || el.value || '').toLowerCase()
          return text.includes('entrar') || text.includes('acessar') || text.includes('login')
        }) || null
      })
      
      if (loginButton && loginButton.asElement()) {
        console.log('[ItauScraper] Botão de login encontrado')
        await (loginButton.asElement() as any).click()
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
   * Navega até a página de extratos/faturas e configura período
   */
  protected async navigateToStatements(options?: {
    accountType?: 'checking' | 'creditCard' | 'investment'
    startDate?: Date
    endDate?: Date
  }): Promise<void> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log('[ItauScraper] Navegando até extratos...')
    console.log('[ItauScraper] Opções:', {
      accountType: options?.accountType,
      startDate: options?.startDate?.toISOString(),
      endDate: options?.endDate?.toISOString(),
    })

    try {
      // Aguardar página inicial carregar após login
      await new Promise(resolve => setTimeout(resolve, 2000))
      console.log('[ItauScraper] URL após login:', this.page.url())

      // Determinar tipo de conta e navegar
      const accountType = options?.accountType || 'checking'
      
      if (accountType === 'creditCard') {
        // NAVEGAR PARA FATURAS DE CARTÃO
        console.log('[ItauScraper] Navegando para faturas de cartão...')
        
        // Passo 1: Clicar em "Cartões" no menu
        console.log('[ItauScraper] Procurando menu "Cartões"...')
        const cartoesMenu = await this.page.evaluateHandle(() => {
          const links = Array.from(document.querySelectorAll('a, button, nav a, .menu-item'))
          return links.find((el: any) => {
            const text = (el.textContent || '').toLowerCase()
            return text.includes('cartão') || text.includes('cartoes') || (el.href && el.href.includes('cartao'))
          }) || null
        })
        
        if (cartoesMenu && cartoesMenu.asElement()) {
          console.log('[ItauScraper] Menu Cartões encontrado, clicando...')
          await (cartoesMenu.asElement() as any).click()
          await this.waitForNavigation()
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
        // Passo 2: Clicar em "Fatura e Limite" ou "Fatura"
        console.log('[ItauScraper] Procurando "Fatura e Limite" ou "Fatura"...')
        const faturaLink = await this.page.evaluateHandle(() => {
          const links = Array.from(document.querySelectorAll('a, button'))
          return links.find((el: any) => {
            const text = (el.textContent || '').toLowerCase()
            return text.includes('fatura') || (el.href && el.href.includes('fatura'))
          }) || null
        })
        
        if (faturaLink && faturaLink.asElement()) {
          console.log('[ItauScraper] Link Fatura encontrado, clicando...')
          await (faturaLink.asElement() as any).click()
          await this.waitForNavigation()
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          // Tentar URL direta
          console.log('[ItauScraper] Tentando URL direta de faturas...')
          await this.page.goto('https://www.itau.com.br/cartoes/fatura/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          })
        }
        
        // Passo 3: SELECIONAR CARTÃO (se houver múltiplos)
        console.log('[ItauScraper] Verificando se há múltiplos cartões...')
        const cardSelect = await this.page.$('select[name*="cartao"], select[id*="cartao"], select[name*="card"]')
        if (cardSelect) {
          console.log('[ItauScraper] Seletor de cartão encontrado - selecionando primeiro cartão')
          // Selecionar primeira opção (ou permitir configurar qual cartão)
          const options = await this.page.$$eval('select[name*="cartao"] option', (opts) => {
            return opts.map((opt: any) => ({ value: opt.value, text: opt.textContent }))
          })
          if (options.length > 1) {
            await this.page.select('select[name*="cartao"]', options[1].value) // Primeira opção válida (pula "Selecione")
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } else {
          console.log('[ItauScraper] Apenas um cartão ou já selecionado')
        }
        
      } else {
        // NAVEGAR PARA EXTRATOS DE CONTA CORRENTE - MENU COMPLETO
        console.log('[ItauScraper] Navegando para extratos de conta corrente...')
        
        // Passo 1: Clicar em "Conta Corrente" no menu
        console.log('[ItauScraper] Procurando menu "Conta Corrente"...')
        const contaCorrenteMenu = await this.page.evaluateHandle(() => {
          const links = Array.from(document.querySelectorAll('a, button, nav a, .menu-item, li'))
          return links.find((el: any) => {
            const text = (el.textContent || '').toLowerCase()
            return text.includes('conta corrente') || text.includes('conta-corrente')
          }) || null
        })
        
        if (contaCorrenteMenu && contaCorrenteMenu.asElement()) {
          console.log('[ItauScraper] Menu Conta Corrente encontrado, clicando...')
          await (contaCorrenteMenu.asElement() as any).click()
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        
        // Passo 2: Clicar em "Saldo e Extrato" ou "Extrato"
        console.log('[ItauScraper] Procurando "Saldo e Extrato" ou "Extrato Novo"...')
        const saldoExtratoLink = await this.page.evaluateHandle(() => {
          const links = Array.from(document.querySelectorAll('a, button'))
          return links.find((el: any) => {
            const text = (el.textContent || '').toLowerCase()
            return text.includes('saldo e extrato') || text.includes('extrato novo') || text.includes('extrato')
          }) || null
        })
        
        if (saldoExtratoLink && saldoExtratoLink.asElement()) {
          console.log('[ItauScraper] Link Saldo e Extrato encontrado, clicando...')
          await (saldoExtratoLink.asElement() as any).click()
          await this.waitForNavigation()
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          // Tentar navegar diretamente
          console.log('[ItauScraper] Tentando URL direta de extratos...')
          await this.page.goto('https://www.itau.com.br/conta-corrente/extrato/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          })
        }
      }

      console.log('[ItauScraper] URL após navegação:', this.page.url())

      // SELECIONAR PERÍODO (OBRIGATÓRIO)
      console.log('[ItauScraper] Configurando período...')
      
      const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 dias
      const endDate = options?.endDate || new Date()
      
      // Formatar datas para o formato brasileiro (DD/MM/YYYY)
      const formatDate = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = date.getFullYear()
        return `${day}/${month}/${year}`
      }
      
      const startDateStr = formatDate(startDate)
      const endDateStr = formatDate(endDate)
      
      console.log('[ItauScraper] Período desejado:', { startDateStr, endDateStr })

      // Procurar campos de data
      const dateSelectors = {
        start: [
          'input[name*="dataInicial"]',
          'input[name*="data_inicial"]',
          'input[id*="dataInicial"]',
          'input[id*="data_inicial"]',
          'input[placeholder*="Data inicial"]',
          'input[placeholder*="De"]',
          '#dataInicial',
          '#data_inicial',
        ],
        end: [
          'input[name*="dataFinal"]',
          'input[name*="data_final"]',
          'input[id*="dataFinal"]',
          'input[id*="data_final"]',
          'input[placeholder*="Data final"]',
          'input[placeholder*="Até"]',
          '#dataFinal',
          '#data_final',
        ],
      }

      // Preencher data inicial
      let startDateInput = null
      for (const selector of dateSelectors.start) {
        try {
          startDateInput = await this.page.$(selector)
          if (startDateInput) {
            console.log('[ItauScraper] Campo data inicial encontrado:', selector)
            break
          }
        } catch (e) {
          // Continuar
        }
      }

      if (startDateInput) {
        // Limpar campo e preencher
        await startDateInput.click({ clickCount: 3 }) // Selecionar tudo
        await startDateInput.type(startDateStr, { delay: 100 })
        console.log('[ItauScraper] Data inicial preenchida:', startDateStr)
      } else {
        console.log('[ItauScraper] Campo data inicial não encontrado - pode ser seleção por dropdown')
      }

      // Preencher data final
      let endDateInput = null
      for (const selector of dateSelectors.end) {
        try {
          endDateInput = await this.page.$(selector)
          if (endDateInput) {
            console.log('[ItauScraper] Campo data final encontrado:', selector)
            break
          }
        } catch (e) {
          // Continuar
        }
      }

      if (endDateInput) {
        await endDateInput.click({ clickCount: 3 })
        await endDateInput.type(endDateStr, { delay: 100 })
        console.log('[ItauScraper] Data final preenchida:', endDateStr)
      } else {
        console.log('[ItauScraper] Campo data final não encontrado - pode ser seleção por dropdown')
      }

      // Clicar em "Buscar" ou "Consultar"
      console.log('[ItauScraper] Procurando botão Buscar/Consultar...')
      const buscarButton = await this.page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'))
        return buttons.find((el: any) => {
          const text = (el.textContent || el.value || '').toLowerCase()
          return text.includes('buscar') || text.includes('consultar') || text.includes('pesquisar') || text.includes('filtrar')
        }) || null
      })

      if (buscarButton && buscarButton.asElement()) {
        console.log('[ItauScraper] Botão buscar encontrado, clicando...')
        await (buscarButton.asElement() as any).click()
        await this.waitForNavigation()
        await new Promise(resolve => setTimeout(resolve, 3000)) // Aguardar resultados carregarem
      } else {
        console.log('[ItauScraper] Botão buscar não encontrado - pode carregar automaticamente ou tentar Enter')
        await this.page.keyboard.press('Enter')
        await new Promise(resolve => setTimeout(resolve, 3000))
      }

      // Aguardar tabela/lista de transações aparecer
      console.log('[ItauScraper] Aguardando transações carregarem...')
      const transactionSelectors = [
        'table',
        '.extrato',
        '.transacoes',
        '[data-testid*="extrato"]',
        '[data-testid*="transaction"]',
        '.lista-transacoes',
        'tbody tr',
      ]

      let foundTable = false
      for (const selector of transactionSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 })
          console.log('[ItauScraper] Tabela/lista encontrada:', selector)
          foundTable = true
          break
        } catch (e) {
          // Continuar
        }
      }

      if (!foundTable) {
        console.log('[ItauScraper] AVISO: Tabela de transações não encontrada - pode não haver transações no período')
      }

      console.log('[ItauScraper] Navegação até extratos concluída')

    } catch (error) {
      console.error('[ItauScraper] Erro ao navegar até extratos:', error)
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

      console.log('[ItauScraper] Linhas encontradas:', rows.length)

      // Processar e normalizar transações
      for (const row of rows) {
        if (!row.date || !row.description || !row.amount) {
          console.log('[ItauScraper] Linha ignorada (dados incompletos):', row)
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
        } else {
          console.log('[ItauScraper] Data inválida:', row.date)
        }
      }

      console.log('[ItauScraper] Transações extraídas:', transactions.length)
      if (transactions.length > 0) {
        console.log('[ItauScraper] Primeira transação:', transactions[0])
      }

    } catch (error) {
      console.error('[ItauScraper] Erro ao extrair transações:', error)
      throw new Error(`Erro ao extrair transações: ${error instanceof Error ? error.message : String(error)}`)
    }

    return transactions
  }
}
