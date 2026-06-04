'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, ArrowLeft, Copy, MessageCircle, CheckCircle,
  RotateCcw, ExternalLink, Loader2, AlertCircle, Check,
  ChevronDown, Keyboard
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { NavPage } from '@/app/page'

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'dados' | 'app' | 'servidor' | 'extra'
type ProcessStep = 'gerando' | 'sucesso'
type AppId = 'xcloud' | 'blessed' | 'playsim' | 'smartstb' | 'manual'
type ServerId = 'yellow' | 'ninety'
type EtapaStatus = 'aguardando' | 'carregando' | 'concluido' | 'erro'

interface FormData {
  nome: string
  telefone: string
  app: AppId | ''
  servidor: ServerId | ''
  deviceKey: string       // XCloud
  manualUser: string      // Manual
  manualPass: string      // Manual
  manualCode: string      // Manual
  manualHost: string      // Manual
  manualText: string      // Manual
}

interface TesteGerado {
  clientName: string
  phone: string
  app: AppId
  servidor: ServerId
  usuario: string
  senha: string
  codigo: string
  xtreamHost: string
  validade: string
  mensagem: string
  source: 'supabase' | 'mock'
}

interface EtapaGeracao {
  id: string
  label: string
  status: EtapaStatus
}

// ─── Config: Apps ─────────────────────────────────────────────────────────────

const APPS: {
  id: AppId
  label: string
  desc: string
  badge: string
  badgeColor: string
  color: string
  image: string
}[] = [
  {
    id: 'xcloud',
    label: 'XCloud',
    desc: 'App principal',
    badge: 'PREMIUM',
    badgeColor: '#14b8a6',
    color: '#14b8a6',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/140bd867-bdd4-43d8-9369-ae5c22b722b1-bivziPC07NHSLi0lwTyEWq4Xwga3zK.png',
  },
  {
    id: 'blessed',
    label: 'Blessed Player',
    desc: 'Mais usado',
    badge: 'POPULAR',
    badgeColor: '#ef4444',
    color: '#ef4444',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/e6b8d7cc-a704-4554-89fc-6814c8a7c0dd-q6yOM0urLpFNKiSldupFpDvipZnFVy.png',
  },
  {
    id: 'playsim',
    label: 'PlaySim',
    desc: 'Alternativo',
    badge: 'LEVE',
    badgeColor: '#f97316',
    color: '#f97316',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-9cnCrfCm5sltPhvF9J8wZrEp42Ech7.png',
  },
  {
    id: 'smartstb',
    label: 'Smart STB',
    desc: 'Smart TV',
    badge: 'SMART TV',
    badgeColor: '#3b82f6',
    color: '#3b82f6',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/9f711896-c0bd-4d2f-bf93-59bb74f72a37-eGBRUrOFdFo4WivuZxGe57qT59c5h7.png',
  },
  {
    id: 'manual',
    label: 'Manual',
    desc: 'Gerar texto de acesso',
    badge: 'LIVRE',
    badgeColor: '#64748b',
    color: '#64748b',
    image: '',
  },
]

// ─── Config: Servidores ───────────────────────────────────────────────────────

const SERVIDORES: {
  id: ServerId
  label: string
  sub: string
  destaque: boolean
  color: string
  image: string
}[] = [
  {
    id: 'yellow',
    label: 'Yellow Box',
    sub: 'Principal',
    destaque: true,
    color: '#84cc16',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4f976bbd-b9a0-4464-9345-faab1188d991-GeKdgGIvSt1FeZn9dfhIMTy2s92JaX.png',
  },
  {
    id: 'ninety',
    label: 'Ninety',
    sub: 'Secundário',
    destaque: false,
    color: '#a855f7',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/a8543a86-94bc-4402-80d8-b537ec48807f-keJkJzA3chubyxn9bwE7Wg1JEytlwW.png',
  },
]

// ─── Etapas por tipo de app ───────────────────────────────────────────────────

function getEtapas(app: AppId | ''): { id: string; label: string }[] {
  if (app === 'xcloud') return [
    { id: 'validando',   label: 'Validando cliente' },
    { id: 'painel',      label: 'Solicitando teste no painel' },
    { id: 'credenciais', label: 'Recebendo credenciais Xtream' },
    { id: 'xcloud',      label: 'Preparando acesso XCloud' },
    { id: 'dispositivo', label: 'Configurando dispositivo' },
    { id: 'supabase',    label: 'Salvando no Supabase' },
    { id: 'mensagem',    label: 'Preparando mensagem' },
  ]
  if (app === 'manual') return [
    { id: 'validando', label: 'Validando dados' },
    { id: 'mensagem',  label: 'Montando mensagem' },
    { id: 'salvando',  label: 'Salvando teste' },
    { id: 'fim',       label: 'Finalizando' },
  ]
  return [
    { id: 'validando',   label: 'Validando cliente' },
    { id: 'painel',      label: 'Solicitando teste no painel' },
    { id: 'credenciais', label: 'Recebendo usuário, senha e código' },
    { id: 'supabase',    label: 'Salvando no Supabase' },
    { id: 'mensagem',    label: 'Preparando mensagem' },
  ]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gerarDadosFakeMock(form: FormData): TesteGerado {
  const rand = (n = 6) => Math.random().toString(36).substring(2, 2 + n).toUpperCase()
  const nome = form.nome.trim()
  const appId = form.app as AppId
  const servId = form.servidor as ServerId

  if (appId === 'manual') {
    const usuario  = form.manualUser || `usr_manual_${rand(4)}`
    const senha    = form.manualPass || rand(8)
    const codigo   = form.manualCode || `#${Math.floor(Math.random() * 9000) + 1000}`
    const host     = form.manualHost || 'http://painel.exemplo.tv'
    const val      = new Date(); val.setHours(val.getHours() + 2)
    const valBR    = val.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    const appLabel = 'Manual'
    const mensagem = form.manualText || [
      `Olá ${nome}! Segue seu acesso:`,
      ``,
      `App: ${appLabel}`,
      ...(form.manualHost ? [`Host: ${host}`] : []),
      `Usuário: ${usuario}`,
      `Senha: ${senha}`,
      `Código: ${codigo}`,
      `Validade: ${valBR}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
    return { clientName: nome, phone: form.telefone, app: appId, servidor: servId || 'yellow', usuario, senha, codigo, xtreamHost: host, validade: valBR, mensagem, source: 'mock' }
  }

  const usuario   = `usr_${nome.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}${Math.floor(Math.random() * 999)}`
  const senha     = `${rand(5)}${rand(5)}`.substring(0, 10)
  const codigo    = `#${String(Math.floor(Math.random() * 9000) + 1000)}`
  const host      = 'http://srv.centralplay.tv'
  const deviceKey = form.deviceKey || `DEV-${rand(8)}`
  const val       = new Date(); val.setHours(val.getHours() + 2)
  const valBR     = val.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const appLabel  = APPS.find(a => a.id === appId)?.label ?? appId
  const srvLabel  = SERVIDORES.find(s => s.id === servId)?.label ?? servId

  let mensagem = ''
  if (appId === 'xcloud') {
    mensagem = [
      `Olá ${nome}! Segue seu teste de 2 horas:`,
      ``,
      `App: ${appLabel}`,
      `Host: ${host}`,
      `Usuário: ${usuario}`,
      `Senha: ${senha}`,
      `Validade: ${valBR}`,
      ``,
      `Informe a chave do seu dispositivo: ${deviceKey}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
  } else {
    mensagem = [
      `Olá ${nome}! Segue seu teste de 2 horas:`,
      ``,
      `App: ${appLabel}`,
      `Servidor: ${srvLabel}`,
      `Código: ${codigo}`,
      `Usuário: ${usuario}`,
      `Senha: ${senha}`,
      `Validade: ${valBR}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
  }

  return { clientName: nome, phone: form.telefone, app: appId, servidor: servId, usuario, senha, codigo, xtreamHost: host, validade: valBR, mensagem, source: 'mock' }
}

// ─── Particles ────────────────────────────────────────────────────────────────

function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const set = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    set()
    window.addEventListener('resize', set)
    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number }
    const pts: P[] = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.2 + 0.2, a: Math.random() * 0.2 + 0.03,
    }))
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of pts) {
        p.x = (p.x + p.vx + canvas.width) % canvas.width
        p.y = (p.y + p.vy + canvas.height) % canvas.height
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(99,155,255,${p.a})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { window.removeEventListener('resize', set); cancelAnimationFrame(raf) }
  }, [])
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 0 }} />
}

// ─── Sub-components: Steps ────────────────────────────────────────────────────

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8 justify-center">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                style={{
                  background: done ? '#22c55e' : active ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                  color: done || active ? '#fff' : '#475569',
                  border: active ? '1.5px solid #60a5fa' : 'none',
                }}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className="text-[11px] hidden sm:block" style={{ color: active ? '#e2e8f0' : '#475569' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-8 h-px" style={{ background: done ? '#22c55e40' : 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function FieldInput({
  label, placeholder, value, onChange, type = 'text', hint,
}: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; type?: string; hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-11 px-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
      />
      {hint && <p className="text-[11px] text-slate-600">{hint}</p>}
    </div>
  )
}

// ─── Step: Dados ─────────────────────────────────────────────────────────────

function StepDados({ form, setForm, onNext }: {
  form: FormData; setForm: (f: FormData) => void; onNext: () => void
}) {
  const valid = form.nome.trim().length >= 2 && form.telefone.replace(/\D/g, '').length >= 10
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>Dados do cliente</h2>
        <p className="text-sm text-slate-500">Nome e WhatsApp para identificação</p>
      </div>
      <div className="space-y-4 max-w-sm mx-auto">
        <FieldInput
          label="Nome completo"
          placeholder="Ex: João Silva"
          value={form.nome}
          onChange={v => setForm({ ...form, nome: v })}
        />
        <FieldInput
          label="Telefone / WhatsApp"
          placeholder="(11) 9 9999-9999"
          value={form.telefone}
          onChange={v => setForm({ ...form, telefone: v })}
          type="tel"
        />
        <button
          onClick={onNext}
          disabled={!valid}
          className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all mt-2"
          style={{
            background: valid ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'rgba(255,255,255,0.05)',
            color: valid ? '#fff' : '#475569',
            cursor: valid ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Step: App ────────────────────────────────────────────────────────────────

function StepApp({ form, setForm, onNext, onBack }: {
  form: FormData; setForm: (f: FormData) => void; onNext: () => void; onBack: () => void
}) {
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>Escolha o aplicativo</h2>
        <p className="text-sm text-slate-500">Qual app o cliente vai usar?</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl mx-auto mb-6">
        {APPS.map(app => {
          const selected = form.app === app.id
          return (
            <button
              key={app.id}
              onClick={() => { setForm({ ...form, app: app.id }); setTimeout(onNext, 120) }}
              className="rounded-2xl p-4 flex flex-col items-center gap-3 transition-all text-left relative overflow-hidden"
              style={{
                background: selected ? `rgba(${app.id === 'xcloud' ? '20,184,166' : app.id === 'blessed' ? '239,68,68' : app.id === 'playsim' ? '249,115,22' : app.id === 'smartstb' ? '59,130,246' : '100,116,139'},0.12)` : 'rgba(255,255,255,0.04)',
                border: selected ? `1.5px solid ${app.color}40` : '1px solid rgba(255,255,255,0.07)',
                boxShadow: selected ? `0 0 20px ${app.color}20` : 'none',
              }}
            >
              <span
                className="absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: `${app.badgeColor}20`, color: app.badgeColor }}
              >
                {app.badge}
              </span>
              {app.image ? (
                <img src={app.image} alt={app.label} className="h-12 w-12 object-contain rounded-xl" />
              ) : (
                <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <Keyboard className="h-6 w-6 text-slate-400" />
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-white text-center">{app.label}</p>
                <p className="text-[10px] text-slate-500 text-center mt-0.5">{app.desc}</p>
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex justify-center">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
      </div>
    </motion.div>
  )
}

// ─── Step: Servidor ───────────────────────────────────────────────────────────

function StepServidor({ form, setForm, onNext, onBack }: {
  form: FormData; setForm: (f: FormData) => void; onNext: () => void; onBack: () => void
}) {
  const [mostrarOutros, setMostrarOutros] = useState(false)
  const visíveis = mostrarOutros ? SERVIDORES : SERVIDORES.filter(s => s.destaque || s.id === 'ninety')

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>Escolha o servidor</h2>
        <p className="text-sm text-slate-500">Qual painel vai fornecer o teste?</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto mb-6">
        {visíveis.map(srv => {
          const selected = form.servidor === srv.id
          return (
            <button
              key={srv.id}
              onClick={() => { setForm({ ...form, servidor: srv.id }); setTimeout(onNext, 120) }}
              className="flex-1 rounded-2xl p-5 flex flex-col items-center gap-3 transition-all relative overflow-hidden"
              style={{
                background: selected ? `${srv.color}12` : srv.destaque ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                border: selected
                  ? `1.5px solid ${srv.color}40`
                  : srv.destaque
                    ? '1px solid rgba(255,255,255,0.1)'
                    : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {srv.destaque && (
                <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#84cc1620', color: '#84cc16' }}>
                  PRINCIPAL
                </span>
              )}
              <img src={srv.image} alt={srv.label} className="h-14 w-14 object-contain rounded-2xl" />
              <div className="text-center">
                <p className="text-sm font-semibold text-white">{srv.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: srv.color }}>{srv.sub}</p>
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex flex-col items-center gap-3">
        {!mostrarOutros && (
          <button
            onClick={() => setMostrarOutros(true)}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Ver outros servidores <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
      </div>
    </motion.div>
  )
}

// ─── Step: Extra (XCloud key / Manual fields) ─────────────────────────────────

function StepExtra({ form, setForm, onGerar, onBack }: {
  form: FormData; setForm: (f: FormData) => void; onGerar: () => void; onBack: () => void
}) {
  const isXCloud = form.app === 'xcloud'
  const isManual = form.app === 'manual'

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          {isXCloud ? 'Chave do dispositivo' : 'Dados manuais'}
        </h2>
        <p className="text-sm text-slate-500">
          {isXCloud
            ? 'Informe a chave exibida no app XCloud do cliente.'
            : 'Preencha os campos para gerar o texto de acesso.'}
        </p>
      </div>
      <div className="space-y-4 max-w-sm mx-auto">
        {isXCloud && (
          <FieldInput
            label="Chave XCloud"
            placeholder="Ex: DEV-A1B2C3D4"
            value={form.deviceKey}
            onChange={v => setForm({ ...form, deviceKey: v })}
            hint="Encontrada em Configurações > Dispositivo no app XCloud."
          />
        )}
        {isManual && (
          <>
            <FieldInput label="Usuário" placeholder="usuario123" value={form.manualUser} onChange={v => setForm({ ...form, manualUser: v })} />
            <FieldInput label="Senha" placeholder="senha123" value={form.manualPass} onChange={v => setForm({ ...form, manualPass: v })} type="password" />
            <FieldInput label="Código" placeholder="#4821" value={form.manualCode} onChange={v => setForm({ ...form, manualCode: v })} />
            <FieldInput label="Host (opcional)" placeholder="http://painel.tv" value={form.manualHost} onChange={v => setForm({ ...form, manualHost: v })} />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Texto livre (opcional)</label>
              <textarea
                placeholder="Mensagem personalizada para o cliente..."
                value={form.manualText}
                onChange={e => setForm({ ...form, manualText: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all resize-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
          </>
        )}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onBack}
            className="h-11 px-4 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <button
            onClick={onGerar}
            className="flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff' }}
          >
            Gerar teste <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Screen: Gerando ──────────────────────────────────────────────────────────

function TelaGerando({ form, etapas }: { form: FormData; etapas: EtapaGeracao[] }) {
  const appLabel = APPS.find(a => a.id === form.app)?.label ?? form.app
  const srvLabel = SERVIDORES.find(s => s.id === form.servidor)?.label ?? form.servidor

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] px-6 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#60a5fa' }} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Gerando teste para {form.nome}
        </h2>
        <p className="text-sm text-slate-500">
          {appLabel} + {form.app !== 'manual' ? srvLabel : '—'}
        </p>
      </div>

      {/* Etapas */}
      <div className="w-full max-w-xs space-y-2.5">
        {etapas.map((etapa, i) => (
          <motion.div
            key={etapa.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background:
                etapa.status === 'concluido' ? 'rgba(34,197,94,0.07)' :
                etapa.status === 'carregando' ? 'rgba(59,130,246,0.1)' :
                etapa.status === 'erro' ? 'rgba(239,68,68,0.08)' :
                'rgba(255,255,255,0.03)',
              border:
                etapa.status === 'concluido' ? '1px solid rgba(34,197,94,0.2)' :
                etapa.status === 'carregando' ? '1px solid rgba(59,130,246,0.25)' :
                etapa.status === 'erro' ? '1px solid rgba(239,68,68,0.2)' :
                '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div className="shrink-0 h-5 w-5 flex items-center justify-center">
              {etapa.status === 'concluido' && <Check className="h-3.5 w-3.5" style={{ color: '#4ade80' }} />}
              {etapa.status === 'carregando' && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: '#60a5fa' }} />}
              {etapa.status === 'erro' && <AlertCircle className="h-3.5 w-3.5" style={{ color: '#f87171' }} />}
              {etapa.status === 'aguardando' && <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />}
            </div>
            <span
              className="text-xs font-medium"
              style={{
                color:
                  etapa.status === 'concluido' ? '#4ade80' :
                  etapa.status === 'carregando' ? '#93c5fd' :
                  etapa.status === 'erro' ? '#f87171' :
                  '#475569',
              }}
            >
              {etapa.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Screen: Sucesso ──────────────────────────────────────────────────────────

function TelaSucesso({
  teste, onNovo, onVerTestes,
}: {
  teste: TesteGerado
  onNovo: () => void
  onVerTestes: () => void
}) {
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()

  const copiar = () => {
    navigator.clipboard.writeText(teste.mensagem).then(() => {
      setCopied(true)
      addToast('success', 'Mensagem copiada!')
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const abrirWhatsApp = () => {
    const tel = teste.phone.replace(/\D/g, '')
    const msg = encodeURIComponent(teste.mensagem)
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
  }

  const appLabel = APPS.find(a => a.id === teste.app)?.label ?? teste.app
  const srvLabel = SERVIDORES.find(s => s.id === teste.servidor)?.label ?? teste.servidor
  const isXCloud = teste.app === 'xcloud'
  const isManual = teste.app === 'manual'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <CheckCircle className="h-7 w-7" style={{ color: '#4ade80' }} />
        </div>
        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Teste gerado com sucesso
        </h2>
        <p className="text-sm text-slate-500">{teste.clientName} · {teste.phone}</p>
        {/* Badge source */}
        <div className="inline-flex items-center gap-1.5 mt-3 rounded-full px-3 py-1" style={{
          background: teste.source === 'supabase' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${teste.source === 'supabase' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
        }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: teste.source === 'supabase' ? '#4ade80' : '#fbbf24' }} />
          <span className="text-[11px] font-medium" style={{ color: teste.source === 'supabase' ? '#4ade80' : '#fbbf24' }}>
            {teste.source === 'supabase' ? 'Gravado no Supabase' : 'Sandbox / Mock'}
          </span>
        </div>
      </div>

      {/* Card de dados */}
      <div className="rounded-2xl p-5 mb-4 space-y-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          { label: 'Cliente', value: teste.clientName },
          { label: 'Telefone', value: teste.phone },
          { label: 'Aplicativo', value: appLabel },
          ...(!isManual ? [{ label: 'Painel', value: srvLabel }] : []),
          ...(isXCloud ? [{ label: 'Host Xtream', value: teste.xtreamHost }] : []),
          ...(!isXCloud && !isManual ? [{ label: 'Código', value: teste.codigo }] : []),
          { label: 'Usuário', value: teste.usuario },
          { label: 'Senha', value: teste.senha },
          { label: 'Validade', value: teste.validade },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500 shrink-0">{label}</span>
            <span className="text-xs font-medium text-slate-200 truncate text-right">{value}</span>
          </div>
        ))}
      </div>

      {/* Mensagem pronta */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[11px] text-slate-500 mb-2 font-medium uppercase tracking-wider">Mensagem para o cliente</p>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{teste.mensagem}</pre>
      </div>

      {/* Ações */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <button
          onClick={copiar}
          className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado!' : 'Copiar mensagem'}
        </button>
        <button
          onClick={abrirWhatsApp}
          className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={onNovo}
          className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Novo teste
        </button>
        <button
          onClick={onVerTestes}
          className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Ver em Testes
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const STEP_LABELS: Record<WizardStep, string> = {
  dados: 'Dados',
  app: 'Aplicativo',
  servidor: 'Servidor',
  extra: 'Detalhes',
}

const STEP_ORDER: WizardStep[] = ['dados', 'app', 'servidor', 'extra']

export function GerarTesteWizard({ onNavigate }: { onNavigate?: (p: NavPage) => void }) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('dados')
  const [processStep, setProcessStep] = useState<ProcessStep | null>(null)
  const [form, setForm] = useState<FormData>({
    nome: '', telefone: '', app: '', servidor: '',
    deviceKey: '', manualUser: '', manualPass: '', manualCode: '', manualHost: '', manualText: '',
  })
  const [etapas, setEtapas] = useState<EtapaGeracao[]>([])
  const [teste, setTeste] = useState<TesteGerado | null>(null)
  const { addToast } = useToast()

  // Determina se o passo "extra" é necessário
  const precisaExtra = form.app === 'xcloud' || form.app === 'manual'

  const goNext = (from: WizardStep) => {
    const idx = STEP_ORDER.indexOf(from)
    // Se não precisa de extra, pula direto para gerar
    if (from === 'servidor' && !precisaExtra) {
      iniciarGeracao()
      return
    }
    if (from === 'servidor' && precisaExtra) {
      setWizardStep('extra')
      return
    }
    if (idx < STEP_ORDER.length - 1) {
      setWizardStep(STEP_ORDER[idx + 1])
    }
  }

  const goBack = (from: WizardStep) => {
    const idx = STEP_ORDER.indexOf(from)
    if (idx > 0) setWizardStep(STEP_ORDER[idx - 1])
  }

  const iniciarGeracao = () => {
    const etapasBase = getEtapas(form.app)
    setEtapas(etapasBase.map(e => ({ ...e, status: 'aguardando' })))
    setProcessStep('gerando')
  }

  // Animação de etapas + chamada ao endpoint
  useEffect(() => {
    if (processStep !== 'gerando') return
    const etapasBase = getEtapas(form.app)
    const timers: ReturnType<typeof setTimeout>[] = []

    // Avança status visual de cada etapa
    etapasBase.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setEtapas(prev => prev.map((e, j) =>
          j === i ? { ...e, status: 'carregando' } :
          j < i  ? { ...e, status: 'concluido' } : e
        ))
      }, i * 600))
      timers.push(setTimeout(() => {
        setEtapas(prev => prev.map((e, j) => j === i ? { ...e, status: 'concluido' } : e))
      }, i * 600 + 480))
    })

    const minDelay = etapasBase.length * 600 + 300

    const fetchTeste = async (): Promise<TesteGerado> => {
      try {
        const payload = {
          nome: form.nome,
          telefone: form.telefone,
          app: form.app,
          servidor: form.servidor || 'yellow',
          deviceKey: form.deviceKey || undefined,
          manualFields: form.app === 'manual' ? {
            user: form.manualUser,
            pass: form.manualPass,
            code: form.manualCode,
            host: form.manualHost,
            text: form.manualText,
          } : undefined,
          connection_type: form.app === 'xcloud' ? 'xtream' : 'standard',
        }
        const res = await fetch('/api/tests/create-mock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!data.success) throw new Error(data.error ?? 'Erro desconhecido')
        // Mapear resposta do endpoint para TesteGerado
        const appId = form.app as AppId
        const srvId = (form.servidor || 'yellow') as ServerId
        return {
          clientName: form.nome,
          phone: form.telefone,
          app: appId,
          servidor: srvId,
          usuario: data.test.username,
          senha: data.test.password,
          codigo: data.test.code,
          xtreamHost: data.test.xtream_host ?? 'http://srv.centralplay.tv',
          validade: data.test.validadeBR,
          mensagem: data.test.mensagem,
          source: data.source,
        }
      } catch {
        return gerarDadosFakeMock(form)
      }
    }

    timers.push(setTimeout(async () => {
      const resultado = await fetchTeste()
      setTeste(resultado)
      setProcessStep('sucesso')
    }, minDelay))

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processStep])

  const reset = () => {
    setForm({ nome: '', telefone: '', app: '', servidor: '', deviceKey: '', manualUser: '', manualPass: '', manualCode: '', manualHost: '', manualText: '' })
    setWizardStep('dados')
    setProcessStep(null)
    setEtapas([])
    setTeste(null)
  }

  // Indicador de progresso para o stepper (apenas passos que serão usados)
  const stepsVisiveis = precisaExtra
    ? (['dados', 'app', 'servidor', 'extra'] as WizardStep[])
    : (['dados', 'app', 'servidor'] as WizardStep[])
  const currentStepIdx = stepsVisiveis.indexOf(wizardStep)

  // ── Renderização ──────────────────────────────────────────────────────────

  // Telas de processamento (sem card centralizado, fundo pleno)
  if (processStep === 'gerando') {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{ background: 'var(--background)' }}>
        <Particles />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, padding: '0 24px' }}>
          <TelaGerando form={form} etapas={etapas} />
        </div>
      </div>
    )
  }

  if (processStep === 'sucesso' && teste) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-10 px-4"
        style={{ background: 'var(--background)' }}>
        <Particles />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480 }}>
          <TelaSucesso
            teste={teste}
            onNovo={reset}
            onVerTestes={() => onNavigate?.('testes')}
          />
        </div>
      </div>
    )
  }

  // Passos do wizard
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4"
      style={{ background: 'var(--background)' }}>
      <Particles />
      <div
        className="relative w-full max-w-xl rounded-3xl p-8 sm:p-10"
        style={{
          background: 'rgba(12,14,20,0.92)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(24px)',
          zIndex: 1,
        }}
      >
        {/* Stepper */}
        <StepIndicator
          steps={stepsVisiveis.map(s => STEP_LABELS[s])}
          current={currentStepIdx}
        />

        {/* Passos */}
        <AnimatePresence mode="wait">
          {wizardStep === 'dados' && (
            <StepDados key="dados" form={form} setForm={setForm} onNext={() => setWizardStep('app')} />
          )}
          {wizardStep === 'app' && (
            <StepApp key="app" form={form} setForm={setForm} onNext={() => goNext('app')} onBack={() => goBack('app')} />
          )}
          {wizardStep === 'servidor' && (
            <StepServidor key="servidor" form={form} setForm={setForm} onNext={() => goNext('servidor')} onBack={() => goBack('servidor')} />
          )}
          {wizardStep === 'extra' && (
            <StepExtra key="extra" form={form} setForm={setForm} onGerar={iniciarGeracao} onBack={() => goBack('extra')} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
