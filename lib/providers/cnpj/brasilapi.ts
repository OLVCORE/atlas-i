import type { CnpjProvider, CnpjProviderResult } from "./types"

export class BrasilApiProvider implements CnpjProvider {
  private readonly baseUrl = "https://brasilapi.com.br/api/cnpj/v1"

  async fetch(cnpj: string): Promise<CnpjProviderResult> {
    const normalizedCnpj = cnpj.replace(/\D/g, "")

    if (normalizedCnpj.length !== 14) {
      throw new Error("CNPJ deve ter 14 dígitos")
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    try {
      const url = `${this.baseUrl}/${normalizedCnpj}`
      console.log(`[BrasilAPI] Buscando CNPJ: ${url}`)
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "User-Agent": "ATLAS-i/1.0",
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorText = ""
        try {
          const errorData = await response.json()
          errorText = JSON.stringify(errorData)
        } catch {
          errorText = await response.text().catch(() => response.statusText)
        }
        
        console.error(`[BrasilAPI] Erro HTTP ${response.status}:`, errorText)
        
        if (response.status === 403) {
          throw new Error("Acesso negado à API. O serviço pode estar temporariamente indisponível ou bloqueando requisições. Você pode preencher os dados manualmente.")
        }
        if (response.status === 404) {
          throw new Error("CNPJ não encontrado")
        }
        if (response.status === 429) {
          throw new Error("Rate limit excedido. Tente novamente em alguns instantes.")
        }
        throw new Error(`Erro ao consultar CNPJ: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      console.log(`[BrasilAPI] Dados recebidos para CNPJ ${normalizedCnpj}`)
      
      // Log completo da estrutura CNAE para debug
      console.log('[BrasilAPI] Estrutura CNAE completa:', JSON.stringify({
        cnae_fiscal_principal: data.cnae_fiscal_principal,
        cnae_fiscal_codigo: data.cnae_fiscal_codigo,
        cnae_fiscal_descricao: data.cnae_fiscal_descricao,
      }, null, 2))

      return this.normalizeResponse(data)
    } catch (error: any) {
      clearTimeout(timeoutId)
      
      if (error.name === "AbortError") {
        console.error("[BrasilAPI] Timeout ao buscar CNPJ")
        throw new Error("Timeout ao consultar CNPJ. Tente novamente.")
      }
      
      console.error("[BrasilAPI] Erro ao buscar CNPJ:", error)
      throw error
    }
  }

  private normalizeResponse(data: any): CnpjProviderResult {
    return {
      legalName: data.razao_social || undefined,
      tradeName: data.nome_fantasia || undefined,
      status: data.descricao_situacao_cadastral || undefined,
      statusDate: data.data_situacao_cadastral || undefined,
      foundationDate: data.data_inicio_atividade || undefined,
      mainActivity: (() => {
        let code: string | undefined
        let text: string | undefined

        // Tentar extrair do objeto cnae_fiscal_principal primeiro (estrutura mais comum da BrasilAPI)
        if (data.cnae_fiscal_principal) {
          if (typeof data.cnae_fiscal_principal === 'object' && data.cnae_fiscal_principal !== null) {
            // Estrutura esperada: { codigo: "1234567", descricao: "..." }
            // Tentar todas as variações possíveis do código
            const rawCode = data.cnae_fiscal_principal.codigo ?? 
                           data.cnae_fiscal_principal.code ?? 
                           data.cnae_fiscal_principal.numero ??
                           data.cnae_fiscal_principal.id ??
                           data.cnae_fiscal_principal.cnae
            
            if (rawCode !== undefined && rawCode !== null && rawCode !== '' && rawCode !== 0) {
              code = String(rawCode).trim()
            }
            
            // Tentar todas as variações possíveis da descrição
            text = data.cnae_fiscal_principal.descricao ?? 
                   data.cnae_fiscal_principal.description ??
                   data.cnae_fiscal_principal.text ??
                   data.cnae_fiscal_principal.nome ??
                   undefined
            
            if (text) text = String(text).trim()
                   
            console.log('[BrasilAPI] Extraído de objeto cnae_fiscal_principal:', { 
              objeto: data.cnae_fiscal_principal,
              code, 
              text 
            })
          } else if (typeof data.cnae_fiscal_principal === 'string' || typeof data.cnae_fiscal_principal === 'number') {
            // Se for primitivo, usar como código
            code = String(data.cnae_fiscal_principal).trim()
            console.log('[BrasilAPI] CNAE como primitivo:', code)
          }
        }
        
        // Fallback 1: campos diretos no root (cnae_fiscal_codigo e cnae_fiscal_descricao)
        if (!code && data.cnae_fiscal_codigo !== undefined && data.cnae_fiscal_codigo !== null && data.cnae_fiscal_codigo !== '') {
          code = String(data.cnae_fiscal_codigo).trim()
          console.log('[BrasilAPI] Código de cnae_fiscal_codigo:', code)
        }
        
        if (!text && data.cnae_fiscal_descricao) {
          text = String(data.cnae_fiscal_descricao).trim()
          console.log('[BrasilAPI] Descrição de cnae_fiscal_descricao:', text)
        }
        
        // Fallback 2: cnaes_secundarios (primeiro item pode ser o principal em alguns casos)
        if (!code && Array.isArray(data.cnaes_secundarios) && data.cnaes_secundarios.length > 0) {
          const firstCnae = data.cnaes_secundarios[0]
          if (typeof firstCnae === 'object' && firstCnae !== null) {
            const rawCode = firstCnae.codigo ?? firstCnae.code ?? firstCnae.numero
            if (rawCode !== undefined && rawCode !== null && rawCode !== '') {
              code = String(rawCode).trim()
              console.log('[BrasilAPI] Código de cnaes_secundarios[0]:', code)
            }
            if (!text) {
              text = firstCnae.descricao ?? firstCnae.description ?? undefined
            }
          }
        }
        
        // Resultado final
        const result = (code || text) ? { code, text } : undefined
        console.log('[BrasilAPI] CNAE final extraído:', result)
        return result
      })(),
      address: {
        street: data.logradouro || undefined,
        number: data.numero || undefined,
        complement: data.complemento || undefined,
        district: data.bairro || undefined,
        city: data.municipio || undefined,
        state: data.uf || undefined,
        zip: data.cep?.replace(/\D/g, "") || undefined,
      },
      phone:
        data.ddd_telefone_1 && data.telefone_1
          ? `${data.ddd_telefone_1}${data.telefone_1}`.replace(/\D/g, "").slice(0, 11)
          : undefined,
      email: data.email || undefined,
      raw: data,
      provider: "brasilapi",
    }
  }
}

