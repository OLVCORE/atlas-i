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
  const apiKey = await getPluggyApiKey()

  const url = path.startsWith('https://') ? path : `https://api.pluggy.ai${path}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Erro desconhecido')
    let errorMessage = `Pluggy API error: ${response.status}`
    
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = `Pluggy API error: ${response.status} ${JSON.stringify(errorJson)}`
    } catch {
      errorMessage = `Pluggy API error: ${response.status} ${errorText.substring(0, 100)}`
    }
    
    console.error(`[pluggy:http] Erro na requisição ${path}:`, response.status, errorText.substring(0, 200))
    
    // Se for 403, limpar cache de API key (pode estar expirado ou inválido)
    if (response.status === 403) {
      // Limpar cache para forçar nova autenticação na próxima chamada
      const { clearPluggyApiKeyCache } = await import('./auth')
      clearPluggyApiKeyCache()
      console.warn('[pluggy:http] Cache de API key limpo devido a erro 403')
    }
    
    throw new Error(errorMessage)
  }

  return response
}

