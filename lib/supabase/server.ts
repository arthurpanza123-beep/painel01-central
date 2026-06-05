/**
 * lib/supabase/server.ts
 *
 * Cliente Supabase para uso EXCLUSIVO no servidor (Route Handlers, Server
 * Components, Server Actions). Usa a service role key que bypassa RLS.
 *
 * REGRAS DE SEGURANÇA:
 * - NUNCA importar este arquivo em componentes com 'use client'.
 * - SUPABASE_SERVICE_ROLE_KEY nunca é exposta ao browser.
 * - Quando as envs não estiverem configuradas, retorna null e o
 *   chamador deve usar o fallback mock.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Indica se as variáveis de servidor do Supabase estão configuradas.
 */
export const isSupabaseServerConfigured =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.length > 0 &&
  typeof supabaseServiceRole === 'string' &&
  supabaseServiceRole.length > 0

let _serverClient: SupabaseClient | null = null

/**
 * Retorna um cliente Supabase admin (service role) para uso no servidor.
 * Retorna null se as envs não estiverem configuradas — nesse caso o
 * chamador deve usar o fallback mock.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseServerConfigured) return null
  if (!_serverClient) {
    _serverClient = createClient(supabaseUrl!, supabaseServiceRole!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _serverClient
}
