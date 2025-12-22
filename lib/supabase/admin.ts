/**
 * MC9.0.2: Cliente Supabase Admin (Service Role)
 * 
 * IMPORTANTE: Este arquivo NUNCA deve ser importado em componentes client ou rotas públicas.
 * Use apenas em:
 * - Server Actions
 * - API Routes protegidas
 * - Background jobs/cron
 * 
 * Este cliente bypassa RLS e deve ser usado apenas para operações administrativas.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cria cliente Supabase com Service Role Key (bypassa RLS)
 * 
 * IMPORTANTE: Esta função só deve ser chamada em runtime (não durante build).
 * Ela valida as variáveis de ambiente apenas quando executada.
 * 
 * @throws Error se SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não estiverem definidos
 */
export function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não está definido')
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não está definido. Esta chave é obrigatória para operações administrativas.')
  }
  
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

