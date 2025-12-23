/**
 * MC3.1b: Validação de variáveis de ambiente para conectores
 * MC10.0.1: Adiciona verificação específica para Pluggy
 * Retorna apenas flags (true/false), nunca valores reais
 */

export type EnvStatus = {
  hasProvider: boolean
  hasEnv: boolean
  hasClientId: boolean
  hasClientSecret: boolean
  hasWebhook: boolean
  hasPluggyCredentials: boolean // MC10.0.1: Pluggy específico
  provider?: string
  env?: string
}

/**
 * Valida presença de variáveis de ambiente relacionadas a conectores
 * Retorna apenas flags booleanas, nunca valores reais
 */
export function getEnvStatus(): EnvStatus {
  const provider = process.env.CONNECTORS_PROVIDER
  const env = process.env.CONNECTORS_ENV
  const clientId = process.env.CONNECTORS_CLIENT_ID
  const clientSecret = process.env.CONNECTORS_CLIENT_SECRET
  const webhookSecret = process.env.CONNECTORS_WEBHOOK_SECRET

  // MC10.0.1: Verificação específica para Pluggy
  const pluggyClientId = process.env.PLUGGY_CLIENT_ID
  const pluggyClientSecret = process.env.PLUGGY_CLIENT_SECRET
  const hasPluggyCredentials = !!(pluggyClientId && pluggyClientSecret)

  return {
    hasProvider: !!provider,
    hasEnv: !!env,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasWebhook: !!webhookSecret,
    hasPluggyCredentials, // MC10.0.1
    provider: provider || undefined,
    env: env || undefined,
  }
}

