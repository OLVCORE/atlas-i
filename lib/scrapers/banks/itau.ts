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
   * Método auxiliar robusto para clicar em elementos
   * Tenta 3 estratégias diferentes em sequência
   */
  private async safeClick(description: string, selectors?: string[]): Promise<boolean> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log(`[ItauScraper] Tentando clicar em: ${description}`)
    
    // Estratégia 1: Seletores CSS diretos
    if (selectors && selectors.length > 0) {
      for (const selector of selectors) {
        try {
          const element = await this.page.$(selector)
          if (element) {
            const isVisible = await this.page.evaluate((el) => {
              return el instanceof HTMLElement && el.offsetParent !== null
            }, element)
            
            if (isVisible) {
              await element.scrollIntoViewIfNeeded()
              await element.click()
              console.log(`[ItauScraper] ✓ Clique bem-sucedido via seletor: ${selector}`)
              return true
            }
          }
        } catch (e) {
          console.log(`[ItauScraper] Falha no seletor ${selector}:`, e)
        }
      }
    }
    
    // Estratégia 2: Buscar por texto via evaluateHandle + validação
    try {
      const elementHandle = await this.page.evaluateHandle((desc) => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'))
        return buttons.find((el: any) => {
          const text = (el.textContent || el.value || '').toLowerCase()
          return text.includes(desc.toLowerCase())
        })
      }, description)
      
      // CRÍTICO: Validar se é um elemento válido
      if (elementHandle) {
        const isElement = await this.page.evaluate((el) => {
          return el instanceof HTMLElement && el !== null
        }, elementHandle)
        
        if (isElement) {
          const isVisible = await this.page.evaluate((el) => {
            return (el as HTMLElement).offsetParent !== null
          }, elementHandle)
          
          if (isVisible) {
            await (elementHandle as any).scrollIntoViewIfNeeded()
            await (elementHandle as any).click()
            console.log(`[ItauScraper] ✓ Clique bem-sucedido via texto: ${description}`)
            return true
          }
        }
      }
    } catch (e) {
      console.log(`[ItauScraper] Falha no clique via texto:`, e)
    }
    
    // Estratégia 3: Clique via JavaScript (fallback)
    try {
      const clicked = await this.page.evaluate((desc) => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'))
        const button = buttons.find((el: any) => {
          const text = (el.textContent || el.value || '').toLowerCase()
          return text.includes(desc.toLowerCase())
        }) as HTMLElement
        
        if (button && button.offsetParent !== null) {
          button.click()
          return true
        }
        return false
      }, description)
      
      if (clicked) {
        console.log(`[ItauScraper] ✓ Clique bem-sucedido via JavaScript: ${description}`)
        return true
      }
    } catch (e) {
      console.log(`[ItauScraper] Falha no clique via JavaScript:`, e)
    }
    
    console.log(`[ItauScraper] ✗ Todas as estratégias de clique falharam para: ${description}`)
    return false
  }

  /**
   * Método auxiliar robusto para preencher campos de input
   * Remove atributos disabled/readonly e valida preenchimento
   */
  private async safeFillInput(
    fieldName: string,
    value: string,
    selectors: string[]
  ): Promise<void> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log(`[ItauScraper] Procurando campo: ${fieldName}`)
    
    let inputElement: any = null

    // Estratégia 1: Seletores CSS
    for (const selector of selectors) {
      try {
        inputElement = await this.page.$(selector)
        if (inputElement) {
          console.log(`[ItauScraper] Campo ${fieldName} encontrado com seletor: ${selector}`)
          break
        }
      } catch (e) {
        // Continuar tentando
      }
    }

    // Estratégia 2: Buscar por contexto (labels)
    if (!inputElement) {
      console.log(`[ItauScraper] Tentando encontrar ${fieldName} por contexto...`)
      inputElement = await this.page.evaluateHandle((name) => {
        const labels = Array.from(document.querySelectorAll('label'))
        for (const label of labels) {
          const text = label.textContent?.toLowerCase() || ''
          if (text.includes(name.toLowerCase())) {
            // Tentar input dentro da label
            let input = label.querySelector('input')
            if (input) return input
            
            // Tentar input após a label
            input = label.nextElementSibling as HTMLInputElement
            if (input?.tagName === 'INPUT') return input
            
            // Tentar por for/id
            const forId = label.getAttribute('for')
            if (forId) {
              input = document.getElementById(forId) as HTMLInputElement
              if (input) return input
            }
          }
        }
        
        // Buscar inputs cujo parent contenha o nome do campo
        const allInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"], input[type="password"]'))
        for (const input of allInputs) {
          const parent = input.parentElement
          const parentText = parent?.textContent?.toLowerCase() || ''
          if (parentText.includes(name.toLowerCase())) {
            return input
          }
        }
        
        return null
      }, fieldName)
    }

    // Se não encontrou, capturar HTML para debug
    if (!inputElement) {
      const isNull = await this.page.evaluate((el) => el === null, inputElement).catch(() => true)
      if (isNull) {
        console.log(`[ItauScraper] ✗ Campo ${fieldName} NÃO encontrado!`)
        
        // Debug: listar todos os inputs
        const allInputs = await this.page.$$eval('input', inputs => 
          inputs.map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
            ariaLabel: input.getAttribute('aria-label'),
            visible: input.offsetParent !== null,
            maxLength: input.maxLength,
          }))
        )
        console.log(`[ItauScraper] Inputs visíveis na página:`, 
          allInputs.filter(i => i.visible)
        )
        
        throw new Error(`Campo ${fieldName} não encontrado`)
      }
    }

    // Preencher o campo (estratégia robusta)
    try {
      // 1. Remover atributos que impedem digitação
      await this.page.evaluate((el) => {
        if (el instanceof HTMLInputElement) {
          el.removeAttribute('disabled')
          el.removeAttribute('readonly')
          el.disabled = false
          el.readOnly = false
        }
      }, inputElement)

      // 2. Focar no campo
      await inputElement.focus()
      await new Promise(resolve => setTimeout(resolve, 200))

      // 3. Limpar campo
      await this.page.evaluate((el) => {
        if (el instanceof HTMLInputElement) {
          el.value = ''
        }
      }, inputElement)

      // 4. Digitar com delay (simula digitação humana)
      await inputElement.type(value, { delay: 100 })
      await new Promise(resolve => setTimeout(resolve, 300))

      // 5. Validar se o valor foi setado
      const actualValue = await this.page.evaluate((el) => {
        return (el as HTMLInputElement).value
      }, inputElement)

      if (actualValue === value) {
        console.log(`[ItauScraper] ✓ Campo ${fieldName} preenchido: ${value}`)
        return
      } else {
        console.log(`[ItauScraper] ⚠ Valor não setado corretamente. Tentando via JavaScript...`)
        
        // Fallback: setar via JavaScript
        await this.page.evaluate((el, val) => {
          if (el instanceof HTMLInputElement) {
            el.value = val
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
            el.dispatchEvent(new Event('blur', { bubbles: true }))
          }
        }, inputElement, value)

        const finalValue = await this.page.evaluate((el) => {
          return (el as HTMLInputElement).value
        }, inputElement)

        if (finalValue === value || finalValue.includes(value.replace(/\D/g, ''))) {
          console.log(`[ItauScraper] ✓ Campo ${fieldName} preenchido via JavaScript: ${value}`)
          return
        } else {
          throw new Error(`Erro ao preencher campo ${fieldName}: valor final '${finalValue}' diferente de '${value}'`)
        }
      }
    } catch (error) {
      console.error(`[ItauScraper] Erro ao preencher ${fieldName}:`, error)
      throw new Error(`Erro ao preencher campo ${fieldName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Faz login no Itaú
   */
  protected async login(): Promise<void> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    try {
      console.log('[ItauScraper] Iniciando login...')
      console.log('[ItauScraper] Credenciais:', {
        hasCpf: !!this.credentials.cpf,
        hasCnpj: !!this.credentials.cnpj,
        hasAgency: !!this.credentials.agency,
        hasAccountNumber: !!this.credentials.accountNumber,
        hasPassword: !!this.credentials.password,
      })

      // Navegar para página de login do Itaú
      const loginUrl = 'https://www.itau.com.br/conta-corrente/acesse-sua-conta/'
      
      console.log('[ItauScraper] Navegando para:', loginUrl)
      await this.page.goto(loginUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })
      console.log('[ItauScraper] Página carregada. URL atual:', this.page.url())

      // Aguardar JavaScript da página carregar
      await new Promise(resolve => setTimeout(resolve, 2000))

      const { cpf, cnpj, agency, accountNumber, accountDigit, password } = this.credentials

      // ==========================================
      // PASSO 1: PREENCHER CPF
      // ==========================================
      if (cpf) {
        await this.safeFillInput('CPF', cpf.replace(/\D/g, ''), [
          'input[name="cpf"]',
          'input[id*="cpf"]',
          'input[placeholder*="CPF"]',
          'input[aria-label*="CPF"]',
          'input[type="text"][maxlength="11"]',
          'input[type="tel"][maxlength="11"]',
        ])
      } else if (cnpj) {
        await this.safeFillInput('CNPJ', cnpj.replace(/\D/g, ''), [
          'input[name="cnpj"]',
          'input[id*="cnpj"]',
          'input[placeholder*="CNPJ"]',
          'input[aria-label*="CNPJ"]',
          'input[type="text"][maxlength="14"]',
        ])
      } else {
        throw new Error('CPF ou CNPJ não fornecido para login')
      }

      // ==========================================
      // PASSO 2: CLICAR EM "CONTINUAR" E AGUARDAR
      // ==========================================
      const continuarClicked = await this.safeClick('continuar')
      
      if (continuarClicked) {
        console.log('[ItauScraper] Aguardando navegação após Continuar...')
        await Promise.race([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          new Promise(resolve => setTimeout(resolve, 5000))
        ])
        
        console.log('[ItauScraper] Após Continuar - URL atual:', this.page.url())
        
        // Aguardar renderização completa
        await new Promise(resolve => setTimeout(resolve, 3000))
      }

      // ==========================================
      // DEBUG: LISTAR INPUTS VISÍVEIS
      // ==========================================
      const allInputs = await this.page.$$eval('input', inputs => 
        inputs.map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          ariaLabel: input.getAttribute('aria-label'),
          visible: input.offsetParent !== null,
          maxLength: input.maxLength,
        }))
      )
      console.log('[ItauScraper] Total de inputs:', allInputs.length)
      console.log('[ItauScraper] Inputs VISÍVEIS:', 
        allInputs.filter(i => i.visible)
      )

      // ==========================================
      // PASSO 3: PREENCHER AGÊNCIA
      // ==========================================
      if (agency) {
        await this.safeFillInput('Agência', agency.replace(/\D/g, ''), [
          'input[name="agencia"]',
          'input[name="ag"]',
          'input[id*="agencia"]',
          'input[id*="ag"]',
          'input[placeholder*="Agência"]',
          'input[placeholder*="agência"]',
          'input[aria-label*="Agência"]',
          '#agencia',
          '#ag',
          'input[type="text"][maxlength="4"]',
          'input[type="number"][maxlength="4"]',
        ])
      }

      // ==========================================
      // PASSO 4: PREENCHER CONTA
      // ==========================================
      if (accountNumber) {
        // Tentar diferentes formatos
        const accountFormats = [
          `${accountNumber.replace(/\D/g, '')}-${accountDigit?.replace(/\D/g, '') || ''}`,
          `${accountNumber.replace(/\D/g, '')}${accountDigit?.replace(/\D/g, '') || ''}`,
          accountNumber.replace(/\D/g, '')
        ]
        
        let accountFilled = false
        for (const format of accountFormats) {
          try {
            await this.safeFillInput('Conta', format, [
              'input[name="conta"]',
              'input[name="account"]',
              'input[id*="conta"]',
              'input[id*="account"]',
              'input[placeholder*="Conta"]',
              'input[aria-label*="Conta"]',
              '#conta',
            ])
            accountFilled = true
            break
          } catch (e) {
            console.log(`[ItauScraper] Formato '${format}' falhou, tentando próximo...`)
          }
        }
        
        if (!accountFilled) {
          throw new Error('Erro ao preencher campo Conta após tentar todos os formatos')
        }
      }

      // ==========================================
      // PASSO 5: PREENCHER DÍGITO (se aplicável)
      // ==========================================
      if (accountDigit) {
        try {
          await this.safeFillInput('Dígito', accountDigit.replace(/\D/g, ''), [
            'input[name="digito"]',
            'input[name="dv"]',
            'input[id*="digito"]',
            'input[id*="dv"]',
            'input[placeholder*="Dígito"]',
            'input[type="text"][maxlength="1"]',
          ])
        } catch (e) {
          console.log('[ItauScraper] Campo Dígito não encontrado (pode não ser necessário)')
        }
      }

      // ==========================================
      // PASSO 6: PREENCHER SENHA
      // ==========================================
      await this.safeFillInput('Senha', password, [
        'input[type="password"]',
        'input[name="senha"]',
        'input[name="password"]',
        'input[id*="senha"]',
        'input[id*="password"]',
        'input[aria-label*="Senha"]',
      ])

      // ==========================================
      // PASSO 7: CLICAR EM "ENTRAR"
      // ==========================================
      const entrarClicked = await this.safeClick('entrar', [
        'button[type="submit"]',
        'input[type="submit"]',
      ])

      if (!entrarClicked) {
        throw new Error('Botão Entrar não encontrado ou não clicável')
      }

      // Aguardar navegação após login
      console.log('[ItauScraper] Aguardando navegação após Entrar...')
      await Promise.race([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])

      console.log('[ItauScraper] Login concluído. URL atual:', this.page.url())

      // Verificar se está logado (não está mais na página de login)
      const currentUrl = this.page.url()
      if (currentUrl.includes('login') || currentUrl.includes('acesse-sua-conta')) {
        throw new Error('Falha no login - ainda na página de login')
      }

    } catch (error) {
      console.error('[ItauScraper] Erro no login:', error)
      
      // Capturar estado da página para debug
      try {
        if (this.page) {
          const url = this.page.url()
          const title = await this.page.title()
          console.log('[ItauScraper] Estado da página no erro:', { url, title })
        }
      } catch (e) {
        console.log('[ItauScraper] Não foi possível capturar estado da página')
      }
      
      throw new Error(`Erro ao fazer login no Itaú: ${error instanceof Error ? error.message : String(error)}`)
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
        
        // Clicar em "Cartões"
        const cartoesClicked = await this.safeClick('cartões')
        if (cartoesClicked) {
          await this.waitForNavigation()
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
        // Clicar em "Fatura" ou "Fatura e Limite"
        await this.safeClick('fatura')
        await this.waitForNavigation()
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } else {
        // NAVEGAR PARA EXTRATOS DE CONTA CORRENTE
        console.log('[ItauScraper] Navegando para extratos de conta corrente...')
        
        // Clicar em "Conta Corrente"
        const contaClicked = await this.safeClick('conta corrente')
        if (contaClicked) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
        // Clicar em "Saldo e Extrato" ou "Extrato"
        await this.safeClick('extrato')
        await this.waitForNavigation()
        await new Promise(resolve => setTimeout(resolve, 2000))
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

      // Preencher data inicial
      try {
        await this.safeFillInput('Data inicial', startDateStr, [
          'input[name*="dataInicial"]',
          'input[name*="data_inicial"]',
          'input[id*="dataInicial"]',
          'input[id*="data_inicial"]',
          'input[placeholder*="Data inicial"]',
          'input[placeholder*="De"]',
          '#dataInicial',
          '#data_inicial',
        ])
      } catch (e) {
        console.log('[ItauScraper] Campo data inicial não encontrado - pode ser seleção por dropdown')
      }

      // Preencher data final
      try {
        await this.safeFillInput('Data final', endDateStr, [
          'input[name*="dataFinal"]',
          'input[name*="data_final"]',
          'input[id*="dataFinal"]',
          'input[id*="data_final"]',
          'input[placeholder*="Data final"]',
          'input[placeholder*="Até"]',
          '#dataFinal',
          '#data_final',
        ])
      } catch (e) {
        console.log('[ItauScraper] Campo data final não encontrado - pode ser seleção por dropdown')
      }

      // Clicar em "Buscar" ou "Consultar"
      await this.safeClick('buscar')
      await this.waitForNavigation()
      await new Promise(resolve => setTimeout(resolve, 3000)) // Aguardar resultados carregarem

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

    console.log('[ItauScraper] Iniciando extração de transações...')
    console.log('[ItauScraper] URL atual:', this.page.url())

    const transactions: ScrapingResult['transactions'] = []

    try {
      // Aguardar transações carregarem
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Extrair transações da tabela de extratos
      console.log('[ItauScraper] Procurando linhas de transações...')
      const rows = await this.page.$$eval('table tbody tr, .extrato-item, [data-testid*="transaction"], .transacao-item', (elements) => {
        return elements.map((row) => {
          const cells = row.querySelectorAll('td, .extrato-coluna')
          const text = row.textContent || ''
          
          // Tentar extrair data, descrição e valor
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
