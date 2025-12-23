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

  if (!clientId || !clientSecret) {
    throw new Error('PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET devem estar configurados')
  }

  try {
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

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido')
      let errorDetails = `Pluggy auth failed: ${response.status}`
      
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = `Pluggy auth failed: ${response.status} ${JSON.stringify(errorJson)}`
      } catch {
        errorDetails = `Pluggy auth failed: ${response.status} ${errorText.substring(0, 100)}`
      }
      
      console.error('[pluggy:auth] Erro ao obter API Key:', response.status, errorText.substring(0, 200))
      
      // Se for 401 ou 403, as credenciais podem estar incorretas
      // Limpar cache antes de lançar erro
      if (response.status === 401 || response.status === 403) {
        apiKeyCache = null // Limpar cache imediatamente
        console.warn('[pluggy:auth] Cache limpo devido a erro 401/403 na autenticação')
        throw new Error(`pluggy_auth_error: ${errorDetails}. Verifique se PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET estão corretos na Vercel`)
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

