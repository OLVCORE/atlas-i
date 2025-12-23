/**
 * MC10.0.1: Autenticação Pluggy (API Key)
 * 
 * IMPORTANTE: Este arquivo NUNCA deve ser importado em componentes client.
 * Use apenas em Server Actions e API Routes.
 * 
 * Variáveis de ambiente (server-only):
 * - PLUGGY_CLIENT_ID
 * - PLUGGY_CLIENT_SECRET
 */

type PluggyAuthResponse = {
  apiKey: string
}

// Cache em memória para apiKey (50 minutos)
type ApiKeyCache = {
  apiKey: string
  expiresAt: number
}

let apiKeyCache: ApiKeyCache | null = null
const CACHE_TTL_MS = 50 * 60 * 1000 // 50 minutos

/**
 * Obtém API Key do Pluggy (com cache de 50 minutos)
 * 
 * Faz POST https://api.pluggy.ai/auth com clientId e clientSecret
 * Retorna o apiKey que deve ser usado como X-API-KEY em chamadas subsequentes
 * 
 * @throws Error se PLUGGY_CLIENT_ID ou PLUGGY_CLIENT_SECRET não estiverem configurados
 */
export async function getPluggyApiKey(): Promise<string> {
  // Verificar cache
  if (apiKeyCache && apiKeyCache.expiresAt > Date.now()) {
    return apiKeyCache.apiKey
  }

  const clientId = process.env.PLUGGY_CLIENT_ID
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET

  // Log detalhado para debug (sem expor valores completos)
  console.log('[pluggy:auth] Verificando credenciais:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    clientIdLength: clientId?.length || 0,
    clientSecretLength: clientSecret?.length || 0,
    clientIdPrefix: clientId?.substring(0, 8) || 'N/A',
    clientSecretPrefix: clientSecret?.substring(0, 8) || 'N/A',
  })

  if (!clientId || !clientSecret) {
    throw new Error('PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET devem estar configurados')
  }

  try {
    console.log('[pluggy:auth] Fazendo requisição para https://api.pluggy.ai/auth')
    
    const response = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        clientSecret,
      }),
    })
    
    console.log('[pluggy:auth] Resposta recebida:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido')
      let errorDetails = `Pluggy auth failed: ${response.status}`
      
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = `Pluggy auth failed: ${response.status} ${JSON.stringify(errorJson)}`
        console.error('[pluggy:auth] Erro detalhado da API Pluggy:', {
          status: response.status,
          errorJson,
          errorText: errorText.substring(0, 500),
        })
      } catch {
        errorDetails = `Pluggy auth failed: ${response.status} ${errorText.substring(0, 100)}`
        console.error('[pluggy:auth] Erro ao obter API Key (texto):', {
          status: response.status,
          errorText: errorText.substring(0, 500),
        })
      }
      
      // Se for 401 ou 403, as credenciais podem estar incorretas
      // Limpar cache antes de lançar erro
      if (response.status === 401 || response.status === 403) {
        apiKeyCache = null // Limpar cache imediatamente
        console.warn('[pluggy:auth] Cache limpo devido a erro 401/403 na autenticação', {
          status: response.status,
          errorDetails,
        })
        
        // Mensagem mais específica baseada no status
        if (response.status === 401) {
          throw new Error(`pluggy_auth_error: Credenciais inválidas (401). Verifique se PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET estão corretos e se a conta Pluggy está ativa. Detalhes: ${errorDetails}`)
        } else {
          throw new Error(`pluggy_auth_error: Acesso negado (403). Verifique se PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET estão corretos e se a conta Pluggy tem permissões adequadas. Detalhes: ${errorDetails}`)
        }
      }
      
      throw new Error(errorDetails)
    }

    const data = (await response.json()) as PluggyAuthResponse

    if (!data.apiKey) {
      throw new Error('Pluggy auth response missing apiKey')
    }

    // Atualizar cache
    apiKeyCache = {
      apiKey: data.apiKey,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }

    return data.apiKey
  } catch (error) {
    if (error instanceof Error && error.message.includes('deve estar configurado')) {
      throw error
    }
    throw new Error(`Erro ao obter API Key do Pluggy: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}

/**
 * Limpa o cache de API Key (útil quando há erro 403 para forçar nova autenticação)
 */
export function clearPluggyApiKeyCache(): void {
  apiKeyCache = null
}

