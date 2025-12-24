/**
 * MC13: Scraper Itaú (PF e PJ) - VERSÃO COM CLIQUE EM "ACESSAR CONTA"
 * 
 * Estratégia:
 * - Navega para página inicial do Itaú
 * - Clica em "Acessar conta" para abrir área de login
 * - Detecta redirecionamento para 404
 * - Verifica se há iframes (login pode estar em iframe)
 * - Valida presença de campos de login
 * - Fallback para Enter se botões não forem encontrados
 * - Logs extremamente detalhados com links visíveis
 */

import { BaseScraper } from '../base'
import type { BankCode, ScrapingResult, ScraperCredentials } from '../types'

export class ItauScraper extends BaseScraper {
  constructor(credentials: ScraperCredentials) {
    super('itau', credentials)
  }

  /**
   * URLs de login do Itaú para tentar (em ordem de prioridade)
   */
  private readonly LOGIN_URLS = [
    'https://www.itau.com.br/',
    'https://banco.itau.com.br/',
    'https://www.itau.com.br/conta-corrente/',
    'https://internetbanking.itau.com.br/',
  ]

  /**
   * Detecta se a página é um erro 404 ou similar
   */
  private async isErrorPage(): Promise<boolean> {
    if (!this.page) {
      return false
    }

    const url = this.page.url().toLowerCase()
    const title = (await this.page.title()).toLowerCase()
    
    const isError = url.includes('/404') || 
                   url.includes('erro') ||
                   url.includes('error') ||
                   title.includes('404') ||
                   title.includes('não encontrad') ||
                   title.includes('error')
    
    if (isError) {
      console.log('[ItauScraper] ⚠️ PÁGINA DE ERRO DETECTADA!')
      console.log('[ItauScraper] URL:', url)
      console.log('[ItauScraper] Título:', title)
    }
    
    return isError
  }

  /**
   * Tenta navegar para a página de login usando múltiplas URLs
   */
  private async navigateToLogin(): Promise<string> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log('[ItauScraper] 🔍 Tentando encontrar página de login...')
    
    for (const loginUrl of this.LOGIN_URLS) {
      try {
        console.log(`[ItauScraper] 🌐 Tentando: ${loginUrl}`)
        
        await this.page.goto(loginUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        })
        
        const finalUrl = this.page.url()
        console.log(`[ItauScraper] ✅ Carregado: ${finalUrl}`)
        
        // Verificar se não é página de erro
        if (await this.isErrorPage()) {
          console.log('[ItauScraper] ❌ Página de erro, tentando próxima URL...')
          continue
        }
        
        // Aguardar página carregar
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Verificar se há campos de login na página
        const hasLoginFields = await this.page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'))
          const hasPasswordField = inputs.some(i => i.type === 'password')
          const hasTextField = inputs.some(i => ['text', 'tel', 'number'].includes(i.type))
          return hasPasswordField || hasTextField
        })
        
        if (hasLoginFields) {
          console.log('[ItauScraper] ✅ Página de login encontrada!')
          return finalUrl
        } else {
          console.log('[ItauScraper] ⚠️ Página sem campos de login, tentando próxima...')
        }
        
      } catch (error) {
        console.log(`[ItauScraper] ❌ Erro ao acessar ${loginUrl}:`, error)
      }
    }
    
    throw new Error('Não foi possível acessar nenhuma página de login do Itaú')
  }

  /**
   * Clica no botão "Acessar conta" para abrir a área de login
   */
  private async clickAccessAccount(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log('[ItauScraper] 🔍 Procurando botão "Acessar conta"...')
    
    try {
      const clicked = await this.page.evaluate(() => {
        // Textos possíveis do botão
        const possibleTexts = [
          'acessar conta',
          'acesse sua conta',
          'internet banking',
          'login',
          'entrar',
          'área do cliente',
          'para você',
          'pessoa física'
        ]
        
        // Buscar todos os links e botões
        const elements = Array.from(
          document.querySelectorAll('a, button, [role="button"]')
        )
        
        console.log(`[Browser] Total de elementos: ${elements.length}`)
        
        for (const possibleText of possibleTexts) {
          for (const element of elements) {
            const el = element as HTMLElement
            const text = (el.textContent || el.innerText || '').toLowerCase()
            const href = (el as HTMLAnchorElement).href || ''
            
            // Verificar texto ou href
            if (text.includes(possibleText) || href.includes('conta-corrente')) {
              const isVisible = el.offsetParent !== null && 
                               window.getComputedStyle(el).display !== 'none' &&
                               window.getComputedStyle(el).visibility !== 'hidden'
              
              if (isVisible) {
                console.log(`[Browser] ✓ Encontrado: "${el.textContent?.trim()}" (texto: ${possibleText})`)
                el.click()
                return true
              }
            }
          }
        }
        
        console.log('[Browser] ❌ Botão "Acessar conta" não encontrado')
        return false
      })
      
      if (clicked) {
        console.log('[ItauScraper] ✅ Clique em "Acessar conta" bem-sucedido')
        return true
      } else {
        console.log('[ItauScraper] ❌ Não foi possível clicar em "Acessar conta"')
        return false
      }
      
    } catch (error) {
      console.error('[ItauScraper] ❌ Erro ao clicar em "Acessar conta":', error)
      return false
    }
  }

  /**
   * Verifica se há iframes na página e muda o contexto se necessário
   */
  private async checkForIframes(): Promise<void> {
    if (!this.page) {
      return
    }

    console.log('[ItauScraper] 🔍 Verificando se há iframes...')
    
    const frames = this.page.frames()
    console.log(`[ItauScraper] Total de frames: ${frames.length}`)
    
    for (const frame of frames) {
      const url = frame.url()
      console.log(`[ItauScraper] Frame URL: ${url}`)
      
      // Se encontrar frame de login, usar ele
      if (url.includes('login') || url.includes('auth') || url.includes('security')) {
        console.log('[ItauScraper] ✓ Frame de login encontrado!')
        // Aqui você pode precisar mudar o contexto para o frame
      }
    }
  }

  /**
   * Clique ultra-robusto via JavaScript puro
   */
  private async clickElement(description: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log(`[ItauScraper] 🔍 Procurando elemento: ${description}`)
    
    try {
      const clicked = await this.page.evaluate((desc) => {
        const elements = Array.from(
          document.querySelectorAll('button, a, input[type="submit"], [role="button"]')
        )
        
        console.log(`[Browser] Total de elementos clicáveis: ${elements.length}`)
        
        const matches = elements.filter((el: any) => {
          const text = (el.textContent || el.value || el.innerText || '').toLowerCase()
          return text.includes(desc.toLowerCase())
        })
        
        console.log(`[Browser] Elementos que contêm "${desc}": ${matches.length}`)
        
        if (matches.length === 0) {
          return false
        }
        
        for (const element of matches) {
          const el = element as HTMLElement
          const isVisible = el.offsetParent !== null && 
                           window.getComputedStyle(el).display !== 'none' &&
                           window.getComputedStyle(el).visibility !== 'hidden'
          
          if (isVisible) {
            console.log(`[Browser] ✓ Elemento visível encontrado, clicando...`)
            el.click()
            return true
          }
        }
        
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
   * Simula pressionar Enter no campo
   */
  private async pressEnter(): Promise<void> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log('[ItauScraper] ⌨️ Pressionando Enter...')
    await this.page.keyboard.press('Enter')
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  /**
   * Preenchimento ultra-robusto via JavaScript puro
   */
  private async fillField(
    fieldName: string,
    value: string,
    selectors: string[]
  ): Promise<boolean> {
    if (!this.page) {
      throw new Error('Página não inicializada')
    }

    console.log(`[ItauScraper] 🔍 Procurando campo: ${fieldName}`)
    
    try {
      const filled = await this.page.evaluate((name, val, sels) => {
        // Estratégia 1: Tentar seletores CSS
        for (const selector of sels) {
          const input = document.querySelector(selector) as HTMLInputElement
          if (input && input.offsetParent !== null) {
            console.log(`[Browser] ✓ Campo encontrado via seletor: ${selector}`)
            
            input.removeAttribute('disabled')
            input.removeAttribute('readonly')
            input.focus()
            input.value = ''
            input.value = val
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
            input.dispatchEvent(new Event('blur', { bubbles: true }))
            
            console.log(`[Browser] ✓ Campo preenchido: ${name} = ${val}`)
            return true
          }
        }
        
        // Estratégia 2: Buscar por label
        const labels = Array.from(document.querySelectorAll('label'))
        for (const label of labels) {
          const text = label.textContent?.toLowerCase() || ''
          if (text.includes(name.toLowerCase())) {
            let input = label.querySelector('input') as HTMLInputElement
            
            if (!input) {
              input = label.nextElementSibling as HTMLInputElement
            }
            
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
        return true
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

      // Tentar múltiplas URLs de login do Internet Banking
      // A URL antiga pode ter sido descontinuada
      const loginUrls = [
        'https://internetbanking.itau.com.br/',
        'https://www.itau.com.br/conta-corrente/acesse-sua-conta/',
        'https://www.itau.com.br/',
        'https://banco.itau.com.br/'
      ]
      
      let finalUrl = ''
      let loginFound = false
      
      for (const loginUrl of loginUrls) {
        try {
          console.log(`[ItauScraper] 🌐 Tentando URL: ${loginUrl}`)
          
          await this.page.goto(loginUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
          })
          
          finalUrl = this.page.url()
          console.log(`[ItauScraper] ✅ Página carregada: ${finalUrl}`)
          
          // Verificar se não caiu em página de erro
          if (await this.isErrorPage()) {
            console.log(`[ItauScraper] ❌ URL ${loginUrl} redirecionou para 404, tentando próxima...`)
            continue
          }
          
          // Verificar se há campos de login
          const hasLoginFields = await this.page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'))
            const hasPasswordField = inputs.some(i => i.type === 'password')
            const hasTextField = inputs.some(i => ['text', 'tel', 'number'].includes(i.type))
            return hasPasswordField || hasTextField
          })
          
          if (hasLoginFields) {
            console.log(`[ItauScraper] ✅ URL de login encontrada: ${finalUrl}`)
            loginFound = true
            break
          } else {
            console.log(`[ItauScraper] ⚠️ URL ${loginUrl} não tem campos de login, tentando próxima...`)
          }
        } catch (error) {
          console.log(`[ItauScraper] ❌ Erro ao acessar ${loginUrl}:`, error)
          continue
        }
      }
      
      if (!loginFound) {
        throw new Error('Não foi possível encontrar página de login do Itaú. Todas as URLs tentadas retornaram erro ou não contêm campos de login.')
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Verificar se há iframes (login pode estar em iframe)
      await this.checkForIframes()
      
      // Verificar se há campos de login na página
      const hasLoginFields = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'))
        const hasPasswordField = inputs.some(i => i.type === 'password')
        const hasTextField = inputs.some(i => ['text', 'tel', 'number'].includes(i.type))
        return hasPasswordField || hasTextField
      })
      
      if (!hasLoginFields) {
        console.log('[ItauScraper] ⚠️ Página sem campos de login detectados')
        console.log('[ItauScraper] Tentando continuar mesmo assim...')
      }

      // PASSO 1: CPF ou CNPJ
      if (cnpj) {
        console.log('[ItauScraper] 📝 PASSO 1: Preenchendo CNPJ')
        await this.fillField('CNPJ', cnpj.replace(/\D/g, ''), [
          'input[name="cnpj"]',
          'input[id*="cnpj"]',
          'input[id*="CNPJ"]',
          'input[placeholder*="CNPJ"]',
          'input[placeholder*="cnpj"]'
        ])
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else if (cpf) {
        console.log('[ItauScraper] 📝 PASSO 1: Preenchendo CPF')
        await this.fillField('CPF', cpf.replace(/\D/g, ''), [
          'input[name="cpf"]',
          'input[id*="cpf"]',
          'input[id*="CPF"]',
          'input[placeholder*="CPF"]',
          'input[placeholder*="cpf"]',
          'input[type="text"][maxlength="11"]',
          'input[type="tel"][maxlength="11"]',
          'input[type="tel"]',
          'input[type="text"]'
        ])
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        throw new Error('CPF ou CNPJ não fornecido')
      }

      // PASSO 2: Continuar (ou pressionar Enter)
      console.log('[ItauScraper] 🔘 PASSO 2: Avançando...')
      
      // Tentar clicar em botão específico primeiro
      const continuarClicked = await this.clickElement('continuar') ||
                              await this.clickElement('próximo') ||
                              await this.clickElement('avançar')
      
      if (!continuarClicked) {
        console.log('[ItauScraper] ⚠️ Botão não encontrado, tentando Enter...')
        await this.pressEnter()
      }
      
      console.log('[ItauScraper] ⏳ Aguardando navegação...')
      await Promise.race([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
      
      const urlAfterContinue = this.page.url()
      console.log(`[ItauScraper] URL após continuar: ${urlAfterContinue}`)
      
      // Verificar se a URL mudou (indica que navegou)
      if (urlAfterContinue === finalUrl) {
        console.log('[ItauScraper] ⚠️ URL não mudou - pode estar em modal ou a navegação falhou')
      }
      
      // Verificar se não caiu em página de erro
      if (await this.isErrorPage()) {
        throw new Error('Redirecionado para página de erro após preencher CPF')
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000))

      // PASSO 3: Agência (apenas para PF)
      if (agency && cpf) {
        console.log('[ItauScraper] 📝 PASSO 3: Preenchendo Agência')
        await this.fillField('Agência', agency.replace(/\D/g, ''), [
          'input[name="agencia"]',
          'input[name="ag"]',
          'input[name="branch"]',
          'input[id*="agencia"]',
          'input[id*="ag"]',
          'input[id*="branch"]',
          'input[placeholder*="Agência"]',
          'input[placeholder*="agência"]',
          'input[placeholder*="Ag"]',
          'input[type="text"][maxlength="4"]',
          'input[type="number"][maxlength="4"]'
        ])
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // PASSO 4: Conta (apenas para PF)
      if (accountNumber && cpf) {
        console.log('[ItauScraper] 📝 PASSO 4: Preenchendo Conta')
        await this.fillField('Conta', accountNumber.replace(/\D/g, ''), [
          'input[name="conta"]',
          'input[name="account"]',
          'input[id*="conta"]',
          'input[id*="account"]',
          'input[placeholder*="Conta"]',
          'input[placeholder*="conta"]'
        ])
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // PASSO 5: Dígito (opcional)
      if (accountDigit && cpf) {
        console.log('[ItauScraper] 📝 PASSO 5: Tentando preencher Dígito...')
        try {
          await this.fillField('Dígito', accountDigit.replace(/\D/g, ''), [
            'input[name="digito"]',
            'input[name="dv"]',
            'input[id*="digito"]',
            'input[id*="dv"]',
            'input[placeholder*="Dígito"]',
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
        'input[id*="senha"]',
        'input[id*="password"]',
        'input[id*="pass"]'
      ])
      await new Promise(resolve => setTimeout(resolve, 1000))

      // PASSO 7: Entrar
      console.log('[ItauScraper] 🔘 PASSO 7: Fazendo login...')
      const entrarClicked = await this.clickElement('entrar') ||
                           await this.clickElement('acessar')
      
      if (!entrarClicked) {
        console.log('[ItauScraper] ⚠️ Botão Entrar não encontrado, tentando Enter...')
        await this.pressEnter()
      }

      console.log('[ItauScraper] ⏳ Aguardando login completar...')
      await Promise.race([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])

      // Verificar se login foi bem-sucedido
      const loginFinalUrl = this.page.url()
      if (await this.isErrorPage()) {
        throw new Error('Login falhou - redirecionado para página de erro')
      }

      // Verificar se precisa de 2FA
      if (this.credentials.twoFactorSecret) {
        await this.handle2FA()
      }

      // Verificar se está logado
      if (loginFinalUrl.includes('login') || loginFinalUrl.includes('acesse-sua-conta')) {
        throw new Error('Falha no login - ainda na página de login')
      }

      console.log('[ItauScraper] ========================================')
      console.log(`[ItauScraper] ✅ LOGIN CONCLUÍDO: ${loginFinalUrl}`)
      console.log('[ItauScraper] ========================================')

    } catch (error) {
      console.error('[ItauScraper] ❌ ERRO NO LOGIN:', error)
      
      try {
        if (this.page) {
          const url = this.page.url()
          const title = await this.page.title()
          console.log('[ItauScraper] 📍 Estado da página:', { url, title })
          
          // Capturar conteúdo da página para debug
          const bodyText = await this.page.evaluate(() => document.body.innerText.substring(0, 500))
          console.log('[ItauScraper] 📄 Conteúdo da página:', bodyText)
          
          // Listar todos os links visíveis
          const links = await this.page.$$eval('a', links =>
            links
              .filter((l: any) => l.offsetParent !== null)
              .slice(0, 20)
              .map((l: any) => ({
                text: l.textContent?.trim(),
                href: l.href
              }))
          )
          console.log('[ItauScraper] 🔗 Links visíveis na página:', links)
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
