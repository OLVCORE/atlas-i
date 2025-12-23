/**
 * MC10.0.1: HTTP Helper para chamadas Pluggy
 * 
 * Helper que obtém apiKey automaticamente e faz chamadas à API Pluggy
 * com header X-API-KEY configurado
 */

import { getPluggyApiKey } from './auth'

type PluggyFetchOptions = RequestInit & {
  path: string
}

/**
 * Faz requisição à API Pluggy com X-API-KEY configurado automaticamente
 * 
 * @param path Path da API (ex: '/connect_token')
 * @param options Opções de fetch (method, body, etc)
 * @returns Response da API Pluggy
 */
export async function pluggyFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  console.log(`[pluggy:http] Iniciando requisição para ${path}`, {
    method: options.method || 'GET',
    hasBody: !!options.body,
    bodyLength: options.body ? String(options.body).length : 0,
  })

  let apiKey: string
  try {
    apiKey = await getPluggyApiKey()
    console.log(`[pluggy:http] API key obtido com sucesso`, {
      apiKeyLength: apiKey?.length,
      apiKeyPrefix: apiKey?.substring(0, 8),
      path,
    })
  } catch (authError: any) {
    console.error(`[pluggy:http] Erro ao obter API key para ${path}:`, {
      error: authError?.message,
      stack: authError?.stack,
      path,
    })
    throw authError
  }

  const url = path.startsWith('https://') ? path : `https://api.pluggy.ai${path}`

  console.log(`[pluggy:http] Fazendo requisição para ${url}`, {
    method: options.method || 'GET',
    path,
  })

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  console.log(`[pluggy:http] Resposta recebida para ${path}:`, {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Erro desconhecido')
    let errorMessage = `Pluggy API error: ${response.status}`
    let errorDetails: any = {}
    
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = `Pluggy API error: ${response.status} ${JSON.stringify(errorJson)}`
      errorDetails = errorJson
    } catch {
      errorMessage = `Pluggy API error: ${response.status} ${errorText.substring(0, 100)}`
      errorDetails = { raw: errorText.substring(0, 500) }
    }
    
    console.error(`[pluggy:http] Erro na requisição ${path}:`, {
      status: response.status,
      statusText: response.statusText,
      path,
      url,
      method: options.method || 'GET',
      errorDetails,
      errorText: errorText.substring(0, 500),
      headers: Object.fromEntries(response.headers.entries()),
      apiKeyLength: apiKey?.length,
      apiKeyPrefix: apiKey?.substring(0, 8),
    })
    
    // Se for 403, pode ser:
    // 1. API key inválido/expirado
    // 2. Item não pertence à conta
    // 3. Permissões insuficientes
    // 4. Item revogado/expirado
    if (response.status === 403) {
      // Limpar cache para forçar nova autenticação na próxima chamada
      const { clearPluggyApiKeyCache } = await import('./auth')
      clearPluggyApiKeyCache()
      console.warn('[pluggy:http] Cache de API key limpo devido a erro 403', {
        path,
        url,
        method: options.method || 'GET',
        errorDetails,
        possibleCauses: [
          'API key inválido ou expirado',
          'Item não pertence à conta Pluggy configurada',
          'Item foi revogado ou expirado',
          'Conta em trial com limitações',
          'Credenciais PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET incorretas',
        ],
      })
    }
    
    throw new Error(errorMessage)
  }

  return response
}

