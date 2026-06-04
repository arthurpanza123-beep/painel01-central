/**
 * lib/supabase/server.ts
 *
 * Cliente Supabase para uso no SERVIDOR (Server Components, Route Handlers,
 * Server Actions).
 *
 * ESTADO ATUAL: retorna null quando as envs não estão configuradas.
 * O painel continua funcionando 100% com mock neste caso.
 *
 * REGRAS DE SEGURANÇA:
 * - SUPABASE_SERVICE_ROLE_KEY concede acesso total ao banco, bypassando RLS.
 * - NUNCA exportar esta chave para o client-side.
 * - NUNCA importar este arquivo em componentes marcados com 'use client'.
 * - Usar apenas dentro de: app/api/**, server actions (use server), ou
 *   Server Components que não repassem o cliente para o browser.
 *
 * MIGRAÇÃO FUTURA: quando as envs estiverem configuradas, este arquivo
 * passa a retornar um cliente real com service role para queries internas.
 */

// Estas envs só existem no servidor — nunca expostas ao browser
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

/**
 * Retorna um cliente Supabase admin (service role) para uso no servidor.
 * Retorna null se as envs não estiverem configuradas.
 *
 * TODO (quando conectar banco real):
 *   import { createClient } from '@supabase/supabase-js'
 *   return createClient(supabaseUrl!, supabaseServiceRole!, {
 *     auth: { persistSession: false }
 *   })
 */
export function getSupabaseServerClient() {
  if (!isSupabaseServerConfigured) {
    return null
  }
  // TODO: substituir pelo cliente real quando instalar @supabase/supabase-js
  // return createClient(supabaseUrl!, supabaseServiceRole!, {
  //   auth: { persistSession: false }
  // })
  return null
}
