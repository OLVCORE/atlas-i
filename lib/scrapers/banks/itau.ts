/**
 * MC13: Scraper Itaú (PF e PJ) - VERSÃO ULTRA-ROBUSTA
 * 
 * Estratégia: JavaScript puro via page.evaluate()
 * - Sem evaluateHandle (pode retornar null)
 * - Validação tripla (existência, visibilidade, tipo)
 * - Logs extremamente detalhados
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
   * Clique ultra-robusto via JavaScript puro
   * Executa no contexto do browser, mais confiável
   */
  private async clickElement(description: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log(`[ItauScraper] 🔍 Procurando elemento: ${description}`)
    
    try {
      const clicked = await this.page.evaluate((desc) => {
        // Buscar todos os elementos clicáveis
        const elements = Array.from(
          document.querySelectorAll('button, a, input[type="submit"], [role="button"]')
        )
        
        console.log(`[Browser] Total de elementos clicáveis: ${elements.length}`)
        
        // Filtrar por texto
        const matches = elements.filter((el: any) => {
          const text = (el.textContent || el.value || el.innerText || '').toLowerCase()
          return text.includes(desc.toLowerCase())
        })
        
        console.log(`[Browser] Elementos que contêm "${desc}": ${matches.length}`)
        
        if (matches.length === 0) {
          console.log(`[Browser] ❌ Nenhum elemento encontrado com texto "${desc}"`)
          return false
        }
        
        // Pegar o primeiro visível
        for (const element of matches) {
          const el = element as HTMLElement
          
          // Verificar visibilidade
          const style = window.getComputedStyle(el)
          const isVisible = el.offsetParent !== null && 
                           style.display !== 'none' &&
                           style.visibility !== 'hidden' &&
                           style.opacity !== '0'
          
          if (isVisible) {
            console.log(`[Browser] ✓ Elemento visível encontrado, clicando...`)
            el.click()
            return true
          }
        }
        
        console.log(`[Browser] ❌ Nenhum elemento visível encontrado`)
        return false
        
      }, description)
      
      if (clicked) {
        console.log(`[ItauScraper] ✅ Clique bem-sucedido: ${description}`)
        return true
      } else {
        console.log(`[ItauScraper] ❌ Clique falhou: ${description}`)
        return false
      }
      
    } catch (error) {
      console.error(`[ItauScraper] ❌ Erro ao clicar em "${description}":`, error)
      return false
    }
  }

  /**
   * Preenchimento ultra-robusto via JavaScript puro
   * Remove disabled/readonly e dispara eventos corretamente
   */
  private async fillField(
    fieldName: string,
    value: string,
    selectors: string[]
  ): Promise<void> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log(`[ItauScraper] 🔍 Procurando campo: ${fieldName}`)
    
    try {
      const filled = await this.page.evaluate((name, val, sels) => {
        // Estratégia 1: Tentar seletores CSS
        for (const selector of sels) {
          try {
            const input = document.querySelector(selector) as HTMLInputElement
            if (input && input.offsetParent !== null) {
              console.log(`[Browser] ✓ Campo encontrado via seletor: ${selector}`)
              
              // Remover atributos que impedem digitação
              input.removeAttribute('disabled')
              input.removeAttribute('readonly')
              ;(input as any).disabled = false
              ;(input as any).readOnly = false
              
              // Limpar e preencher
              input.value = ''
              input.value = val
              
              // Disparar eventos
              input.dispatchEvent(new Event('input', { bubbles: true }))
              input.dispatchEvent(new Event('change', { bubbles: true }))
              input.dispatchEvent(new Event('blur', { bubbles: true }))
              
              console.log(`[Browser] ✓ Campo preenchido: ${name} = ${val}`)
              return true
            }
          } catch (e) {
            // Continuar tentando próximo seletor
          }
        }
        
        // Estratégia 2: Buscar por label
        const labels = Array.from(document.querySelectorAll('label'))
        for (const label of labels) {
          const text = label.textContent?.toLowerCase() || ''
          if (text.includes(name.toLowerCase())) {
            // Tentar input dentro da label
            let input = label.querySelector('input') as HTMLInputElement
            
            // Tentar input após a label
            if (!input) {
              input = label.nextElementSibling as HTMLInputElement
            }
            
            // Tentar por for/id
            if (!input) {
              const forId = label.getAttribute('for')
              if (forId) {
                input = document.getElementById(forId) as HTMLInputElement
              }
            }
            
            if (input && input.tagName === 'INPUT') {
              console.log(`[Browser] ✓ Campo encontrado via label: ${name}`)
              
              input.removeAttribute('disabled')
              input.removeAttribute('readonly')
              ;(input as any).disabled = false
              ;(input as any).readOnly = false
              input.value = ''
              input.value = val
              input.dispatchEvent(new Event('input', { bubbles: true }))
              input.dispatchEvent(new Event('change', { bubbles: true }))
              input.dispatchEvent(new Event('blur', { bubbles: true }))
              
              console.log(`[Browser] ✓ Campo preenchido via label: ${name} = ${val}`)
              return true
            }
          }
        }
        
        console.log(`[Browser] ❌ Campo não encontrado: ${name}`)
        return false
        
      }, fieldName, value, selectors)
      
      if (filled) {
        console.log(`[ItauScraper] ✅ Campo preenchido com sucesso: ${fieldName}`)
      } else {
        console.log(`[ItauScraper] ❌ Falha ao preencher campo: ${fieldName}`)
        
        // Debug: listar todos os inputs
        const allInputs = await this.page.$$eval('input', inputs =>
          inputs.map(i => ({
            type: i.type,
            name: i.name,
            id: i.id,
            placeholder: i.placeholder,
            visible: i.offsetParent !== null
          }))
        )
        console.log(`[ItauScraper] 📋 Inputs disponíveis:`, allInputs.filter(i => i.visible))
        
        throw new Error(`Campo ${fieldName} não encontrado`)
      }
      
    } catch (error) {
      console.error(`[ItauScraper] ❌ Erro ao preencher "${fieldName}":`, error)
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

    try {
      console.log('[ItauScraper] ========================================')
      console.log('[ItauScraper] 🚀 INICIANDO LOGIN NO ITAÚ')
      console.log('[ItauScraper] ========================================')
      
      const { cpf, cnpj, agency, accountNumber, accountDigit, password } = this.credentials
      
      console.log('[ItauScraper] 📋 Credenciais:', {
        hasCpf: !!cpf,
        hasCnpj: !!cnpj,
        hasAgency: !!agency,
        hasAccount: !!accountNumber,
        hasDigit: !!accountDigit,
        hasPassword: !!password
      })

      // Navegar para página de login
      const loginUrl = 'https://www.itau.com.br/conta-corrente/acesse-sua-conta/'
      console.log(`[ItauScraper] 🌐 Navegando para: ${loginUrl}`)
      
      await this.page.goto(loginUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      })
      
      console.log(`[ItauScraper] ✅ Página carregada: ${this.page.url()}`)
      await new Promise(resolve => setTimeout(resolve, 3000))

      // PASSO 1: CPF ou CNPJ
      if (cnpj) {
        console.log('[ItauScraper] 📝 PASSO 1: Preenchendo CNPJ')
        await this.fillField('CNPJ', cnpj.replace(/\D/g, ''), [
          'input[name="cnpj"]',
          'input[id*="cnpj"]',
          'input[placeholder*="CNPJ"]',
          'input[placeholder*="cnpj"]'
        ])
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else if (cpf) {
        console.log('[ItauScraper] 📝 PASSO 1: Preenchendo CPF')
        await this.fillField('CPF', cpf.replace(/\D/g, ''), [
          'input[name="cpf"]',
          'input[id*="cpf"]',
          'input[placeholder*="CPF"]',
          'input[type="text"][maxlength="11"]',
          'input[type="tel"][maxlength="11"]'
        ])
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        throw new Error('CPF ou CNPJ não fornecido')
      }

      // PASSO 2: Continuar
      console.log('[ItauScraper] 🔘 PASSO 2: Clicando em Continuar')
      const continuarClicked = await this.clickElement('continuar')
      
      if (continuarClicked) {
        console.log('[ItauScraper] ⏳ Aguardando navegação...')
        await Promise.race([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          new Promise(resolve => setTimeout(resolve, 5000))
        ])
        console.log(`[ItauScraper] ✅ Após Continuar: ${this.page.url()}`)
        await new Promise(resolve => setTimeout(resolve, 3000))
      } else {
        console.log('[ItauScraper] ⚠️ Botão Continuar não encontrado, tentando Enter...')
        await this.page.keyboard.press('Enter')
        await new Promise(resolve => setTimeout(resolve, 3000))
      }

      // PASSO 3: Agência (apenas para PF)
      if (agency && cpf) {
        console.log('[ItauScraper] 📝 PASSO 3: Preenchendo Agência')
        await this.fillField('Agência', agency.replace(/\D/g, ''), [
          'input[name="agencia"]',
          'input[name="ag"]',
          'input[id*="agencia"]',
          'input[placeholder*="Agência"]',
          'input[placeholder*="agência"]',
          'input[type="text"][maxlength="4"]'
        ])
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // PASSO 4: Conta (apenas para PF)
      if (accountNumber && cpf) {
        console.log('[ItauScraper] 📝 PASSO 4: Preenchendo Conta')
        // Tentar diferentes formatos
        const accountFormats = [
          `${accountNumber.replace(/\D/g, '')}-${accountDigit?.replace(/\D/g, '') || ''}`,
          `${accountNumber.replace(/\D/g, '')}${accountDigit?.replace(/\D/g, '') || ''}`,
          accountNumber.replace(/\D/g, '')
        ]
        
        let accountFilled = false
        for (const format of accountFormats) {
          try {
            await this.fillField('Conta', format, [
              'input[name="conta"]',
              'input[id*="conta"]',
              'input[placeholder*="Conta"]',
              'input[placeholder*="conta"]'
            ])
            accountFilled = true
            break
          } catch (e) {
            console.log(`[ItauScraper] ⚠️ Formato '${format}' falhou, tentando próximo...`)
          }
        }
        
        if (!accountFilled) {
          throw new Error('Erro ao preencher campo Conta após tentar todos os formatos')
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // PASSO 5: Dígito (apenas para PF, opcional)
      if (accountDigit && cpf) {
        console.log('[ItauScraper] 📝 PASSO 5: Preenchendo Dígito')
        try {
          await this.fillField('Dígito', accountDigit.replace(/\D/g, ''), [
            'input[name="digito"]',
            'input[name="dv"]',
            'input[id*="digito"]',
            'input[type="text"][maxlength="1"]'
          ])
        } catch (e) {
          console.log('[ItauScraper] ⚠️ Campo Dígito não encontrado (pode não ser necessário)')
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // PASSO 6: Senha
      console.log('[ItauScraper] 🔒 PASSO 6: Preenchendo Senha')
      await this.fillField('Senha', password, [
        'input[type="password"]',
        'input[name="senha"]',
        'input[name="password"]',
        'input[id*="senha"]'
      ])
      await new Promise(resolve => setTimeout(resolve, 1000))

      // PASSO 7: Entrar
      console.log('[ItauScraper] 🔘 PASSO 7: Clicando em Entrar')
      const entrarClicked = await this.clickElement('entrar')
      
      if (!entrarClicked) {
        console.log('[ItauScraper] ⚠️ Botão Entrar não encontrado, tentando Enter...')
        await this.page.keyboard.press('Enter')
        await new Promise(resolve => setTimeout(resolve, 2000))
      } else {
        console.log('[ItauScraper] ⏳ Aguardando login completar...')
        await Promise.race([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          new Promise(resolve => setTimeout(resolve, 5000))
        ])
      }

      // Verificar se precisa de 2FA
      if (this.credentials.twoFactorSecret) {
        await this.handle2FA()
      }

      // Verificar se está logado
      const currentUrl = this.page.url()
      if (currentUrl.includes('login') || currentUrl.includes('acesse-sua-conta')) {
        throw new Error('Falha no login - ainda na página de login')
      }

      console.log('[ItauScraper] ========================================')
      console.log(`[ItauScraper] ✅ LOGIN CONCLUÍDO: ${this.page.url()}`)
      console.log('[ItauScraper] ========================================')

    } catch (error) {
      console.error('[ItauScraper] ❌ ERRO NO LOGIN:', error)
      
      try {
        if (this.page) {
          const url = this.page.url()
          const title = await this.page.title()
          console.log('[ItauScraper] 📍 Estado da página:', { url, title })
        }
      } catch (e) {
        console.log('[ItauScraper] ⚠️ Não foi possível capturar estado da página')
      }
      
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
      await this.page.waitForSelector('input[type="text"][placeholder*="token"], input[type="text"][placeholder*="código"], input[name="token"]', { timeout: 10000 })
      
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

    console.log('[ItauScraper] 🧭 Navegando até extratos...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const accountType = options?.accountType || 'checking'

    if (accountType === 'creditCard') {
      console.log('[ItauScraper] 🧭 Navegando para faturas de cartão...')
      await this.clickElement('cartões')
      await new Promise(resolve => setTimeout(resolve, 2000))
      await this.clickElement('fatura')
    } else {
      console.log('[ItauScraper] 🧭 Navegando para extratos de conta corrente...')
      await this.clickElement('conta corrente')
      await new Promise(resolve => setTimeout(resolve, 2000))
      await this.clickElement('extrato')
    }
    
    // Configurar período se fornecido
    if (options?.startDate && options?.endDate) {
      console.log('[ItauScraper] 📅 Configurando período...')
      
      const formatDate = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = date.getFullYear()
        return `${day}/${month}/${year}`
      }
      
      const startDateStr = formatDate(options.startDate)
      const endDateStr = formatDate(options.endDate)
      
      try {
        await this.fillField('Data inicial', startDateStr, [
          'input[name*="dataInicial"]',
          'input[name*="data_inicial"]',
          'input[id*="dataInicial"]',
          'input[placeholder*="Data inicial"]',
          'input[placeholder*="De"]'
        ])
      } catch (e) {
        console.log('[ItauScraper] ⚠️ Campo data inicial não encontrado')
      }

      try {
        await this.fillField('Data final', endDateStr, [
          'input[name*="dataFinal"]',
          'input[name*="data_final"]',
          'input[id*="dataFinal"]',
          'input[placeholder*="Data final"]',
          'input[placeholder*="Até"]'
        ])
      } catch (e) {
        console.log('[ItauScraper] ⚠️ Campo data final não encontrado')
      }

      await this.clickElement('buscar')
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('[ItauScraper] ✅ Navegação concluída')
  }

  /**
   * Extrai transações da página
   */
  protected async extractTransactions(): Promise<ScrapingResult['transactions']> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log('[ItauScraper] 📊 Extraindo transações...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    const transactions: ScrapingResult['transactions'] = []

    try {
      const rows = await this.page.$$eval(
        'table tbody tr, .transaction-row, [data-transaction], .extrato-item',
        (rows) => {
          return rows.map((row) => {
            const cells = row.querySelectorAll('td, .transaction-cell, .extrato-coluna')
            const text = row.textContent || ''
            
            return {
              date: cells[0]?.textContent?.trim() || '',
              description: cells[1]?.textContent?.trim() || '',
              amount: cells[2]?.textContent?.trim() || cells[3]?.textContent?.trim() || '',
              rawText: text.substring(0, 100)
            }
          })
        }
      )

      console.log(`[ItauScraper] 📋 Linhas encontradas: ${rows.length}`)

      for (const row of rows) {
        if (!row.date || !row.description || !row.amount) {
          console.log('[ItauScraper] ⚠️ Linha ignorada (dados incompletos):', row)
          continue
        }

        // Parsear data (DD/MM/YYYY)
        const dateParts = row.date.split('/')
        if (dateParts.length !== 3) {
          console.log('[ItauScraper] ⚠️ Data inválida:', row.date)
          continue
        }

        const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`

        // Parsear valor (R$ 1.234,56)
        const amountStr = row.amount
          .replace('R$', '')
          .replace(/\./g, '')
          .replace(',', '.')
          .trim()
        const amount = parseFloat(amountStr)

        if (isNaN(amount)) {
          console.log('[ItauScraper] ⚠️ Valor inválido:', row.amount)
          continue
        }

        transactions.push({
          date: isoDate,
          description: row.description,
          amount: Math.abs(amount),
          type: amount < 0 ? 'expense' : 'income',
          raw: { text: row.rawText }
        })
      }

      console.log(`[ItauScraper] ✅ Transações extraídas: ${transactions.length}`)
      return transactions

    } catch (error) {
      console.error('[ItauScraper] ❌ Erro ao extrair transações:', error)
      throw error
    }
  }
}
