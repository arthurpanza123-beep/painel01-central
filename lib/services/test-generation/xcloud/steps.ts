import type { TestApp, TestGenerationStep } from '../types'

const XCLOUD_STEPS: TestGenerationStep[] = [
  { id: 'validating_client', label: 'validando cliente', status: 'done' },
  { id: 'requesting_provider_test', label: 'solicitando teste no Yellow/Ninety', status: 'done' },
  { id: 'receiving_xtream_credentials', label: 'recebendo credenciais Xtream', status: 'done' },
  { id: 'preparing_xcloud_access', label: 'preparando acesso XCloud', status: 'done' },
  { id: 'configuring_xcloud_device', label: 'configurando dispositivo XCloud', status: 'skipped' },
  { id: 'saving_supabase', label: 'salvando no Supabase', status: 'pending' },
  { id: 'preparing_message', label: 'preparando mensagem', status: 'done' },
]

const APP_STEPS: TestGenerationStep[] = [
  { id: 'validating_client', label: 'validando cliente', status: 'done' },
  { id: 'requesting_provider_test', label: 'solicitando teste no painel', status: 'done' },
  { id: 'receiving_app_credentials', label: 'recebendo usuário/senha/código', status: 'done' },
  { id: 'saving_supabase', label: 'salvando no Supabase', status: 'pending' },
  { id: 'preparing_message', label: 'preparando mensagem', status: 'done' },
]

export function buildGenerationSteps(app: TestApp): TestGenerationStep[] {
  return (app === 'xcloud' ? XCLOUD_STEPS : APP_STEPS).map((step) => ({ ...step }))
}
