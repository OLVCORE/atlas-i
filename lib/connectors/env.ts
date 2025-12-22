/**
 * MC3.1b: Validação de variáveis de ambiente para conectores
 * Retorna apenas flags (true/false), nunca valores reais
 */

export type EnvStatus = {
  hasProvider: boolean
  hasEnv: boolean
  hasClientId: boolean
  hasClientSecret: boolean
  hasWebhook: boolean
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

  return {
    hasProvider: !!provider,
    hasEnv: !!env,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasWebhook: !!webhookSecret,
    provider: provider || undefined,
    env: env || undefined,
  }
}

