/**
 * lib/supabase/client.ts
 *
 * Cliente Supabase para uso no BROWSER (Client Components).
 *
 * ESTADO ATUAL: retorna null quando as envs não estão configuradas.
 * O painel continua funcionando 100% com mock neste caso.
 *
 * REGRAS DE SEGURANÇA:
 * - Usar SOMENTE NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY aqui.
 * - NUNCA importar SUPABASE_SERVICE_ROLE_KEY neste arquivo.
 * - O service role fica exclusivamente em lib/supabase/server.ts
 *
 * MIGRAÇÃO FUTURA: quando as envs estiverem configuradas, este cliente
 * será usado para queries de leitura autenticadas pelo usuário logado.
 */

// TODO: instalar @supabase/supabase-js quando conectar o banco real
// pnpm add @supabase/supabase-js

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Indica se as variáveis de ambiente do Supabase estão configuradas.
 * Usado pelos serviços para decidir entre mock e dados reais.
 */
export const isSupabaseConfigured =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.length > 0 &&
  typeof supabaseAnon === 'string' &&
  supabaseAnon.length > 0

/**
 * Retorna um cliente Supabase para o browser.
 * Retorna null se as envs não estiverem configuradas.
 *
 * TODO (quando conectar banco real):
 *   import { createBrowserClient } from '@supabase/ssr'
 *   return createBrowserClient(supabaseUrl!, supabaseAnon!)
 */
export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured) {
    return null
  }
  // TODO: substituir pelo cliente real quando instalar @supabase/ssr
  // return createBrowserClient(supabaseUrl!, supabaseAnon!)
  return null
}
