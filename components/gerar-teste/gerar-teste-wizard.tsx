'use client'

import { useState, useEffect } from 'react'
import { m as motion, AnimatePresence } from 'framer-motion'
import {
  Copy, CheckCircle, ArrowRight, ArrowLeft,
  RotateCcw, Zap, Server, User, Phone, ChevronDown,
  ExternalLink, PlayCircle, FileText, X
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
type WizardStep = 1 | 2 | 3 | 4
type ProcessStep = 'gerando' | 'sucesso'
type GenerationStepStatus = 'pending' | 'running' | 'done' | 'failed'
type GenerationProgressStep = { id: string; label: string; status: GenerationStepStatus }

interface FormData {
  nome: string
  telefone: string
  app: string
  servidor: string
  deviceKey: string
}

interface TesteGerado {
  id: string
  clientId?: string
  pedido: string
  host: string
  codigo: string
  usuario: string
  senha: string
  validade: string
  mensagem: string
  deviceKey?: string
  xcloudWorker?: {
    status: string
    stage: string
    device_added: boolean
    device_found?: boolean
    device_deactivated?: boolean
    device_deleted?: boolean
    device_recreated?: boolean
    device_already_exists?: boolean
    xtream_attached: boolean
    confirmation_found: boolean
    log_id?: string | null
    screenshot_path?: string | null
    message?: string
  }
  dispatch?: {
    status?: string
    ok?: boolean
    dry_run?: boolean
    code?: string | null
    message?: string | null
    idempotency_key?: string
  }
  /** Indica de onde vieram os dados: gravou no Supabase ou apenas mock local */
  source: 'supabase' | 'mock'
}

// ----------------------------------------------------------------
// Config: apps e servidores com compatibilidade
// ----------------------------------------------------------------
const APPS = [
  {
    id: 'xcloud',
    label: 'XCloud',
    badge: 'PREMIUM',
    badgeColor: '#14b8a6',
    color: '#14b8a6',
    glow: '20,184,166',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/140bd867-bdd4-43d8-9369-ae5c22b722b1-bivziPC07NHSLi0lwTyEWq4Xwga3zK.png',
    servidorPadrao: 'yellow',
    servidoresCompativeis: ['ninety', 'yellow'],
  },
  {
    id: 'blessed',
    label: 'Blessed Player',
    badge: 'MAIS USADO',
    badgeColor: '#ef4444',
    color: '#ef4444',
    glow: '239,68,68',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/e6b8d7cc-a704-4554-89fc-6814c8a7c0dd-q6yOM0urLpFNKiSldupFpDvipZnFVy.png',
    servidorPadrao: 'yellow',
    servidoresCompativeis: ['yellow', 'cinemax'],
  },
  {
    id: 'playsim',
    label: 'PlaySim',
    badge: 'LEVE',
    badgeColor: '#f97316',
    color: '#f97316',
    glow: '249,115,22',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-9cnCrfCm5sltPhvF9J8wZrEp42Ech7.png',
    servidorPadrao: 'yellow',
    servidoresCompativeis: ['yellow', 'ninety'],
  },
]

const SERVIDORES = [
  {
    id: 'yellow',
    label: 'Yellow Box',
    sub: 'Estável',
    color: '#84cc16',
    glow: '132,204,22',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4f976bbd-b9a0-4464-9345-faab1188d991-GeKdgGIvSt1FeZn9dfhIMTy2s92JaX.png',
    status: 'Online',
  },
  {
    id: 'ninety',
    label: 'Ninety',
    sub: 'Premium',
    color: '#a855f7',
    glow: '168,85,247',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/a8543a86-94bc-4402-80d8-b537ec48807f-keJkJzA3chubyxn9bwE7Wg1JEytlwW.png',
    status: 'Online',
  },
  {
    id: 'cinemax',
    label: 'CineplayX',
    sub: 'Cinema',
    color: '#f97316',
    glow: '249,115,22',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/367753a2-c091-4207-96fb-08efbb3ce78d-oKHw7v46xS8SBH0hDTQDXACYsUMivv.png',
    status: 'Online',
  },
]

// Etapas de geração mais detalhadas (melhoria #7)
const ETAPAS_GERACAO = [
  { id: 'validando',   label: 'Validando cliente' },
  { id: 'acesso',      label: 'Gerando acesso' },
  { id: 'playlist',    label: 'Obtendo playlist' },
  { id: 'dispositivo', label: 'Criando device XCloud' },
  { id: 'servidor',    label: 'Vinculando servidor Xtream' },
  { id: 'reload',      label: 'Confirmando RELOAD' },
  { id: 'mensagem',    label: 'Preparando mensagem' },
  { id: 'concluido',   label: 'Concluído' },
]

function initialGenerationSteps(): GenerationProgressStep[] {
  return ETAPAS_GERACAO.map((step, index) => ({ ...step, status: index === 0 ? 'running' : 'pending' }))
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function gerarDadosFake(form: FormData): TesteGerado {
  const rand = () => Math.random().toString(36).substring(2, 8).toUpperCase()
  const usuario = `usr_${form.nome.split(' ')[0].toLowerCase()}${Math.floor(Math.random() * 999)}`
  const senha = `${rand()}${rand()}`.substring(0, 10)
  const codigo = `#${String(Math.floor(Math.random() * 9000) + 1000)}`
  const agora = new Date()
  agora.setHours(agora.getHours() + 2)
  const validade = agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const appLabel = APPS.find((a) => a.id === form.app)?.label ?? form.app
  const servidorLabel = SERVIDORES.find((s) => s.id === form.servidor)?.label ?? form.servidor
  const mensagem = `Olá ${form.nome}! Segue seu teste de 2 horas:\n\nAplicativo: ${appLabel}\nServidor: ${servidorLabel}\nUsuário: ${usuario}\nSenha: ${senha}\nCódigo: ${codigo}\nValidade: ${validade}\n\nQualquer dúvida é só chamar!`
  return { id: '', pedido: codigo, host: 'mock-yellowbox.local', codigo, usuario, senha, validade, mensagem, deviceKey: form.deviceKey, source: 'mock' }
}

function formatDateTime(value: string): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function normalizeXcloudWorker(data: Record<string, unknown> | null | undefined, fallbackStage = 'GenerateAccess'): TesteGerado['xcloudWorker'] | undefined {
  if (!data) return undefined
  return {
    status: String(data.status || (data.success ? 'success' : 'failed')),
    stage: String(data.stage || fallbackStage),
    device_added: Boolean(data.device_added),
    device_found: Boolean(data.device_found),
    device_deactivated: Boolean(data.device_deactivated),
    device_deleted: Boolean(data.device_deleted),
    device_recreated: Boolean(data.device_recreated),
    device_already_exists: Boolean(data.device_already_exists),
    xtream_attached: Boolean(data.xtream_attached),
    confirmation_found: Boolean(data.confirmation_found),
    log_id: typeof data.log_id === 'string' ? data.log_id : null,
    screenshot_path: typeof data.screenshot_path === 'string' ? data.screenshot_path : null,
    message: String(data.message || data.error || (data.status === 'disabled' ? 'Worker XCloud desativado no servidor' : '') || '') || undefined,
  }
}

function pendingXcloudWorker(): TesteGerado['xcloudWorker'] {
  return {
    status: 'pending',
    stage: 'AddXcloudDevice',
    device_added: false,
    xtream_attached: false,
    confirmation_found: false,
    message: 'Worker XCloud aguardando fallback manual.',
  }
}

// ----------------------------------------------------------------
// Neon animated background (com partículas)
// ----------------------------------------------------------------
function NeonBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute hidden rounded-full md:block"
        style={{
          width: 620,
          height: 620,
          top: '-12%',
          left: '-15%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, rgba(37,99,235,0.02) 55%, transparent 70%)',
        }}
      />
      <div
        className="absolute hidden rounded-full md:block"
        style={{
          width: 480,
          height: 480,
          top: '8%',
          right: '-12%',
          background: 'radial-gradient(circle, rgba(20,184,166,0.06) 0%, rgba(20,184,166,0.02) 55%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  )
}

// ----------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------
export function GerarTesteWizard() {
  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [processStep, setProcessStep] = useState<ProcessStep | null>(null)
  const [form, setForm] = useState<FormData>({ nome: '', telefone: '', app: '', servidor: '', deviceKey: '' })
  const [generationSteps, setGenerationSteps] = useState<GenerationProgressStep[]>(initialGenerationSteps)
  const [teste, setTeste] = useState<TesteGerado | null>(null)
  const [copied, setCopied] = useState(false)
  const [mostrarServidores, setMostrarServidores] = useState(false)
  const [confirmarRecriacaoXcloud, setConfirmarRecriacaoXcloud] = useState(false)
  const [recriandoXcloud, setRecriandoXcloud] = useState(false)
  const [executandoXcloud, setExecutandoXcloud] = useState(false)
  // slide direction: 1 = avançar (esquerda→direita), -1 = voltar
  const [direction, setDirection] = useState<1 | -1>(1)
  const { addToast } = useToast()

  useEffect(() => {
    if (form.app) {
      const appSelecionado = APPS.find(a => a.id === form.app)
      if (appSelecionado && !form.servidor) {
        setForm(prev => ({ ...prev, servidor: appSelecionado.servidorPadrao }))
      }
    }
  }, [form.app, form.servidor])

  useEffect(() => {
    if (processStep !== 'gerando') return
    let alive = true
    const operatorRef = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    setGenerationSteps(initialGenerationSteps())

    const fetchTeste = async (): Promise<TesteGerado | null> => {
      try {
        const res = await fetch('/api/tests/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: form.nome,
            phone: form.telefone,
            app_key: form.app,
            panel_key: form.servidor,
            device_key: form.app === 'xcloud' ? form.deviceKey : undefined,
            operator_ref: operatorRef,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
        if (!data.success) throw new Error(data.error ?? 'Erro desconhecido')
        const xcloudWorker: TesteGerado['xcloudWorker'] | undefined = form.app === 'xcloud' && data.test.id
          ? normalizeXcloudWorker(data.test.xcloud_worker, 'Completed') || pendingXcloudWorker()
          : undefined

        return {
          id:       data.test.id,
          clientId: data.test.client_id || data.client?.id || undefined,
          pedido:   data.test.pedido || data.test.order_id || '',
          host:     data.test.host || data.test.dns || '',
          codigo:   data.test.provider_code || data.test.code || '',
          usuario:  data.test.username || '',
          senha:    data.test.password || '',
          validade: formatDateTime(data.test.expires_at || data.test.validade || ''),
          mensagem: data.test.mensagem,
          deviceKey: data.test.device_key || undefined,
          xcloudWorker,
          dispatch: data.test.dispatch || undefined,
          source:   data.source,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao gerar teste'
        console.error('[wizard] Falha ao gerar teste:', err)
        addToast('error', message)
        return null
      }
    }

    const pollProgress = async () => {
      try {
        const res = await fetch(`/api/tests/create/progress?operator_ref=${encodeURIComponent(operatorRef)}`, { cache: 'no-store' })
        const data = await res.json().catch(() => null)
        if (!alive || !data?.ok || !Array.isArray(data.steps)) return
        setGenerationSteps(data.steps)
      } catch {
        // The create request remains authoritative; polling is only for UI progress.
      }
    }

    const interval = setInterval(pollProgress, 1000)
    pollProgress()

    ;(async () => {
      const resultado = await fetchTeste()
      await pollProgress()
      clearInterval(interval)
      if (!alive) return
      if (!resultado) {
        setProcessStep(null)
        return
      }
      setGenerationSteps(ETAPAS_GERACAO.map((step) => ({ ...step, status: 'done' })))
      setTeste(resultado)
      setProcessStep('sucesso')
    })()

    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [processStep, form])

  const canProceed = (step: WizardStep): boolean => {
  switch (step) {
  case 1: return !!form.nome.trim() && !!form.telefone.trim()
  case 2: return !!form.app
  case 3: return !!form.servidor
  default: return true
  }
  }

  const handleNext = () => {
    if (wizardStep < 4 && canProceed(wizardStep)) {
      setDirection(1)
      setWizardStep((prev) => (prev + 1) as WizardStep)
    }
  }

  const handleBack = () => {
    if (wizardStep > 1) {
      setDirection(-1)
      setWizardStep((prev) => (prev - 1) as WizardStep)
    }
  }

  const handleGerar = () => {
    if (!canProceed(3)) {
      addToast('error', 'Preencha todos os campos')
      return
    }
    if (form.app === 'xcloud' && !form.deviceKey.trim()) {
      addToast('error', 'Informe a device key do XCloud')
      return
    }
    setProcessStep('gerando')
  }

  const handleCopiar = () => {
    if (!teste) return
    navigator.clipboard.writeText(teste.mensagem)
    setCopied(true)
    addToast('success', 'Mensagem copiada!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAbrirPainel2 = () => {
    if (!teste?.id) {
      window.open('https://painel2.centralplayplus.com.br', '_blank')
      return
    }
    const params = new URLSearchParams({
      source: 'painel1',
      test_id: teste.id,
      ...(teste.clientId ? { client_id: teste.clientId } : {}),
      client_name: form.nome,
      client_phone: form.telefone,
      app: form.app,
      panel: form.servidor,
      flow: 'test_created',
    })
    if (form.app === 'xcloud' && form.deviceKey) {
      params.set('device_key', form.deviceKey)
    }
    window.open(`https://painel2.centralplayplus.com.br?${params.toString()}`, '_blank')
  }

  const handleConcluir = async () => {
    if (!teste?.id) return
    if (teste.dispatch?.ok && teste.dispatch.status !== 'failed') {
      addToast('success', teste.dispatch.dry_run ? 'Mensagem preparada no Painel 2' : 'Mensagem de teste já enviada')
      handleNovoTeste()
      return
    }
    try {
      const res = await fetch('/api/flows/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: 'test_created',
          phone: form.telefone,
          idempotency_key: teste.dispatch?.idempotency_key || `test_created:${teste.id}`,
          client: { name: form.nome, phone: form.telefone },
          test: {
            id: teste.id,
            app: APPS.find((item) => item.id === form.app)?.label || form.app,
            panel: SERVIDORES.find((item) => item.id === form.servidor)?.label || form.servidor,
            pedido: teste.pedido,
            host: teste.host,
            username: teste.usuario,
            password: teste.senha,
            code: teste.codigo,
          },
          context: {
            source: 'painel1',
            operator_ref: 'painel_web',
            test_id: teste.id,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || `HTTP ${res.status}`)
      addToast('success', data?.dryRun ? 'Preview gerado no Painel 2 (dry-run: WhatsApp não enviado)' : `Mensagem de teste enviada (${data?.code || 'SENT'})`)
      handleNovoTeste()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Falha ao disparar flow no Painel 2')
    }
  }

  const handleAtivarCliente = () => {
    if (!teste?.id) return
    window.dispatchEvent(new CustomEvent('centralplay:navigate', { detail: { page: 'ativar-clientes', test_id: teste.id } }))
    addToast('success', 'Abrindo ativação do cliente')
  }

  const handleVerLog = () => {
    window.dispatchEvent(new CustomEvent('centralplay:navigate', { detail: { page: 'debug', test_id: teste?.id } }))
    addToast('success', 'Abrindo log')
  }

  const handleRetryXcloud = async () => {
    if (!teste?.id || executandoXcloud) return
    const retryStage = teste.xcloudWorker?.stage === 'AttachXtreamCredentials' ? 'AttachXtreamCredentials' : 'AddXcloudDevice'
    const shouldSendRetryStage = teste.xcloudWorker?.status !== 'pending' && teste.xcloudWorker?.status !== 'disabled'
    setExecutandoXcloud(true)
    setTeste({
      ...teste,
      xcloudWorker: {
        ...(teste.xcloudWorker || pendingXcloudWorker())!,
        status: 'running',
        stage: shouldSendRetryStage ? retryStage : 'AddXcloudDevice',
        message: 'Executando XCloud real...',
      },
    })
    try {
      const res = await fetch('/api/xcloud/activate-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_id: teste.id,
          ...(shouldSendRetryStage ? { retry_stage: retryStage } : {}),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!data) throw new Error('Resposta vazia do Worker XCloud')
      const normalized = normalizeXcloudWorker(data, retryStage)!
      setTeste((prev) => prev ? {
        ...prev,
        xcloudWorker: {
          ...normalized,
          message: normalized.status === 'failed' ? `XCloud falhou na etapa: ${normalized.stage}` : normalized.message,
        },
      } : prev)
      addToast(data.success ? 'success' : 'error', data.success ? 'Worker XCloud executado' : `XCloud falhou na etapa: ${data.stage || retryStage}`)
    } catch (err) {
      setTeste((prev) => prev ? {
        ...prev,
        xcloudWorker: {
          ...(prev.xcloudWorker || pendingXcloudWorker())!,
          status: 'failed',
          stage: retryStage,
          message: err instanceof Error ? err.message : `XCloud falhou na etapa: ${retryStage}`,
        },
      } : prev)
      addToast('error', err instanceof Error ? err.message : 'Worker XCloud falhou')
    } finally {
      setExecutandoXcloud(false)
    }
  }

  const handleRecriarXcloud = async () => {
    if (!teste?.id || recriandoXcloud) return
    setRecriandoXcloud(true)
    setConfirmarRecriacaoXcloud(false)
    setTeste({
      ...teste,
      xcloudWorker: {
        ...(teste.xcloudWorker || {
          status: 'running',
          stage: 'FindXcloudDevice',
          device_added: false,
          xtream_attached: false,
          confirmation_found: false,
        }),
        status: 'running',
        stage: 'FindXcloudDevice',
        message: 'Recriando device XCloud...',
      },
    })
    const res = await fetch('/api/xcloud/activate-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_id: teste.id, mode: 'recreate_device', confirm_recreate: true }),
    })
    const data = await res.json().catch(() => null)
    setRecriandoXcloud(false)
    if (!data) {
      addToast('error', 'Worker XCloud falhou')
      return
    }
    setTeste((prev) => prev ? {
      ...prev,
      xcloudWorker: {
        status: data.status || (data.success ? 'success' : 'failed'),
        stage: data.stage || 'FindXcloudDevice',
        device_added: Boolean(data.device_added),
        device_found: Boolean(data.device_found),
        device_deactivated: Boolean(data.device_deactivated),
        device_deleted: Boolean(data.device_deleted),
        device_recreated: Boolean(data.device_recreated),
        device_already_exists: Boolean(data.device_already_exists),
        xtream_attached: Boolean(data.xtream_attached),
        confirmation_found: Boolean(data.confirmation_found),
        log_id: data.log_id || null,
        screenshot_path: data.screenshot_path || null,
        message: data.message || data.error || undefined,
      },
    } : prev)
    addToast(data.success ? 'success' : 'error', data.success ? 'Device XCloud recriada' : 'Recriação XCloud falhou')
  }

  const handleModoManual = () => {
    addToast('info', 'Modo manual: use os dados gerados para configurar o XCloud diretamente no painel.')
  }

  const handleNovoTeste = () => {
    setProcessStep(null)
    setWizardStep(1)
    setDirection(1)
    setForm({ nome: '', telefone: '', app: '', servidor: '', deviceKey: '' })
    setGenerationSteps(initialGenerationSteps())
    setTeste(null)
    setCopied(false)
    setMostrarServidores(false)
    setConfirmarRecriacaoXcloud(false)
    setRecriandoXcloud(false)
    setExecutandoXcloud(false)
  }

  if (processStep) {
    return (
      <div className="relative flex-1 min-h-screen overflow-hidden">
        <NeonBackground />
        <AnimatePresence mode="wait">
          {processStep === 'gerando' && (
            <motion.div
              key="gerando"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(7,10,18,0.97)' }}
            >
              <TelaGerando steps={generationSteps} form={form} />
            </motion.div>
          )}
          {processStep === 'sucesso' && teste && (
            <motion.div
              key="sucesso"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
              style={{ background: 'rgba(7,10,18,0.97)' }}
            >
              <TelaSucesso
                form={form}
                teste={teste}
                copied={copied}
                onCopiar={handleCopiar}
                onConcluir={handleConcluir}
                onAbrirPainel2={handleAbrirPainel2}
                onAtivarCliente={handleAtivarCliente}
                onVerLog={handleVerLog}
                onRetryXcloud={handleRetryXcloud}
                onSolicitarRecriacaoXcloud={() => setConfirmarRecriacaoXcloud(true)}
                onCancelarRecriacaoXcloud={() => setConfirmarRecriacaoXcloud(false)}
                onConfirmarRecriacaoXcloud={handleRecriarXcloud}
                confirmarRecriacaoXcloud={confirmarRecriacaoXcloud}
                recriandoXcloud={recriandoXcloud}
                executandoXcloud={executandoXcloud}
                onModoManual={handleModoManual}
                onNovo={handleNovoTeste}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Variantes de slide com direção (melhoria #6)
  const slideVariants = {
    enter: (d: number) => ({ opacity: 0, x: d * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -40 }),
  }

  return (
    <div className="relative flex-1 min-h-screen overflow-hidden">
      <NeonBackground />
      <div className="relative flex flex-col items-center justify-center min-h-screen p-4" style={{ zIndex: 1 }}>

        {/* Stepper — melhoria #3: números maiores, labels maiores */}
        <div className="mb-10 w-full max-w-xl">
          <div className="flex items-center justify-between mb-3">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full font-bold transition-all duration-300',
                    wizardStep === step
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : wizardStep > step
                        ? 'bg-emerald-500 text-white'
                        : 'bg-card border border-border text-muted-foreground'
                  )}
                  style={{ fontSize: 16 }}
                >
                  {wizardStep > step ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    step
                  )}
                </div>
                {step < 4 && (
                  <div
                    className={cn(
                      'h-1 rounded-full transition-all duration-500',
                      'w-14 sm:w-20 md:w-24 mx-1.5',
                      wizardStep > step ? 'bg-emerald-500' : 'bg-border'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between px-1" style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em' }}>
            <span>Dados</span>
            <span>App</span>
            <span>Servidor</span>
            <span>Gerar</span>
          </div>
        </div>

        {/* Cards — melhoria #1: max-w maior */}
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={direction}>
            {wizardStep === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <StepDados form={form} onChange={setForm} onNext={handleNext} canProceed={canProceed(1)} />
              </motion.div>
            )}
            {wizardStep === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <StepApp form={form} onChange={setForm} onNext={handleNext} onBack={handleBack} canProceed={canProceed(2)} />
              </motion.div>
            )}
            {wizardStep === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <StepServidor
                  form={form}
                  onChange={setForm}
                  onNext={handleNext}
                  onBack={handleBack}
                  canProceed={canProceed(3)}
                  mostrarServidores={mostrarServidores}
                  setMostrarServidores={setMostrarServidores}
                />
              </motion.div>
            )}
            {wizardStep === 4 && (
              <motion.div
                key="step4"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <StepConfirmar form={form} onChange={setForm} onBack={handleBack} onGerar={handleGerar} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Step 1: Dados do Cliente — melhoria #9: titulo "Novo teste"
// ----------------------------------------------------------------
function StepDados({
  form,
  onChange,
  onNext,
  canProceed,
}: {
  form: FormData
  onChange: (f: FormData) => void
  onNext: () => void
  canProceed: boolean
}) {
  return (
    <WizardCard>
      <div className="flex items-center gap-3.5 mb-7">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.25)',
            boxShadow: '0 0 22px rgba(59,130,246,0.18)',
          }}
        >
          <User style={{ width: 23, height: 23, color: '#60a5fa' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Novo teste
          </h1>
          <p className="text-sm text-muted-foreground">Informe os dados para gerar o acesso.</p>
        </div>
      </div>

      <div className="space-y-4">
        <InputField
          icon={<User className="h-[18px] w-[18px]" />}
          label="Nome do cliente"
          placeholder="João Silva"
          value={form.nome}
          onChange={(val) => onChange({ ...form, nome: val })}
        />
        <InputField
          icon={<Phone className="h-[18px] w-[18px]" />}
          label="Telefone"
          placeholder="(22) 99999-9999"
          type="tel"
          value={form.telefone}
          onChange={(val) => onChange({ ...form, telefone: val })}
        />
      </div>

      <div className="mt-8">
        <PrimaryButton onClick={onNext} disabled={!canProceed}>
          Continuar
          <ArrowRight className="h-[18px] w-[18px] ml-2" />
        </PrimaryButton>
      </div>
    </WizardCard>
  )
}

// ----------------------------------------------------------------
// Step 2: Escolher App
// ----------------------------------------------------------------
function StepApp({
  form,
  onChange,
  onNext,
  onBack,
  canProceed,
}: {
  form: FormData
  onChange: (f: FormData) => void
  onNext: () => void
  onBack: () => void
  canProceed: boolean
}) {
  return (
    <WizardCard>
      <div className="flex items-center gap-3.5 mb-7">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.25)',
            boxShadow: '0 0 22px rgba(239,68,68,0.18)',
          }}
        >
          <Zap style={{ width: 23, height: 23, color: '#f87171' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Escolha o aplicativo
          </h1>
          <p className="text-sm text-muted-foreground">Qual app {form.nome.split(' ')[0]} vai usar?</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {APPS.map((app) => (
          <AppCard
            key={app.id}
            selected={form.app === app.id}
            color={app.color}
            glow={app.glow}
            image={app.image}
            label={app.label}
            badge={app.badge}
            badgeColor={app.badgeColor}
            onClick={() => onChange({ ...form, app: app.id, servidor: '' })}
          />
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <SecondaryButton onClick={onBack}>
          <ArrowLeft className="h-[18px] w-[18px] mr-1.5" />
          Voltar
        </SecondaryButton>
        <PrimaryButton onClick={onNext} disabled={!canProceed} className="flex-1">
          Continuar
          <ArrowRight className="h-[18px] w-[18px] ml-2" />
        </PrimaryButton>
      </div>
    </WizardCard>
  )
}

// ----------------------------------------------------------------
// Step 3: Servidor (com recomendação automática)
// ----------------------------------------------------------------
function StepServidor({
  form,
  onChange,
  onNext,
  onBack,
  canProceed,
  mostrarServidores,
  setMostrarServidores,
}: {
  form: FormData
  onChange: (f: FormData) => void
  onNext: () => void
  onBack: () => void
  canProceed: boolean
  mostrarServidores: boolean
  setMostrarServidores: (v: boolean) => void
}) {
  const appSelecionado = APPS.find(a => a.id === form.app)
  const servidorSelecionado = SERVIDORES.find(s => s.id === form.servidor)
  const servidoresCompativeis = appSelecionado?.servidoresCompativeis || []

  return (
    <WizardCard>
      <div className="flex items-center gap-3.5 mb-7">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'rgba(168,85,247,0.12)',
            border: '1px solid rgba(168,85,247,0.25)',
            boxShadow: '0 0 22px rgba(168,85,247,0.18)',
          }}
        >
          <Server style={{ width: 23, height: 23, color: '#c084fc' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Servidor
          </h1>
          <p className="text-sm text-muted-foreground">Selecionado automaticamente</p>
        </div>
      </div>

      {servidorSelecionado && !mostrarServidores && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-2.5">
            Servidor recomendado
          </p>
          <ServidorCard
            selected={true}
            color={servidorSelecionado.color}
            glow={servidorSelecionado.glow}
            image={servidorSelecionado.image}
            label={servidorSelecionado.label}
            sub={servidorSelecionado.sub}
            status={servidorSelecionado.status}
            onClick={() => {}}
          />
          <button
            onClick={() => setMostrarServidores(true)}
            className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Alterar servidor
          </button>
        </div>
      )}

      {mostrarServidores && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
            Servidores compatíveis com {appSelecionado?.label}
          </p>
          {SERVIDORES.filter(s => servidoresCompativeis.includes(s.id)).map((s) => (
            <ServidorCard
              key={s.id}
              selected={form.servidor === s.id}
              color={s.color}
              glow={s.glow}
              image={s.image}
              label={s.label}
              sub={s.sub}
              status={s.status}
              onClick={() => {
                onChange({ ...form, servidor: s.id })
                setMostrarServidores(false)
              }}
              isRecommended={s.id === appSelecionado?.servidorPadrao}
            />
          ))}
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <SecondaryButton onClick={onBack}>
          <ArrowLeft className="h-[18px] w-[18px] mr-1.5" />
          Voltar
        </SecondaryButton>
        <PrimaryButton onClick={onNext} disabled={!canProceed} className="flex-1">
          Continuar
          <ArrowRight className="h-[18px] w-[18px] ml-2" />
        </PrimaryButton>
      </div>
    </WizardCard>
  )
}

// ----------------------------------------------------------------
// Step 4: Confirmar e Gerar
// ----------------------------------------------------------------
function StepConfirmar({
  form,
  onChange,
  onBack,
  onGerar,
}: {
  form: FormData
  onChange: (f: FormData) => void
  onBack: () => void
  onGerar: () => void
}) {
  const appSelecionado = APPS.find(a => a.id === form.app)
  const servidorSelecionado = SERVIDORES.find(s => s.id === form.servidor)

  return (
    <WizardCard>
      <div className="flex items-center gap-3.5 mb-7">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.25)',
            boxShadow: '0 0 22px rgba(34,197,94,0.18)',
          }}
        >
          <Zap style={{ width: 23, height: 23, color: '#4ade80' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Gerar teste
          </h1>
          <p className="text-sm text-muted-foreground">Confirme os dados antes de gerar</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-7">
        <ResumoItem label="Cliente" value={form.nome} />
        <ResumoItem label="Telefone" value={form.telefone} />
        <ResumoItem label="Aplicativo" value={appSelecionado?.label || ''} />
        <ResumoItem label="Servidor" value={servidorSelecionado?.label || ''} />
      </div>

      {form.app === 'xcloud' && (
        <div className="mb-7">
          <InputField
            icon={<Zap className="h-[18px] w-[18px]" />}
            label="Device key XCloud"
            placeholder="Informe a chave do dispositivo"
            value={form.deviceKey}
            onChange={(val) => onChange({ ...form, deviceKey: val })}
          />
        </div>
      )}

      <div className="flex gap-3">
        <SecondaryButton onClick={onBack}>
          <ArrowLeft className="h-[18px] w-[18px] mr-1.5" />
          Voltar
        </SecondaryButton>
        <button
          onClick={onGerar}
          className="relative flex-1 overflow-hidden rounded-xl font-bold text-white transition-all duration-200"
          style={{
            height: 56,
            fontSize: 15,
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
            boxShadow: '0 0 0 1px rgba(34,197,94,0.3), 0 6px 28px rgba(34,197,94,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
            fontFamily: 'var(--font-display)',
          }}
        >
          <span
            className="pointer-events-none absolute inset-y-0 left-[-75%] w-1/2 skew-x-[-20deg]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
              animation: 'shineSweep 3.5s ease-in-out infinite',
            }}
          />
          <span className="relative flex items-center justify-center gap-2.5">
            <Zap className="h-[20px] w-[20px]" />
            Gerar teste
          </span>
        </button>
      </div>
    </WizardCard>
  )
}

// ----------------------------------------------------------------
// Tela Gerando — melhoria #7: 6 etapas detalhadas
// ----------------------------------------------------------------
function TelaGerando({
  steps,
  form,
}: {
  steps: GenerationProgressStep[]
  form: FormData
}) {
  const servidorSelecionado = SERVIDORES.find((s) => s.id === form.servidor)
  const appSelecionado = APPS.find(a => a.id === form.app)
  const isXCloud = form.app === 'xcloud'

  return (
    <div className="w-full max-w-md">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="relative mx-auto mb-8 flex h-32 w-32 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: isXCloud ? 'radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)',
              boxShadow: isXCloud ? '0 0 60px rgba(20,184,166,0.4)' : '0 0 60px rgba(37,99,235,0.3)',
              animation: 'linePulse 2s ease-in-out infinite',
            }}
          />
          <div
            className="absolute h-28 w-28 rounded-full border-[3px] animate-spin"
            style={{
              borderColor: isXCloud ? 'rgba(20,184,166,0.1)' : 'rgba(59,130,246,0.1)',
              borderTopColor: isXCloud ? '#14b8a6' : '#3b82f6',
              borderRightColor: isXCloud ? 'rgba(20,184,166,0.4)' : 'rgba(59,130,246,0.4)',
              boxShadow: isXCloud ? '0 0 30px rgba(20,184,166,0.5)' : '0 0 30px rgba(59,130,246,0.5)',
              animationDuration: '1.2s',
            }}
          />
          <div
            className="absolute h-20 w-20 rounded-full border-2 animate-spin"
            style={{
              borderColor: 'transparent',
              borderTopColor: 'rgba(34,197,94,0.6)',
              animationDuration: '2s',
              animationDirection: 'reverse',
            }}
          />
          <Server style={{ width: 32, height: 32, color: isXCloud ? '#14b8a6' : '#3b82f6' }} />
        </div>

        {isXCloud && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.3)' }}>
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#14b8a6' }} />
            <span className="text-sm font-semibold" style={{ color: '#5eead4' }}>XCloud em ativação real automática</span>
          </div>
        )}

        <h2 className="mb-2 text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          Gerando teste para
        </h2>
        <p className="text-xl font-semibold text-primary">{form.nome}</p>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {appSelecionado && <><span>{appSelecionado.label}</span><span>•</span></>}
          {servidorSelecionado && <span>{servidorSelecionado.label}</span>}
        </div>
      </motion.div>

      <div className="space-y-2">
        {steps.map((etapa, i) => {
          const feita = etapa.status === 'done'
          const ativa = etapa.status === 'running'
          const falhou = etapa.status === 'failed'
          const pendente = etapa.status === 'pending'

          return (
            <motion.div
              key={etapa.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-4 rounded-xl px-4 py-3.5 transition-all duration-300"
              style={{
                background: ativa
                  ? 'rgba(37,99,235,0.12)'
                  : falhou
                    ? 'rgba(239,68,68,0.10)'
                  : feita
                    ? 'rgba(34,197,94,0.08)'
                    : 'rgba(255,255,255,0.02)',
                border: ativa
                  ? '1px solid rgba(37,99,235,0.25)'
                  : falhou
                    ? '1px solid rgba(239,68,68,0.25)'
                  : feita
                    ? '1px solid rgba(34,197,94,0.15)'
                    : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                style={{
                  background: feita
                    ? '#22c55e'
                    : falhou
                      ? '#ef4444'
                    : ativa
                      ? 'rgba(37,99,235,0.25)'
                      : 'rgba(255,255,255,0.04)',
                  boxShadow: feita
                    ? '0 0 16px rgba(34,197,94,0.5)'
                    : falhou
                      ? '0 0 16px rgba(239,68,68,0.35)'
                    : ativa
                      ? '0 0 16px rgba(59,130,246,0.4)'
                      : 'none',
                }}
              >
                {feita ? (
                  <CheckCircle className="h-5 w-5 text-white" strokeWidth={3} />
                ) : falhou ? (
                  <X className="h-5 w-5 text-white" strokeWidth={3} />
                ) : ativa ? (
                  <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400" />
                ) : (
                  <div className="h-2 w-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
                )}
              </div>

              <span
                className="flex-1 text-sm font-medium transition-all duration-300"
                style={{ color: feita ? '#86efac' : falhou ? '#f87171' : ativa ? '#93c5fd' : '#475569' }}
              >
                {etapa.label}
              </span>

              {feita && <span className="text-[11px] font-bold text-emerald-400">✓</span>}
              {falhou && <span className="text-[11px] font-bold text-red-300">falhou</span>}
              {ativa && (
                <div
                  className="h-4 w-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: '#3b82f6' }}
                />
              )}
              {pendente && <span className="text-[11px] text-muted-foreground">○</span>}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Tela Sucesso
// ----------------------------------------------------------------
function TelaSucesso({
  form,
  teste,
  copied,
  onCopiar,
  onConcluir,
  onAbrirPainel2,
  onAtivarCliente,
  onVerLog,
  onRetryXcloud,
  onSolicitarRecriacaoXcloud,
  onCancelarRecriacaoXcloud,
  onConfirmarRecriacaoXcloud,
  confirmarRecriacaoXcloud,
  recriandoXcloud,
  executandoXcloud,
  onModoManual,
  onNovo,
}: {
  form: FormData
  teste: TesteGerado
  copied: boolean
  onCopiar: () => void
  onConcluir: () => void
  onAbrirPainel2: () => void
  onAtivarCliente: () => void
  onVerLog: () => void
  onRetryXcloud: () => void
  onSolicitarRecriacaoXcloud: () => void
  onCancelarRecriacaoXcloud: () => void
  onConfirmarRecriacaoXcloud: () => void
  confirmarRecriacaoXcloud: boolean
  recriandoXcloud: boolean
  executandoXcloud: boolean
  onModoManual: () => void
  onNovo: () => void
}) {
  const appLabel = APPS.find((a) => a.id === form.app)?.label ?? form.app
  const servidorLabel = SERVIDORES.find((s) => s.id === form.servidor)?.label ?? form.servidor
  const recreateStages = [
    { stage: 'FindXcloudDevice', label: 'Localizando device', done: teste.xcloudWorker?.device_found },
    { stage: 'DeactivateXcloudDevice', label: 'Desativando device', done: teste.xcloudWorker?.device_deactivated },
    { stage: 'DeleteXcloudDevice', label: 'Excluindo device', done: teste.xcloudWorker?.device_deleted },
    { stage: 'ReAddXcloudDevice', label: 'Cadastrando novamente', done: teste.xcloudWorker?.device_recreated || teste.xcloudWorker?.device_added },
    { stage: 'AttachXtreamCredentials', label: 'Vinculando Xtream', done: teste.xcloudWorker?.xtream_attached },
    { stage: 'Completed', label: 'Confirmando RELOAD', done: teste.xcloudWorker?.confirmation_found },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-lg py-8"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6 text-center"
      >
        <div
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
          style={{
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.3)',
            boxShadow: '0 0 40px rgba(34,197,94,0.25)',
          }}
        >
          <CheckCircle className="h-10 w-10 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          Teste gerado com sucesso!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pronto para enviar para {form.nome}
        </p>
        {/* Badge indicando se foi gravado no Supabase ou só em memória */}
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{
          background: teste.source === 'supabase' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${teste.source === 'supabase' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
        }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{
            background: teste.source === 'supabase' ? '#4ade80' : '#fbbf24',
          }} />
          <span className="text-[11px] font-medium" style={{
            color: teste.source === 'supabase' ? '#4ade80' : '#fbbf24',
          }}>
            {teste.source === 'supabase' ? 'Gravado no Supabase' : 'Modo mock (sem banco)'}
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #07111F 0%, #0A1728 100%)',
          border: '1px solid rgba(59,130,246,0.14)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 32px 64px rgba(0,0,0,0.7)',
        }}
      >
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.5) 40%, rgba(59,130,246,0.4) 60%, transparent)' }} />

        <div className="p-6">
          <div className="mb-5 grid grid-cols-2 gap-2.5">
            {[
              { label: 'Cliente', value: form.nome },
              { label: 'Telefone', value: form.telefone },
              { label: 'Aplicativo', value: appLabel },
              { label: 'Servidor', value: servidorLabel },
              { label: 'Pedido', value: teste.pedido || '-' },
              { label: 'Host', value: teste.host || '-' },
              { label: 'Usuário', value: teste.usuario },
              { label: 'Senha', value: teste.senha },
              { label: 'Código', value: teste.codigo || '-' },
              { label: 'Validade', value: teste.validade },
              ...(form.app === 'xcloud' ? [{ label: 'Device key', value: teste.deviceKey || '-' }] : []),
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#1e3a5f' }}>
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-200 truncate">{item.value}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mb-5 rounded-xl p-4"
            style={{ background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.1)' }}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#1e3a5f' }}>
              Prévia da mensagem
            </p>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-400">
              {teste.mensagem}
            </pre>
          </motion.div>

          {form.app === 'xcloud' && teste.xcloudWorker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="mb-5 rounded-xl p-4"
              style={{ background: 'rgba(20,184,166,0.04)', border: '1px solid rgba(20,184,166,0.12)' }}
            >
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#2dd4bf' }}>
                XCloud
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Acesso gerado', done: true },
                  { label: 'Device adicionado', done: teste.xcloudWorker.device_added },
                  { label: 'Xtream vinculado', done: teste.xcloudWorker.xtream_attached },
                  { label: 'Confirmação RELOAD', done: teste.xcloudWorker.confirmation_found },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.025)' }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: item.done ? '#22c55e' : '#64748b' }} />
                    <span className="text-xs text-slate-300">{item.label}</span>
                  </div>
                ))}
              </div>
              {teste.xcloudWorker.status === 'success' ? (
                <div className="mt-3">
                  <button disabled className="w-full rounded-lg px-2 py-2 text-xs font-semibold text-emerald-200" style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.18)' }}>
                    XCloud ativado
                  </button>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button disabled={executandoXcloud} onClick={onRetryXcloud} className="rounded-lg px-2 py-2 text-xs font-medium text-slate-200 disabled:opacity-60" style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.2)' }}>
                    {executandoXcloud ? 'Executando XCloud real...' : teste.xcloudWorker.status === 'pending' || teste.xcloudWorker.status === 'disabled' ? 'Executar XCloud real' : 'Tentar novamente'}
                  </button>
                  <button onClick={onModoManual} className="rounded-lg px-2 py-2 text-xs font-medium text-slate-200" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Modo manual
                  </button>
                  <button onClick={onVerLog} className="rounded-lg px-2 py-2 text-xs font-medium text-slate-200" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Ver print/log
                  </button>
                </div>
              )}
              <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Recriar device XCloud</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Use apenas para trocar acesso do cliente ou corrigir vínculo do XCloud.</p>
                  </div>
                  <button
                    onClick={onSolicitarRecriacaoXcloud}
                    disabled={recriandoXcloud}
                    className="h-9 rounded-lg px-3 text-xs font-semibold text-amber-100 disabled:opacity-60"
                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.22)' }}
                  >
                    {recriandoXcloud ? 'Recriando...' : 'Recriar device'}
                  </button>
                </div>
                {(confirmarRecriacaoXcloud || recriandoXcloud || teste.xcloudWorker.stage === 'FindXcloudDevice' || teste.xcloudWorker.stage === 'DeactivateXcloudDevice' || teste.xcloudWorker.stage === 'DeleteXcloudDevice' || teste.xcloudWorker.stage === 'ReAddXcloudDevice') && (
                  <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.16)' }}>
                    {confirmarRecriacaoXcloud && (
                      <>
                        <p className="text-xs font-medium text-amber-100">Isso vai desativar e excluir a device no XCloud antes de cadastrar novamente. Deseja continuar?</p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button onClick={onCancelarRecriacaoXcloud} className="h-9 rounded-lg text-xs font-medium text-slate-300" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            Cancelar
                          </button>
                          <button onClick={onConfirmarRecriacaoXcloud} className="h-9 rounded-lg text-xs font-semibold text-amber-100" style={{ background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.26)' }}>
                            Confirmar recriação
                          </button>
                        </div>
                      </>
                    )}
                    {!confirmarRecriacaoXcloud && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {recreateStages.map((item) => {
                          const active = recriandoXcloud && teste.xcloudWorker?.stage === item.stage
                          return (
                            <div key={item.stage} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.025)' }}>
                              <span className="h-2 w-2 rounded-full" style={{ background: item.done ? '#22c55e' : active ? '#f59e0b' : '#64748b' }} />
                              <span className="text-xs text-slate-300">{item.label}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {teste.xcloudWorker.status === 'failed' && (
                <p className="mt-3 text-xs text-red-300">XCloud falhou na etapa: {teste.xcloudWorker.stage}</p>
              )}
              {teste.xcloudWorker.message && (
                <p className="mt-3 text-xs text-slate-500">{teste.xcloudWorker.message}</p>
              )}
            </motion.div>
          )}

          {teste.dispatch && (
            <div className="mb-5 rounded-xl p-3" style={{ background: teste.dispatch.status === 'failed' ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${teste.dispatch.status === 'failed' ? 'rgba(239,68,68,0.16)' : 'rgba(34,197,94,0.16)'}` }}>
              <p className="text-xs font-semibold" style={{ color: teste.dispatch.status === 'failed' ? '#fca5a5' : '#86efac' }}>
                {teste.dispatch.status === 'failed' ? 'Mensagem não enviada' : teste.dispatch.dry_run ? 'Mensagem preparada' : 'Mensagem enviada ao cliente'}
              </p>
              {teste.dispatch.message && <p className="mt-1 text-[11px] text-slate-500">{teste.dispatch.message}</p>}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-2 gap-2.5"
          >
            <button
              onClick={onCopiar}
              className="flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.07]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a3b8',
              }}
            >
              {copied ? <CheckCircle className="h-[18px] w-[18px] text-emerald-400" /> : <Copy className="h-[18px] w-[18px]" />}
              {copied ? 'Copiado!' : 'Copiar dados'}
            </button>
            <button
              onClick={onConcluir}
              className="flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                boxShadow: '0 4px 20px rgba(34,197,94,0.35)',
              }}
            >
              <CheckCircle className="h-[18px] w-[18px]" />
              Concluir
            </button>
            <button
              onClick={onAbrirPainel2}
              className="flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: 'rgba(37,99,235,0.12)',
                border: '1px solid rgba(37,99,235,0.24)',
                color: '#93c5fd',
              }}
            >
              <ExternalLink className="h-[18px] w-[18px]" />
              Abrir Painel 2
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
          >
            <button
              onClick={onAtivarCliente}
              className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.05]"
              style={{
                background: 'rgba(34,197,94,0.06)',
                border: '1px solid rgba(34,197,94,0.14)',
                color: '#86efac',
              }}
            >
              <PlayCircle className="h-[18px] w-[18px]" />
              Ativar cliente
            </button>
            <button
              onClick={onNovo}
              className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.05]"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#64748b',
              }}
            >
              <RotateCcw className="h-[18px] w-[18px]" />
              Gerar outro
            </button>
            <button
              onClick={onVerLog}
              className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.05]"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#64748b',
              }}
            >
              <FileText className="h-[18px] w-[18px]" />
              Ver log
            </button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ----------------------------------------------------------------
// Componentes auxiliares
// ----------------------------------------------------------------
function WizardCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(180deg, #07111F 0%, #0A1728 100%)',
        border: '1px solid rgba(59,130,246,0.14)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 28px 70px rgba(0,0,0,0.75)',
      }}
    >
      <div
        className="absolute left-0 right-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.7) 40%, rgba(99,102,241,0.6) 60%, transparent)',
        }}
      />
      {/* melhoria #1: padding maior para dar mais presença */}
      <div className="p-7">{children}</div>
    </div>
  )
}

// melhoria #2: inputs com glow azul no focus e bg/border premium
function InputField({
  icon,
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  icon: React.ReactNode
  label: string
  placeholder: string
  value: string
  onChange: (val: string) => void
  type?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
        {label}
      </label>
      <div className="relative">
        <span
          className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200"
          style={{ color: focused ? '#3b82f6' : '#334155' }}
        >
          {icon}
        </span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full rounded-xl pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all duration-200"
          style={{
            height: 52,
            background: focused ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.03)',
            border: focused
              ? '1px solid rgba(59,130,246,0.45)'
              : '1px solid rgba(255,255,255,0.08)',
            boxShadow: focused
              ? '0 0 0 3px rgba(59,130,246,0.12), 0 0 18px rgba(59,130,246,0.08)'
              : 'none',
          }}
        />
      </div>
    </div>
  )
}

function PrimaryButton({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative overflow-hidden rounded-xl font-bold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
      style={{
        height: 54,
        fontSize: 14,
        background: disabled
          ? 'rgba(59,130,246,0.3)'
          : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)',
        boxShadow: disabled
          ? 'none'
          : '0 0 0 1px rgba(59,130,246,0.3), 0 6px 24px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        fontFamily: 'var(--font-display)',
        width: '100%',
      }}
    >
      {!disabled && (
        <span
          className="pointer-events-none absolute inset-y-0 left-[-75%] w-1/2 skew-x-[-20deg]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            animation: 'shineSweep 3.5s ease-in-out infinite',
          }}
        />
      )}
      <span className="relative flex items-center justify-center">{children}</span>
    </button>
  )
}

function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-xl text-sm font-medium transition-all hover:bg-white/[0.05]"
      style={{
        height: 54,
        padding: '0 20px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#64748b',
      }}
    >
      {children}
    </button>
  )
}

function ResumoItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-3.5 py-3"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#1e3a5f' }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-200 truncate">{value}</p>
    </div>
  )
}

// melhoria #1: AppCard mais alto
function AppCard({
  selected,
  color,
  glow,
  image,
  label,
  badge,
  badgeColor,
  onClick,
}: {
  selected: boolean
  color: string
  glow: string
  image: string
  label: string
  badge?: string
  badgeColor?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center rounded-2xl pt-5 pb-4 px-2 text-center outline-none transition-all duration-200"
      style={{
        transform: selected ? 'scale(1.03)' : 'scale(1)',
        background: selected
          ? `linear-gradient(160deg, rgba(${glow},0.14) 0%, rgba(${glow},0.05) 100%)`
          : 'rgba(255,255,255,0.025)',
        border: selected
          ? `2px solid ${color}`
          : '1.5px solid rgba(255,255,255,0.06)',
        boxShadow: selected
          ? `0 0 0 3px rgba(${glow},0.12), 0 8px 28px rgba(${glow},0.2)`
          : '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      {selected && (
        <span
          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        >
          <CheckCircle className="h-3 w-3 text-white" strokeWidth={3} />
        </span>
      )}

      {/* melhoria #1: ícone maior (72x72) */}
      <div
        className="mb-2.5 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-xl"
        style={{
          background: '#060911',
          border: selected ? `1.5px solid rgba(${glow},0.4)` : '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <img src={image} alt={label} className="h-full w-full object-contain p-1.5" />
      </div>

      {/* melhoria #8: texto maior */}
      <p className="mb-1.5 text-[13px] font-semibold leading-tight text-slate-200">{label}</p>

      {badge && (
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{
            background: selected ? badgeColor : 'rgba(255,255,255,0.05)',
            color: selected ? '#fff' : '#475569',
            border: selected ? `1px solid ${badgeColor}` : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function ServidorCard({
  selected,
  color,
  glow,
  image,
  label,
  sub,
  status,
  onClick,
  isRecommended,
}: {
  selected: boolean
  color: string
  glow: string
  image: string
  label: string
  sub?: string
  status?: string
  onClick: () => void
  isRecommended?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex rounded-xl overflow-hidden text-left outline-none transition-all duration-200 w-full"
      style={{
        transform: selected ? 'scale(1.02)' : 'scale(1)',
        background: selected
          ? `linear-gradient(160deg, rgba(${glow},0.1) 0%, rgba(${glow},0.03) 100%)`
          : 'rgba(255,255,255,0.025)',
        border: selected
          ? `2px solid ${color}`
          : '1.5px solid rgba(255,255,255,0.06)',
        boxShadow: selected
          ? `0 0 0 3px rgba(${glow},0.1), 0 6px 20px rgba(${glow},0.15)`
          : '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {selected && (
        <span
          className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        >
          <CheckCircle className="h-3 w-3 text-white" strokeWidth={3} />
        </span>
      )}

      <div
        className="flex h-[68px] w-[84px] shrink-0 items-center justify-center"
        style={{
          background: '#050810',
          borderRight: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* melhoria #8: ícone maior */}
        <img src={image} alt={label} className="h-[46px] w-[46px] object-contain" />
      </div>

      <div className="flex flex-1 items-center justify-between px-4 py-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold leading-tight text-slate-200">{label}</p>
            {isRecommended && (
              <span className="text-[9px] font-bold text-emerald-400 uppercase">Recomendado</span>
            )}
          </div>
          {sub && (
            <p className="mt-0.5 text-[11px] font-medium" style={{ color: selected ? color : '#334155' }}>
              {sub}
            </p>
          )}
        </div>
        {status && (
          <div
            className="flex items-center gap-1.5 rounded-full px-2 py-1"
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[9px] font-bold text-emerald-400">{status}</span>
          </div>
        )}
      </div>
    </button>
  )
}
