'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, ArrowLeft, Copy, CheckCircle,
  RotateCcw, ExternalLink, Loader2, AlertCircle, Check,
  Keyboard, User, Phone, Zap, Server, ChevronDown,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { NavPage } from '@/app/page'
import { MOCK_TESTES, MOCK_PIPELINE } from '@/lib/mock-data'
import type { LeadPipeline } from '@/lib/mock-data'

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'dados' | 'app' | 'servidor' | 'extra'
type ProcessStep = 'gerando' | 'sucesso'
type AppId = 'xcloud' | 'blessed' | 'playsim' | 'funplay' | 'smartstb' | 'manual'
type ServerId = 'yellow' | 'ninety' | 'cinemax'
type EtapaStatus = 'aguardando' | 'carregando' | 'concluido' | 'erro'

// XCloud worker steps
type XcloudWorkerStatus = 'aguardando' | 'processando' | 'concluido' | 'falhou'
interface XcloudWorker {
  id: 'acesso' | 'dispositivo' | 'xtream'
  label: string
  subLabel: string
  status: XcloudWorkerStatus
  detail?: string
  subSteps?: string[]        // subetapas visíveis apenas para 'dispositivo'
  subStepAtivo?: number      // índice da subetapa em andamento (-1 = nenhuma)
}

interface FormData {
  nome: string
  telefone: string
  app: AppId | ''
  servidor: ServerId | ''
  deviceKey: string       // XCloud
  manualUser: string
  manualPass: string
  manualCode: string
  manualHost: string
  manualText: string
}

interface TesteGerado {
  clientName: string
  phone: string
  app: AppId
  servidor: ServerId | ''
  pedido: string           // ID do teste (pedido)
  usuario: string
  senha: string
  codigo: string
  dns: string             // Smart STB
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
  badge: string
  badgeColor: string
  color: string
  glow: string
  image: string
  servidorPadrao: ServerId | ''
}[] = [
  {
    id: 'xcloud',
    label: 'XCloud',
    badge: 'PREMIUM',
    badgeColor: '#14b8a6',
    color: '#14b8a6',
    glow: '20,184,166',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/140bd867-bdd4-43d8-9369-ae5c22b722b1-bivziPC07NHSLi0lwTyEWq4Xwga3zK.png',
    servidorPadrao: 'yellow',
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
  },
  {
    id: 'funplay',
    label: 'FunPlay',
    badge: 'POPULAR',
    badgeColor: '#ec4899',
    color: '#ec4899',
    glow: '236,72,153',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-9cnCrfCm5sltPhvF9J8wZrEp42Ech7.png',
    servidorPadrao: 'yellow',
  },
  {
    id: 'smartstb',
    label: 'Smart STB',
    badge: 'SMART TV',
    badgeColor: '#3b82f6',
    color: '#3b82f6',
    glow: '59,130,246',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/9f711896-c0bd-4d2f-bf93-59bb74f72a37-eGBRUrOFdFo4WivuZxGe57qT59c5h7.png',
    servidorPadrao: 'yellow',
  },
  {
    id: 'manual',
    label: 'Gerar teste manual',
    badge: 'LIVRE',
    badgeColor: '#64748b',
    color: '#64748b',
    glow: '100,116,139',
    image: '',
    servidorPadrao: '',
  },
]

// ─── Config: Servidores ───────────────────────────────────────────────────────

const SERVIDORES: {
  id: ServerId
  label: string
  sub: string
  color: string
  glow: string
  image: string
  status: string
  dns: string
  creditos: number
  telas: number
}[] = [
  {
    id: 'yellow',
    label: 'Yellow Box',
    sub: 'Estável · 2 telas',
    color: '#84cc16',
    glow: '132,204,22',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4f976bbd-b9a0-4464-9345-faab1188d991-GeKdgGIvSt1FeZn9dfhIMTy2s92JaX.png',
    status: 'Online',
    dns: '209.14.84.25',
    creditos: 10,
    telas: 2,
  },
  {
    id: 'ninety',
    label: 'Ninety',
    sub: 'Premium · 1 tela',
    color: '#a855f7',
    glow: '168,85,247',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/a8543a86-94bc-4402-80d8-b537ec48807f-keJkJzA3chubyxn9bwE7Wg1JEytlwW.png',
    status: 'Online',
    dns: '167.114.4.164',
    creditos: 5.5,
    telas: 1,
  },
  {
    id: 'cinemax',
    label: 'CineMax',
    sub: 'Auxiliar · 2 telas',
    color: '#f59e0b',
    glow: '245,158,11',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/367753a2-c091-4207-96fb-08efbb3ce78d-oKHw7v46xS8SBH0hDTQDXACYsUMivv.png',
    status: 'Online',
    dns: '178.156.160.255',
    creditos: 4,
    telas: 2,
  },
]

// ─── Regras de compatibilidade app × painel ───────────────────────────────────
// Teste NÃO ocupa tela. Tela só é usada na ativação de cliente pago.

const PAINEIS_POR_APP: Record<AppId, ServerId[]> = {
  xcloud:   ['yellow', 'ninety', 'cinemax'],
  blessed:  ['yellow'],
  playsim:  ['yellow', 'cinemax'],
  funplay:  ['yellow', 'cinemax'],
  smartstb: ['yellow', 'ninety', 'cinemax'],
  manual:   [],
}

function getPaineisCompativeis(app: AppId | ''): ServerId[] {
  if (!app) return []
  return PAINEIS_POR_APP[app] ?? []
}

// ─── Etapas por tipo de app ───────────────────────────────────────────────────

function getEtapas(app: AppId | ''): { id: string; label: string }[] {
  if (app === 'xcloud') return [
    { id: 'acesso',      label: 'Gerando acesso no painel' },
    { id: 'dispositivo', label: 'Adicionando aparelho no XCloud' },
    { id: 'xtream',      label: 'Vinculando credenciais Xtream' },
    { id: 'confirmacao', label: 'Confirmando ativacao' },
    { id: 'salvando',    label: 'Salvando teste' },
  ]
  if (app === 'smartstb') return [
    { id: 'validando',   label: 'Validando cliente' },
    { id: 'painel',      label: 'Obtendo DNS do servidor' },
    { id: 'credenciais', label: 'Gerando usuario e senha' },
    { id: 'salvando',    label: 'Salvando teste' },
  ]
  if (app === 'manual') return [
    { id: 'validando', label: 'Validando dados' },
    { id: 'salvando',  label: 'Salvando teste' },
    { id: 'fim',       label: 'Finalizando' },
  ]
  // blessed, playsim, funplay
  return [
    { id: 'validando',   label: 'Validando cliente' },
    { id: 'painel',      label: 'Solicitando acesso no painel' },
    { id: 'credenciais', label: 'Recebendo usuario, senha e codigo' },
    { id: 'salvando',    label: 'Salvando teste' },
  ]
}

// ─── Helpers: geração local (fallback/sandbox) ────────────────────────────────

function gerarDadosFakeMock(form: FormData): TesteGerado {
  const rand = (n = 6) => Math.random().toString(36).substring(2, 2 + n).toUpperCase()
  const nome  = form.nome.trim()
  const appId = form.app as AppId
  const srvId = (form.servidor || 'yellow') as ServerId
  const srv   = SERVIDORES.find(s => s.id === srvId)
  const dns   = srv?.dns ?? ''

  if (appId === 'manual') {
    const usuario  = form.manualUser || `usr_manual_${rand(4)}`
    const senha    = form.manualPass || rand(8)
    const codigo   = form.manualCode || `#${Math.floor(Math.random() * 9000) + 1000}`
    const host     = form.manualHost || 'http://painel.exemplo.tv'
    const val      = new Date(); val.setHours(val.getHours() + 2)
    const valBR    = val.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    const mensagem = form.manualText || [
      `Olá ${nome}! Segue seu acesso:`,
      ``,
      `Host: ${host}`,
      `Usuário: ${usuario}`,
      `Senha: ${senha}`,
      `Código: ${codigo}`,
      `Validade: ${valBR}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
    return { clientName: nome, phone: form.telefone, app: appId, servidor: srvId, pedido: `#${Math.floor(Math.random()*9000)+1000}`, usuario, senha, codigo, dns: '', xtreamHost: host, validade: valBR, mensagem, source: 'mock' }
  }

  const pedidoFake = `#${String(Math.floor(Math.random() * 9000) + 1000)}`
  const usuario   = `usr_${nome.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}${Math.floor(Math.random() * 999)}`
  const senha     = `${rand(5)}${rand(5)}`.substring(0, 10)
  const codigo    = `#${String(Math.floor(Math.random() * 9000) + 1000)}`
  const host      = 'http://srv.centralplay.tv'
  const deviceKey = form.deviceKey || `DEV-${rand(8)}`
  const val       = new Date(); val.setHours(val.getHours() + 2)
  const valBR     = val.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const appLabel  = APPS.find(a => a.id === appId)?.label ?? appId
  const srvLabel  = srv?.label ?? srvId

  let mensagem = ''
  if (appId === 'xcloud') {
    mensagem = [
      `Teste ativado com sucesso!`,
      ``,
      `Olá ${nome}! Segue seu acesso XCloud:`,
      ``,
      `Host: ${host}`,
      `Usuário: ${usuario}`,
      `Senha: ${senha}`,
      `Validade: ${valBR}`,
      ``,
      `Chave do dispositivo: ${deviceKey}`,
      ``,
      `Abra o app e clique em RELOAD ou RECARREGAR para ativar.`,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
  } else if (appId === 'smartstb') {
    mensagem = [
      `Teste ativado com sucesso!`,
      ``,
      `Olá ${nome}! Segue seu acesso Smart STB:`,
      ``,
      `Servidor: ${srvLabel}`,
      `DNS: ${dns}`,
      `Usuário: ${usuario}`,
      `Senha: ${senha}`,
      `Validade: ${valBR}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
  } else {
    mensagem = [
      `Teste ativado com sucesso!`,
      ``,
      `Olá ${nome}! Segue seu acesso ${appLabel}:`,
      ``,
      `Servidor: ${srvLabel}`,
      `Código: ${codigo}`,
      `Usuário: ${usuario}`,
      `Senha: ${senha}`,
      `Validade: ${valBR}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
  }

  return { clientName: nome, phone: form.telefone, app: appId, servidor: srvId, pedido: pedidoFake, usuario, senha, codigo, dns, xtreamHost: host, validade: valBR, mensagem, source: 'mock' }
}

// ─── Particles ────────────────────────────────────────────────────────────────

function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const setSize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    setSize()
    window.addEventListener('resize', setSize)
    type P = { x: number; y: number; vx: number; vy: number; size: number; alpha: number }
    const particles: P[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      size: Math.random() * 1.2 + 0.2,
      alpha: Math.random() * 0.25 + 0.04,
    }))
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.x = (p.x + p.vx + canvas.width) % canvas.width
        p.y = (p.y + p.vy + canvas.height) % canvas.height
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(99,155,255,${p.alpha})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { window.removeEventListener('resize', setSize); cancelAnimationFrame(raf) }
  }, [])
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 0 }} />
}

// ─── NeonBackground ───────────────────────────────────────────────────────────

function NeonBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <Particles />
      <div className="absolute rounded-full" style={{
        width: 700, height: 700, top: '-10%', left: '-15%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.14) 0%, rgba(37,99,235,0.04) 55%, transparent 70%)',
        animation: 'orbFloat1 14s ease-in-out infinite',
        filter: 'blur(1px)',
      }} />
      <div className="absolute rounded-full" style={{
        width: 550, height: 550, top: '10%', right: '-12%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.11) 0%, rgba(59,130,246,0.03) 55%, transparent 70%)',
        animation: 'orbFloat2 17s ease-in-out infinite',
        filter: 'blur(1px)',
      }} />
      <div className="absolute rounded-full" style={{
        width: 800, height: 350, bottom: '0%', left: '15%',
        background: 'radial-gradient(ellipse, rgba(14,165,233,0.07) 0%, rgba(14,165,233,0.02) 55%, transparent 70%)',
        animation: 'orbFloat3 20s ease-in-out infinite',
        filter: 'blur(2px)',
      }} />
      <div className="absolute left-0 right-0 top-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(37,99,235,0.5) 25%, rgba(59,130,246,0.7) 50%, rgba(37,99,235,0.5) 75%, transparent 100%)',
        animation: 'linePulse 5s ease-in-out infinite',
      }} />
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(59,130,246,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(59,130,246,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
      }} />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(7,10,18,0.6) 100%)',
      }} />
    </div>
  )
}

// ─── Sub-components visuais ───────────────────────────────────────────────────

function WizardCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{
      background: 'linear-gradient(180deg, #07111F 0%, #0A1728 100%)',
      border: '1px solid rgba(59,130,246,0.14)',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 28px 70px rgba(0,0,0,0.75)',
    }}>
      <div className="absolute left-0 right-0 top-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.7) 40%, rgba(99,102,241,0.6) 60%, transparent)',
      }} />
      <div className="p-7">{children}</div>
    </div>
  )
}

function InputField({ icon, label, placeholder, value, onChange, type = 'text', hint }: {
  icon: React.ReactNode; label: string; placeholder: string
  value: string; onChange: (v: string) => void; type?: string; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200"
          style={{ color: focused ? '#3b82f6' : '#334155' }}>
          {icon}
        </span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full rounded-xl pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all duration-200"
          style={{
            height: 52,
            background: focused ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.03)',
            border: focused ? '1px solid rgba(59,130,246,0.45)' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.12), 0 0 18px rgba(59,130,246,0.08)' : 'none',
          }}
        />
      </div>
      {hint && <p className="mt-1 text-[11px]" style={{ color: '#334155' }}>{hint}</p>}
    </div>
  )
}

function PrimaryButton({ onClick, disabled, children, className }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn('relative overflow-hidden rounded-xl font-bold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed', className)}
      style={{
        height: 54, fontSize: 14,
        background: disabled ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)',
        boxShadow: disabled ? 'none' : '0 0 0 1px rgba(59,130,246,0.3), 0 6px 24px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        fontFamily: 'var(--font-display)',
        width: '100%',
      }}>
      {!disabled && (
        <span className="pointer-events-none absolute inset-y-0 left-[-75%] w-1/2 skew-x-[-20deg]"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', animation: 'shineSweep 3.5s ease-in-out infinite' }} />
      )}
      <span className="relative flex items-center justify-center">{children}</span>
    </button>
  )
}

function SecondaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex items-center justify-center rounded-xl text-sm font-medium transition-all hover:bg-white/[0.05]"
      style={{ height: 54, padding: '0 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
      {children}
    </button>
  )
}

function ResumoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3.5 py-3"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#1e3a5f' }}>{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-200 truncate">{value}</p>
    </div>
  )
}

function AppCard({ selected, color, glow, image, label, badge, badgeColor, onClick }: {
  selected: boolean; color: string; glow: string; image: string
  label: string; badge?: string; badgeColor?: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="group relative flex flex-col items-center rounded-2xl pt-5 pb-4 px-2 text-center outline-none transition-all duration-200"
      style={{
        transform: selected ? 'scale(1.03)' : 'scale(1)',
        background: selected ? `linear-gradient(160deg, rgba(${glow},0.14) 0%, rgba(${glow},0.05) 100%)` : 'rgba(255,255,255,0.025)',
        border: selected ? `2px solid ${color}` : '1.5px solid rgba(255,255,255,0.06)',
        boxShadow: selected ? `0 0 0 3px rgba(${glow},0.12), 0 8px 28px rgba(${glow},0.2)` : '0 2px 8px rgba(0,0,0,0.25)',
      }}>
      {selected && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}>
          <CheckCircle className="h-3 w-3 text-white" strokeWidth={3} />
        </span>
      )}
      <div className="mb-2.5 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-xl"
        style={{ background: '#060911', border: selected ? `1.5px solid rgba(${glow},0.4)` : '1px solid rgba(255,255,255,0.05)' }}>
        {image
          ? <img src={image} alt={label} className="h-full w-full object-contain p-1.5" />
          : <Keyboard className="h-8 w-8" style={{ color }} />
        }
      </div>
      <p className="mb-1.5 text-[13px] font-semibold leading-tight text-slate-200">{label}</p>
      {badge && (
        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{
            background: selected ? badgeColor : 'rgba(255,255,255,0.05)',
            color: selected ? '#fff' : '#475569',
            border: selected ? `1px solid ${badgeColor}` : '1px solid rgba(255,255,255,0.06)',
          }}>
          {badge}
        </span>
      )}
    </button>
  )
}

function ServidorCard({ selected, color, glow, image, label, sub, status, dns, creditos, onClick, isRecommended }: {
  selected: boolean; color: string; glow: string; image: string; label: string
  sub?: string; status?: string; dns: string; creditos: number; onClick: () => void; isRecommended?: boolean
}) {
  return (
    <button onClick={onClick}
      className="group relative flex rounded-xl overflow-hidden text-left outline-none transition-all duration-200 w-full"
      style={{
        transform: selected ? 'scale(1.02)' : 'scale(1)',
        background: selected ? `linear-gradient(160deg, rgba(${glow},0.1) 0%, rgba(${glow},0.03) 100%)` : 'rgba(255,255,255,0.025)',
        border: selected ? `2px solid ${color}` : '1.5px solid rgba(255,255,255,0.06)',
        boxShadow: selected ? `0 0 0 3px rgba(${glow},0.1), 0 6px 20px rgba(${glow},0.15)` : '0 2px 8px rgba(0,0,0,0.2)',
      }}>
      {selected && (
        <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}>
          <CheckCircle className="h-3 w-3 text-white" strokeWidth={3} />
        </span>
      )}
      <div className="flex h-[68px] w-[84px] shrink-0 items-center justify-center"
        style={{ background: '#050810', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
        <img src={image} alt={label} className="h-[46px] w-[46px] object-contain" />
      </div>
      <div className="flex flex-1 items-center justify-between px-4 py-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold leading-tight text-slate-200">{label}</p>
            {isRecommended && <span className="text-[9px] font-bold text-emerald-400 uppercase">Recomendado</span>}
          </div>
          {sub && <p className="mt-0.5 text-[11px] font-medium" style={{ color: selected ? color : '#334155' }}>{sub}</p>}
          <p className="text-[10px] mt-0.5" style={{ color: '#1e3a5f' }}>DNS: {dns}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {status && (
            <div className="flex items-center gap-1.5 rounded-full px-2 py-1"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[9px] font-bold text-emerald-400">{status}</span>
            </div>
          )}
          <span className="text-[10px]" style={{ color: creditos < 3 ? '#f87171' : creditos < 6 ? '#fbbf24' : '#4ade80' }}>
            {creditos} créd.
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Step 1: Dados ────────────────────────────────────────────────────────────

function StepDados({ form, onChange, onNext, canProceed }: {
  form: FormData; onChange: (f: FormData) => void; onNext: () => void; canProceed: boolean
}) {
  return (
    <WizardCard>
      <div className="flex items-center gap-3.5 mb-7">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', boxShadow: '0 0 22px rgba(59,130,246,0.18)' }}>
          <User style={{ width: 23, height: 23, color: '#60a5fa' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Novo teste</h1>
          <p className="text-sm text-muted-foreground">Informe os dados para gerar o acesso.</p>
        </div>
      </div>
      <div className="space-y-4">
        <InputField icon={<User className="h-[18px] w-[18px]" />} label="Nome do cliente" placeholder="João Silva"
          value={form.nome} onChange={v => onChange({ ...form, nome: v })} />
        <InputField icon={<Phone className="h-[18px] w-[18px]" />} label="Telefone / WhatsApp" placeholder="(22) 99999-9999"
          type="tel" value={form.telefone} onChange={v => onChange({ ...form, telefone: v })} />
      </div>
      <div className="mt-8">
        <PrimaryButton onClick={onNext} disabled={!canProceed}>
          Continuar <ArrowRight className="h-[18px] w-[18px] ml-2" />
        </PrimaryButton>
      </div>
    </WizardCard>
  )
}

// ─── Step 2: App ──────────────────────────────────────────────────────────────

function StepApp({ form, onChange, onNext, onBack, canProceed }: {
  form: FormData; onChange: (f: FormData) => void; onNext: () => void; onBack: () => void; canProceed: boolean
}) {
  return (
    <WizardCard>
      <div className="flex items-center gap-3.5 mb-7">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', boxShadow: '0 0 22px rgba(239,68,68,0.18)' }}>
          <Zap style={{ width: 23, height: 23, color: '#f87171' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Escolha o aplicativo</h1>
          <p className="text-sm text-muted-foreground">Qual app {form.nome.split(' ')[0]} vai usar?</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        {APPS.map(app => (
          <AppCard
            key={app.id}
            selected={form.app === app.id}
            color={app.color}
            glow={app.glow}
            image={app.image}
            label={app.label}
            badge={app.badge}
            badgeColor={app.badgeColor}
            onClick={() => onChange({ ...form, app: app.id, servidor: app.servidorPadrao })}
          />
        ))}
      </div>
      <div className="mt-8 flex gap-3">
        <SecondaryButton onClick={onBack}><ArrowLeft className="h-[18px] w-[18px] mr-1.5" />Voltar</SecondaryButton>
        <PrimaryButton onClick={onNext} disabled={!canProceed} className="flex-1">
          Continuar <ArrowRight className="h-[18px] w-[18px] ml-2" />
        </PrimaryButton>
      </div>
    </WizardCard>
  )
}

// ─── Step 3: Servidor ─────────────────────────────────────────────────────────

function StepServidor({ form, onChange, onNext, onBack, canProceed, mostrarTodos, setMostrarTodos }: {
  form: FormData; onChange: (f: FormData) => void; onNext: () => void; onBack: () => void
  canProceed: boolean; mostrarTodos: boolean; setMostrarTodos: (v: boolean) => void
}) {
  const appSelecionado      = APPS.find(a => a.id === form.app)
  const servidorSelecionado = SERVIDORES.find(s => s.id === form.servidor)
  const compativeis         = getPaineisCompativeis(form.app)
  const servidoresFiltrados = SERVIDORES.filter(s => compativeis.includes(s.id))

  return (
    <WizardCard>
      <div className="flex items-center gap-3.5 mb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', boxShadow: '0 0 22px rgba(168,85,247,0.18)' }}>
          <Server style={{ width: 23, height: 23, color: '#c084fc' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Servidor</h1>
          <p className="text-sm text-muted-foreground">Selecionado automaticamente</p>
        </div>
      </div>

      {/* Aviso fixo: teste não ocupa tela */}
      <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 mb-5"
        style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
        <p className="text-[11px] text-amber-400/80">
          Teste <strong>não ocupa tela.</strong> A tela só será usada na ativação do cliente.
        </p>
      </div>

      {servidorSelecionado && !mostrarTodos && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-2.5">Servidor recomendado</p>
          <ServidorCard
            selected
            color={servidorSelecionado.color}
            glow={servidorSelecionado.glow}
            image={servidorSelecionado.image}
            label={servidorSelecionado.label}
            sub={servidorSelecionado.sub}
            status={servidorSelecionado.status}
            dns={servidorSelecionado.dns}
            creditos={servidorSelecionado.creditos}
            onClick={() => {}}
          />
          {servidoresFiltrados.length > 1 && (
            <button onClick={() => setMostrarTodos(true)}
              className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
              <ChevronDown className="h-3.5 w-3.5" />
              Alterar servidor
            </button>
          )}
        </div>
      )}

      {mostrarTodos && (
        <div className="space-y-3 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
            Servidores compatíveis com {appSelecionado?.label}
          </p>
          {servidoresFiltrados.map(s => (
            <ServidorCard
              key={s.id}
              selected={form.servidor === s.id}
              color={s.color}
              glow={s.glow}
              image={s.image}
              label={s.label}
              sub={s.sub}
              status={s.status}
              dns={s.dns}
              creditos={s.creditos}
              onClick={() => { onChange({ ...form, servidor: s.id }); setMostrarTodos(false) }}
              isRecommended={s.id === appSelecionado?.servidorPadrao}
            />
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <SecondaryButton onClick={onBack}><ArrowLeft className="h-[18px] w-[18px] mr-1.5" />Voltar</SecondaryButton>
        <PrimaryButton onClick={onNext} disabled={!canProceed} className="flex-1">
          Continuar <ArrowRight className="h-[18px] w-[18px] ml-2" />
        </PrimaryButton>
      </div>
    </WizardCard>
  )
}

// ─── Step 4: Extra (XCloud = deviceKey / Smart STB = usuário+senha+DNS / Manual = texto livre) ─────

function StepExtra({ form, onChange, onNext, onBack }: {
  form: FormData; onChange: (f: FormData) => void; onNext: () => void; onBack: () => void
}) {
  const isXCloud   = form.app === 'xcloud'
  const isSmartStb = form.app === 'smartstb'
  const isManual   = form.app === 'manual'
  const srv        = SERVIDORES.find(s => s.id === form.servidor)
  const dns        = srv?.dns ?? ''

  const canProceed = isXCloud
    ? true  // chave é opcional
    : isSmartStb
      ? form.manualUser.trim().length > 0 && form.manualPass.trim().length > 0
      : true  // manual: tudo opcional

  return (
    <WizardCard>
      <div className="flex items-center gap-3.5 mb-7">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', boxShadow: '0 0 22px rgba(34,197,94,0.18)' }}>
          <Zap style={{ width: 23, height: 23, color: '#4ade80' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            {isXCloud ? 'Chave do dispositivo' : isSmartStb ? 'Credenciais Smart STB' : 'Dados manuais'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isXCloud ? 'Opcional — você pode preencher agora ou depois' : isSmartStb ? 'Informe usuário e senha do teste' : 'Preencha os dados livremente'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {isXCloud && (
          <InputField icon={<Zap className="h-[18px] w-[18px]" />} label="Chave do dispositivo XCloud"
            placeholder="Ex: DEV-A1B2C3D4E5" value={form.deviceKey}
            onChange={v => onChange({ ...form, deviceKey: v })}
            hint="Deixe em branco para gerar automaticamente" />
        )}

        {isSmartStb && (
          <>
            {/* DNS pré-preenchido a partir do servidor selecionado */}
            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#1e3a5f' }}>DNS do servidor</p>
                <p className="text-sm font-bold text-slate-200">{dns || 'Selecione um servidor'}</p>
              </div>
              <Server className="h-5 w-5" style={{ color: '#3b82f6' }} />
            </div>
            <InputField icon={<User className="h-[18px] w-[18px]" />} label="Usuário *"
              placeholder="usuario_teste" value={form.manualUser}
              onChange={v => onChange({ ...form, manualUser: v })} />
            <InputField icon={<Zap className="h-[18px] w-[18px]" />} label="Senha *"
              placeholder="senha123" value={form.manualPass}
              onChange={v => onChange({ ...form, manualPass: v })} />
          </>
        )}

        {isManual && (
          <>
            <InputField icon={<User className="h-[18px] w-[18px]" />} label="Usuário" placeholder="usuario_teste"
              value={form.manualUser} onChange={v => onChange({ ...form, manualUser: v })} />
            <InputField icon={<Zap className="h-[18px] w-[18px]" />} label="Senha" placeholder="senha_aqui"
              value={form.manualPass} onChange={v => onChange({ ...form, manualPass: v })} />
            <InputField icon={<Server className="h-[18px] w-[18px]" />} label="Código" placeholder="#1234"
              value={form.manualCode} onChange={v => onChange({ ...form, manualCode: v })} />
            <InputField icon={<Server className="h-[18px] w-[18px]" />} label="Host / URL" placeholder="http://painel.tv"
              value={form.manualHost} onChange={v => onChange({ ...form, manualHost: v })} />
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
                Texto livre (opcional)
              </label>
              <textarea
                rows={4}
                placeholder="Escreva a mensagem manualmente..."
                value={form.manualText}
                onChange={e => onChange({ ...form, manualText: e.target.value })}
                className="w-full rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all duration-200 resize-none"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <SecondaryButton onClick={onBack}><ArrowLeft className="h-[18px] w-[18px] mr-1.5" />Voltar</SecondaryButton>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="relative flex-1 overflow-hidden rounded-xl font-bold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            height: 56, fontSize: 15,
            background: canProceed ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)' : 'rgba(34,197,94,0.3)',
            boxShadow: canProceed ? '0 0 0 1px rgba(34,197,94,0.3), 0 6px 28px rgba(34,197,94,0.45), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
            fontFamily: 'var(--font-display)',
          }}>
          {canProceed && (
            <span className="pointer-events-none absolute inset-y-0 left-[-75%] w-1/2 skew-x-[-20deg]"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', animation: 'shineSweep 3.5s ease-in-out infinite' }} />
          )}
          <span className="relative flex items-center justify-center gap-2.5">
            <Zap className="h-[20px] w-[20px]" />
            Gerar teste
          </span>
        </button>
      </div>
    </WizardCard>
  )
}

// ─── Step Confirmar (quando não há passo extra) ────────────────────────────────

function StepConfirmar({ form, onBack, onGerar }: { form: FormData; onBack: () => void; onGerar: () => void }) {
  const appSelecionado      = APPS.find(a => a.id === form.app)
  const servidorSelecionado = SERVIDORES.find(s => s.id === form.servidor)

  return (
    <WizardCard>
      <div className="flex items-center gap-3.5 mb-7">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', boxShadow: '0 0 22px rgba(34,197,94,0.18)' }}>
          <Zap style={{ width: 23, height: 23, color: '#4ade80' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Gerar teste</h1>
          <p className="text-sm text-muted-foreground">Confirme os dados antes de gerar</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-7">
        <ResumoItem label="Cliente"    value={form.nome} />
        <ResumoItem label="Telefone"   value={form.telefone} />
        <ResumoItem label="Aplicativo" value={appSelecionado?.label || ''} />
        <ResumoItem label="Servidor"   value={servidorSelecionado?.label || ''} />
      </div>
      <div className="flex gap-3">
        <SecondaryButton onClick={onBack}><ArrowLeft className="h-[18px] w-[18px] mr-1.5" />Voltar</SecondaryButton>
        <button
          onClick={onGerar}
          className="relative flex-1 overflow-hidden rounded-xl font-bold text-white transition-all duration-200"
          style={{ height: 56, fontSize: 15, background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)', boxShadow: '0 0 0 1px rgba(34,197,94,0.3), 0 6px 28px rgba(34,197,94,0.45), inset 0 1px 0 rgba(255,255,255,0.15)', fontFamily: 'var(--font-display)' }}>
          <span className="pointer-events-none absolute inset-y-0 left-[-75%] w-1/2 skew-x-[-20deg]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', animation: 'shineSweep 3.5s ease-in-out infinite' }} />
          <span className="relative flex items-center justify-center gap-2.5">
            <Zap className="h-[20px] w-[20px]" /> Gerar teste
          </span>
        </button>
      </div>
    </WizardCard>
  )
}

// ─── Tela Gerando XCloud (3 workers orquestrados) ────────────────────────────

function TelaGerandoXCloud({ form, workers, onRetry, onModoManual, onVerLog }: {
  form: FormData
  workers: XcloudWorker[]
  onRetry: (step: XcloudWorker['id']) => void
  onModoManual: () => void
  onVerLog?: () => void
}) {
  const srv = SERVIDORES.find(s => s.id === form.servidor)

  const corBg = (s: XcloudWorkerStatus) => {
    if (s === 'concluido')   return 'rgba(34,197,94,0.07)'
    if (s === 'processando') return 'rgba(37,99,235,0.10)'
    if (s === 'falhou')      return 'rgba(239,68,68,0.07)'
    return 'rgba(255,255,255,0.02)'
  }
  const corBorder = (s: XcloudWorkerStatus) => {
    if (s === 'concluido')   return 'rgba(34,197,94,0.15)'
    if (s === 'processando') return 'rgba(37,99,235,0.22)'
    if (s === 'falhou')      return 'rgba(239,68,68,0.18)'
    return 'rgba(255,255,255,0.04)'
  }

  const workerFalhou = workers.find(w => w.status === 'falhou')
  const temFalha     = Boolean(workerFalhou)

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-7 text-center">
        <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.14) 0%, transparent 70%)', boxShadow: '0 0 48px rgba(20,184,166,0.22)', animation: 'linePulse 2s ease-in-out infinite' }} />
          <div className="absolute h-20 w-20 rounded-full border-[3px] animate-spin"
            style={{ borderColor: 'rgba(20,184,166,0.08)', borderTopColor: '#14b8a6', borderRightColor: 'rgba(20,184,166,0.35)', animationDuration: '1.4s' }} />
          <div className="absolute h-13 w-13 rounded-full border-2 animate-spin"
            style={{ borderColor: 'transparent', borderTopColor: 'rgba(34,197,94,0.45)', animationDuration: '2.4s', animationDirection: 'reverse' }} />
          <Zap style={{ width: 26, height: 26, color: '#14b8a6' }} />
        </div>
        <h2 className="mb-1 text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          Gerando teste XCloud
        </h2>
        <p className="text-sm text-muted-foreground">{form.nome} · {srv?.label ?? form.servidor}</p>
      </motion.div>

      {/* Workers */}
      <div className="space-y-2.5 mb-5">
        {workers.map((w, i) => {
          const isDispositivo = w.id === 'dispositivo'
          const subSteps      = w.subSteps ?? []
          const subAtivo      = w.subStepAtivo ?? -1
          const expandido     = isDispositivo && (w.status === 'processando' || w.status === 'concluido' || w.status === 'falhou')

          return (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl overflow-hidden transition-all duration-300"
              style={{ background: corBg(w.status), border: `1px solid ${corBorder(w.status)}` }}
            >
              {/* Linha principal do worker */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Indicador de status */}
                <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                  style={{
                    background: w.status === 'concluido' ? 'rgba(34,197,94,0.15)' : w.status === 'processando' ? 'rgba(37,99,235,0.15)' : w.status === 'falhou' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
                    boxShadow: w.status === 'concluido' ? '0 0 12px rgba(34,197,94,0.4)' : w.status === 'processando' ? '0 0 12px rgba(59,130,246,0.35)' : 'none',
                  }}>
                  {w.status === 'concluido'   && <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={3} />}
                  {w.status === 'processando' && <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />}
                  {w.status === 'falhou'      && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                  {w.status === 'aguardando'  && <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight"
                    style={{ color: w.status === 'concluido' ? '#86efac' : w.status === 'processando' ? '#93c5fd' : w.status === 'falhou' ? '#f87171' : '#475569' }}>
                    {w.label}
                  </p>
                  {!expandido && w.status !== 'aguardando' && (
                    <p className="text-[11px] mt-0.5" style={{ color: w.status === 'falhou' ? '#f87171' : '#334155' }}>
                      {w.status === 'falhou' ? 'Device nao ficou pronta para vincular Xtream' : w.subLabel}
                    </p>
                  )}
                </div>

                {w.status === 'processando' && (
                  <div className="h-3.5 w-3.5 rounded-full border-2 animate-spin shrink-0"
                    style={{ borderColor: 'rgba(59,130,246,0.18)', borderTopColor: '#3b82f6' }} />
                )}
                {w.status === 'concluido' && (
                  <span className="text-[10px] font-bold text-emerald-500 shrink-0 uppercase tracking-wide">OK</span>
                )}
              </div>

              {/* Subetapas expandidas (apenas worker dispositivo) */}
              {expandido && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3.5 pt-0">
                    <div className="ml-[calc(28px+12px)] space-y-1.5">
                      {subSteps.map((step, si) => {
                        const concluida  = w.status === 'concluido' || si < subAtivo
                        const ativa      = w.status === 'processando' && si === subAtivo
                        const futura     = !concluida && !ativa
                        return (
                          <div key={step} className="flex items-center gap-2">
                            <div className="h-3.5 w-3.5 shrink-0 flex items-center justify-center rounded-full transition-all duration-200"
                              style={{ background: concluida ? 'rgba(34,197,94,0.18)' : ativa ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)' }}>
                              {concluida && <Check className="h-2 w-2 text-emerald-400" strokeWidth={3.5} />}
                              {ativa     && <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
                              {futura    && <div className="h-1 w-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />}
                            </div>
                            <span className="text-[11px] transition-all duration-200"
                              style={{ color: concluida ? '#4ade80' : ativa ? '#93c5fd' : '#334155' }}>
                              {step}
                            </span>
                          </div>
                        )
                      })}
                      {w.status === 'falhou' && (
                        <p className="mt-1 text-[11px] font-medium" style={{ color: '#f87171' }}>
                          Device nao ficou pronta para vincular Xtream
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Acoes quando falha */}
      {temFalha && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="space-y-2">
          {/* Retry — destaque */}
          <button
            onClick={() => onRetry(workerFalhou!.id)}
            className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: 'rgba(37,99,235,0.12)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.2)' }}>
            <RotateCcw className="h-4 w-4" />
            Tentar novamente
          </button>
          {/* Secundarios */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onModoManual}
              className="h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Keyboard className="h-3.5 w-3.5" />
              Modo manual
            </button>
            {onVerLog && (
              <button
                onClick={onVerLog}
                className="h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Server className="h-3.5 w-3.5" />
                Ver log
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Tela Modo Manual XCloud ──────────────────────────────────────────────────

function TelaModoManualXCloud({ teste, onNovo }: { teste: TesteGerado; onNovo: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  const { addToast } = useToast()

  const copiarItem = (label: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopied(label)
    addToast('success', `${label} copiado!`)
    setTimeout(() => setCopied(null), 2000)
  }

  const itens = [
    { label: 'Painel XCloud', value: 'https://xcloud.tv/panel' },
    { label: 'Device Key',    value: teste.usuario.replace(/./g, (c, i) => i < 4 ? c : '*') },
    { label: 'Host',          value: teste.xtreamHost },
    { label: 'Usuario',       value: teste.usuario },
    { label: 'Senha',         value: teste.senha },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <div className="text-center mb-6">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <Keyboard className="h-7 w-7 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Modo manual XCloud</h2>
        <p className="mt-1 text-sm text-slate-500">Copie os dados e conclua a ativacao manualmente</p>
      </div>
      <div className="space-y-2 mb-6">
        {itens.map(item => (
          <div key={item.label} className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{item.label}</p>
              <p className="text-sm font-semibold text-slate-200">{item.value}</p>
            </div>
            <button onClick={() => copiarItem(item.label, item.value)}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-all"
              style={{ background: copied === item.label ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)' }}>
              {copied === item.label
                ? <Check className="h-4 w-4 text-emerald-400" />
                : <Copy className="h-4 w-4 text-slate-500" />}
            </button>
          </div>
        ))}
      </div>
      <button onClick={onNovo}
        className="w-full h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
        <RotateCcw className="h-4 w-4" /> Gerar outro teste
      </button>
    </motion.div>
  )
}

// ─── Tela Gerando ─────────────────────────────────────────────────────────────

function TelaGerando({ form, etapas }: { form: FormData; etapas: EtapaGeracao[] }) {
  const appSelecionado      = APPS.find(a => a.id === form.app)
  const servidorSelecionado = SERVIDORES.find(s => s.id === form.servidor)

  return (
    <div className="w-full max-w-md">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
        <div className="relative mx-auto mb-8 flex h-32 w-32 items-center justify-center">
          <div className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)', boxShadow: '0 0 60px rgba(37,99,235,0.3)', animation: 'linePulse 2s ease-in-out infinite' }} />
          <div className="absolute h-28 w-28 rounded-full border-[3px] animate-spin"
            style={{ borderColor: 'rgba(59,130,246,0.1)', borderTopColor: '#3b82f6', borderRightColor: 'rgba(59,130,246,0.4)', boxShadow: '0 0 30px rgba(59,130,246,0.5)', animationDuration: '1.2s' }} />
          <div className="absolute h-20 w-20 rounded-full border-2 animate-spin"
            style={{ borderColor: 'transparent', borderTopColor: 'rgba(34,197,94,0.6)', animationDuration: '2s', animationDirection: 'reverse' }} />
          <Server style={{ width: 32, height: 32, color: '#3b82f6' }} />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Gerando teste para</h2>
        <p className="text-xl font-semibold text-primary">{form.nome}</p>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {appSelecionado && <><span>{appSelecionado.label}</span><span>•</span></>}
          {servidorSelecionado && <span>{servidorSelecionado.label}</span>}
        </div>
      </motion.div>

      <div className="space-y-2">
        {etapas.map((etapa, i) => {
          const feita   = etapa.status === 'concluido'
          const ativa   = etapa.status === 'carregando'
          const pendente = etapa.status === 'aguardando'
          return (
            <motion.div key={etapa.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-4 rounded-xl px-4 py-3.5 transition-all duration-300"
              style={{
                background: ativa ? 'rgba(37,99,235,0.12)' : feita ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                border: ativa ? '1px solid rgba(37,99,235,0.25)' : feita ? '1px solid rgba(34,197,94,0.15)' : '1px solid rgba(255,255,255,0.04)',
              }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                style={{
                  background: feita ? '#22c55e' : ativa ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.04)',
                  boxShadow: feita ? '0 0 16px rgba(34,197,94,0.5)' : ativa ? '0 0 16px rgba(59,130,246,0.4)' : 'none',
                }}>
                {feita
                  ? <CheckCircle className="h-5 w-5 text-white" strokeWidth={3} />
                  : ativa
                    ? <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400" />
                    : <div className="h-2 w-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
                }
              </div>
              <span className="flex-1 text-sm font-medium transition-all duration-300"
                style={{ color: feita ? '#86efac' : ativa ? '#93c5fd' : '#475569' }}>
                {etapa.label}
              </span>
              {feita   && <span className="text-[11px] font-bold text-emerald-400">✓</span>}
              {ativa   && <div className="h-4 w-4 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(59,130,246,0.2)', borderTopColor: '#3b82f6' }} />}
              {pendente && <span className="text-[11px] text-muted-foreground">○</span>}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tela Sucesso ─────────────────────────────────────────────────────────────

function TelaSucesso({ teste, onNovo, onVerTestes, onAtivar, onVerLog }: {
  teste: TesteGerado
  onNovo: () => void
  onVerTestes?: () => void
  onAtivar?: () => void
  onVerLog?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()

  const appSelecionado      = APPS.find(a => a.id === teste.app)
  const servidorSelecionado = SERVIDORES.find(s => s.id === teste.servidor)
  const isXCloud   = teste.app === 'xcloud'
  const isSmartStb = teste.app === 'smartstb'
  const isManual   = teste.app === 'manual'

  const copiarDados = () => {
    const linhas = campos
      .filter(c => c.value)
      .map(c => `${c.label}: ${c.value}`)
      .join('\n')
    navigator.clipboard.writeText(linhas)
    setCopied(true)
    addToast('success', 'Dados copiados!')
    setTimeout(() => setCopied(false), 2000)
  }

  const abrirPainel2 = () => {
    const params = new URLSearchParams({
      cliente: teste.clientName,
      telefone: teste.phone,
      pedido:  teste.pedido,
      app:     teste.app,
    })
    window.open(`https://painel2.centralplayplus.com.br?${params.toString()}`, '_blank')
  }

  // deviceKey mascarada: mostra primeiros 4 e substitui o resto por *
  const mascaraDeviceKey = (key: string) => key.length > 4 ? key.substring(0, 4) + '*'.repeat(Math.min(key.length - 4, 8)) : key

  const campos = [
    { label: 'Cliente',    value: teste.clientName },
    { label: 'Telefone',   value: teste.phone },
    { label: 'Pedido',     value: teste.pedido },
    { label: 'Aplicativo', value: appSelecionado?.label ?? teste.app },
    ...(!isManual && servidorSelecionado ? [{ label: 'Painel gerador', value: servidorSelecionado.label }] : []),
    ...(isXCloud && teste.usuario ? [{ label: 'Device Key', value: mascaraDeviceKey(teste.usuario) }] : []),
    ...(isSmartStb ? [{ label: 'DNS', value: teste.dns }] : []),
    ...(isXCloud   ? [{ label: 'Host', value: teste.xtreamHost }] : []),
    ...(!isXCloud && !isManual ? [{ label: 'Codigo', value: teste.codigo }] : []),
    { label: 'Usuario',    value: teste.usuario },
    { label: 'Senha',      value: teste.senha },
    { label: 'Validade',   value: teste.validade },
  ]

  // Badges de status XCloud
  const xcloudStatus = isXCloud ? [
    { label: 'Acesso gerado',      ok: true },
    { label: 'Device adicionado',  ok: true },
    { label: 'Xtream vinculado',   ok: true },
    { label: 'RELOAD confirmado',  ok: true },
  ] : null

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', boxShadow: '0 0 40px rgba(34,197,94,0.25)' }}>
          <CheckCircle className="h-10 w-10 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Teste gerado com sucesso!</h1>
        <p className="mt-1 text-sm text-muted-foreground">{teste.clientName} · {teste.pedido}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{ background: teste.source === 'supabase' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${teste.source === 'supabase' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: teste.source === 'supabase' ? '#4ade80' : '#fbbf24' }} />
          <span className="text-[11px] font-medium" style={{ color: teste.source === 'supabase' ? '#4ade80' : '#fbbf24' }}>
            {teste.source === 'supabase' ? 'Registrado no Supabase' : 'Sandbox / Mock'}
          </span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #07111F 0%, #0A1728 100%)', border: '1px solid rgba(59,130,246,0.14)', boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 32px 64px rgba(0,0,0,0.7)' }}>
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.5) 40%, rgba(59,130,246,0.4) 60%, transparent)' }} />
        <div className="p-6">
          {/* Status XCloud */}
          {xcloudStatus && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="grid grid-cols-2 gap-1.5 mb-5">
              {xcloudStatus.map(s => (
                <div key={s.label} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                  style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span className="text-[11px] font-medium text-emerald-400/80">{s.label}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Dados tecnicos */}
          <div className="mb-5 grid grid-cols-2 gap-2.5">
            {campos.map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.04 }}
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#1e3a5f' }}>{item.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-200 truncate">{item.value}</p>
              </motion.div>
            ))}
          </div>

          {/* CTA Principal — Abrir no Painel 2 */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mb-2.5">
            <button onClick={abrirPainel2}
              className="relative w-full overflow-hidden flex h-14 items-center justify-center gap-3 rounded-xl text-base font-bold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)', boxShadow: '0 0 0 1px rgba(59,130,246,0.3), 0 8px 32px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.12)', fontFamily: 'var(--font-display)' }}>
              <span className="pointer-events-none absolute inset-y-0 left-[-75%] w-1/2 skew-x-[-20deg]"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', animation: 'shineSweep 3.5s ease-in-out infinite' }} />
              <ExternalLink className="h-5 w-5 relative" />
              <div className="relative flex flex-col items-start">
                <span className="leading-tight">Abrir no Painel 2</span>
                <span className="text-[10px] font-normal opacity-60 leading-tight">Mensagens, instalacao e fluxos em tempo real</span>
              </div>
            </button>
          </motion.div>

          {/* Ativar cliente */}
          {onAtivar && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.68 }} className="mb-3">
              <button onClick={onAtivar}
                className="relative w-full overflow-hidden flex h-12 items-center justify-center gap-2.5 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', boxShadow: '0 0 0 1px rgba(34,197,94,0.25), 0 4px 16px rgba(34,197,94,0.3)', fontFamily: 'var(--font-display)' }}>
                <Zap className="h-4.5 w-4.5 relative" />
                <span className="relative">Ativar cliente</span>
                <span className="relative text-[10px] font-normal opacity-60">ocupa tela</span>
              </button>
            </motion.div>
          )}

          {/* Acoes secundarias */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className="grid grid-cols-3 gap-2">
            <button onClick={copiarDados}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.07]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
              {copied ? <CheckCircle className="h-[17px] w-[17px] text-emerald-400" /> : <Copy className="h-[17px] w-[17px]" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button onClick={onNovo}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.05]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#64748b' }}>
              <RotateCcw className="h-[17px] w-[17px]" />
              Novo
            </button>
            {onVerTestes ? (
              <button onClick={onVerTestes}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.05]"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#64748b' }}>
                <ExternalLink className="h-[17px] w-[17px]" />
                Testes
              </button>
            ) : onVerLog ? (
              <button onClick={onVerLog}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.05]"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#64748b' }}>
                <Server className="h-[17px] w-[17px]" />
                Ver log
              </button>
            ) : null}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const STEP_LABELS: Record<WizardStep, string> = {
  dados:    'Dados',
  app:      'App',
  servidor: 'Servidor',
  extra:    'Gerar',
}

const STEP_ORDER: WizardStep[] = ['dados', 'app', 'servidor', 'extra']

export function GerarTesteWizard({ onNavigate }: { onNavigate?: (p: NavPage) => void }) {
  const [wizardStep,  setWizardStep]  = useState<WizardStep>('dados')
  const [processStep, setProcessStep] = useState<ProcessStep | null>(null)
  const [form, setForm] = useState<FormData>({
    nome: '', telefone: '', app: '', servidor: '',
    deviceKey: '', manualUser: '', manualPass: '', manualCode: '', manualHost: '', manualText: '',
  })
  const [etapas,    setEtapas]    = useState<EtapaGeracao[]>([])
  const [teste,     setTeste]     = useState<TesteGerado | null>(null)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [mostrarServidores, setMostrarServidores] = useState(false)
  const [modoManualXcloud, setModoManualXcloud] = useState(false)

  // XCloud workers state
  const WORKERS_INIT: XcloudWorker[] = [
    { id: 'acesso',      label: 'Gerando acesso',       subLabel: 'Credenciais Xtream no painel gerador', status: 'aguardando' },
    {
      id: 'dispositivo', label: 'Adicionando aparelho',  subLabel: 'Validando device no XCloud',          status: 'aguardando',
      subSteps: [
        'Device enviada',
        'Atualizando lista',
        'Device encontrada',
        'Status Active confirmado',
        'Playlist vazia confirmada',
        'Pronto para vincular Xtream',
      ],
      subStepAtivo: -1,
    },
    { id: 'xtream',      label: 'Vinculando XCloud',    subLabel: 'Custom Playlist via Xtream Credentials', status: 'aguardando' },
  ]
  const [xcloudWorkers, setXcloudWorkers] = useState<XcloudWorker[]>(WORKERS_INIT)
  const { addToast } = useToast()

  // Smart STB tem painel mas precisa de extra (usuário+senha)
  const precisaExtra = form.app === 'xcloud' || form.app === 'manual' || form.app === 'smartstb'
  // Manual não usa painel real
  const semPainel    = form.app === 'manual'

  // Passos visíveis no stepper
  const stepsVisiveis: WizardStep[] = semPainel
    ? ['dados', 'app', 'extra']
    : precisaExtra
      ? ['dados', 'app', 'servidor', 'extra']
      : ['dados', 'app', 'servidor']

  const canProceed: Record<WizardStep, boolean> = {
    dados:    form.nome.trim().length >= 2 && form.telefone.replace(/\D/g, '').length >= 10,
    app:      !!form.app,
    servidor: !!form.servidor,
    extra:    true,
  }

  const goNext = (from: WizardStep) => {
    setDirection(1)
    if (from === 'app') {
      if (semPainel) { setWizardStep('extra'); return }
      setWizardStep('servidor'); return
    }
    if (from === 'servidor') {
      if (precisaExtra) { setWizardStep('extra'); return }
      iniciarGeracao(); return
    }
    const idx = STEP_ORDER.indexOf(from)
    if (idx < STEP_ORDER.length - 1) setWizardStep(STEP_ORDER[idx + 1])
  }

  const goBack = (from: WizardStep) => {
    setDirection(-1)
    if (from === 'extra' && semPainel) { setWizardStep('app'); return }
    const idx = STEP_ORDER.indexOf(from)
    if (idx > 0) setWizardStep(STEP_ORDER[idx - 1])
  }

  const iniciarGeracao = () => {
    const etapasBase = getEtapas(form.app)
    setEtapas(etapasBase.map(e => ({ ...e, status: 'aguardando' })))
    // XCloud: resetar workers para aguardando
    if (form.app === 'xcloud') {
      setXcloudWorkers(prev => prev.map(w => ({ ...w, status: 'aguardando', detail: undefined })))
    }
    setProcessStep('gerando')
  }

  // Animação de etapas + chamada ao endpoint
  useEffect(() => {
    if (processStep !== 'gerando') return
    const etapasBase = getEtapas(form.app)
    const timers: ReturnType<typeof setTimeout>[] = []

    // XCloud: anima os 3 workers em sequencia, com subetapas no worker 'dispositivo'
    if (form.app === 'xcloud') {
      // Worker 1 — acesso (inicia logo)
      timers.push(setTimeout(() => {
        setXcloudWorkers(prev => prev.map(w => w.id === 'acesso' ? { ...w, status: 'processando' } : w))
      }, 0))
      timers.push(setTimeout(() => {
        setXcloudWorkers(prev => prev.map(w => w.id === 'acesso' ? { ...w, status: 'concluido' } : w))
      }, 900))

      // Worker 2 — dispositivo com 6 subetapas (inicia em t=1100)
      const BASE_DISP = 1100
      const INTERVALO = 420 // ms por subetapa
      timers.push(setTimeout(() => {
        setXcloudWorkers(prev => prev.map(w => w.id === 'dispositivo' ? { ...w, status: 'processando', subStepAtivo: 0 } : w))
      }, BASE_DISP))
      for (let i = 0; i < 6; i++) {
        const t = BASE_DISP + i * INTERVALO
        timers.push(setTimeout(() => {
          setXcloudWorkers(prev => prev.map(w =>
            w.id === 'dispositivo' ? { ...w, subStepAtivo: i } : w
          ))
        }, t))
      }
      timers.push(setTimeout(() => {
        setXcloudWorkers(prev => prev.map(w => w.id === 'dispositivo' ? { ...w, status: 'concluido', subStepAtivo: 6 } : w))
      }, BASE_DISP + 6 * INTERVALO))

      // Worker 3 — xtream (inicia depois que dispositivo termina)
      const BASE_XTREAM = BASE_DISP + 6 * INTERVALO + 200
      timers.push(setTimeout(() => {
        setXcloudWorkers(prev => prev.map(w => w.id === 'xtream' ? { ...w, status: 'processando' } : w))
      }, BASE_XTREAM))
      timers.push(setTimeout(() => {
        setXcloudWorkers(prev => prev.map(w => w.id === 'xtream' ? { ...w, status: 'concluido' } : w))
      }, BASE_XTREAM + 900))
    }

    etapasBase.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setEtapas(prev => prev.map((e, j) => j === i ? { ...e, status: 'carregando' } : j < i ? { ...e, status: 'concluido' } : e))
      }, i * 650))
      timers.push(setTimeout(() => {
        setEtapas(prev => prev.map((e, j) => j === i ? { ...e, status: 'concluido' } : e))
      }, i * 650 + 520))
    })

    const minDelay = etapasBase.length * 650 + 400

    const fetchTeste = async (): Promise<TesteGerado> => {
      try {
        const srv = SERVIDORES.find(s => s.id === form.servidor)
        const payload = {
          clientName: form.nome,
          phone:      form.telefone,
          app:        form.app,
          provider:   form.servidor || 'yellow',
          deviceKey:  form.deviceKey || undefined,
          manualFields: (form.app === 'manual' || form.app === 'smartstb') ? {
            user: form.manualUser,
            pass: form.manualPass,
            code: form.manualCode,
            host: form.manualHost || srv?.dns,
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

        const resultado: TesteGerado = {
          clientName: form.nome,
          phone:      form.telefone,
          app:        form.app as AppId,
          servidor:   (form.servidor || 'yellow') as ServerId,
          usuario:    data.test.username,
          senha:      data.test.password,
          codigo:     data.test.code,
          pedido:     data.test.id,
          dns:        data.test.dns ?? srv?.dns ?? '',
          xtreamHost: data.test.xtream_host ?? 'http://srv.centralplay.tv',
          validade:   data.test.validadeBR,
          mensagem:   data.test.mensagem,
          source:     data.source,
        }

        // Insere no MOCK_TESTES para aparecer na aba imediatamente
        const appLabel = APPS.find(a => a.id === form.app)?.label ?? form.app
        const srvLabel = SERVIDORES.find(s => s.id === form.servidor)?.label ?? form.servidor
        const agora    = new Date()
        MOCK_TESTES.unshift({
          id:       data.client.id,
          cliente:  form.nome,
          telefone: form.telefone,
          app:      appLabel,
          servidor: srvLabel,
          usuario:  data.test.username,
          senha:    data.test.password,
          codigo:   data.test.code,
          status:   'ativo',
          validade: data.test.validadeBR,
          criadoEm: agora.toLocaleDateString('pt-BR'),
          horario:  agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        })

        // Insere no MOCK_PIPELINE na etapa "teste_gerado"
        const novoLead: LeadPipeline = {
          id:          data.client.id,
          nome:        form.nome,
          telefone:    form.telefone,
          app:         appLabel,
          servidor:    srvLabel,
          etapa:       'teste_gerado',
          criadoEm:    agora.toLocaleString('pt-BR'),
          atualizadoEm: agora.toLocaleString('pt-BR'),
          testeId:     data.test.id,
        }
        MOCK_PIPELINE.unshift(novoLead)

        return resultado
      } catch {
        return gerarDadosFakeMock(form)
      }
    }

    timers.push(setTimeout(async () => {
      const resultado = await fetchTeste()

      // Fallback: inserir no mock local quando API falhou
      if (resultado.source === 'mock') {
        const appLabel = APPS.find(a => a.id === form.app)?.label ?? form.app
        const srvLabel = SERVIDORES.find(s => s.id === form.servidor)?.label ?? form.servidor
        const agora    = new Date()
        const horario  = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        const jaExiste = MOCK_TESTES.some(t => t.cliente === form.nome && t.horario === horario)
        if (!jaExiste) {
          const novoId = crypto.randomUUID()
          MOCK_TESTES.unshift({
            id:       novoId,
            cliente:  form.nome,
            telefone: form.telefone,
            app:      appLabel,
            servidor: srvLabel,
            usuario:  resultado.usuario,
            senha:    resultado.senha,
            codigo:   resultado.codigo,
            status:   'ativo',
            validade: resultado.validade,
            criadoEm: agora.toLocaleDateString('pt-BR'),
            horario,
          })
          MOCK_PIPELINE.unshift({
            id:           novoId,
            nome:         form.nome,
            telefone:     form.telefone,
            app:          appLabel,
            servidor:     srvLabel,
            etapa:        'teste_gerado',
            criadoEm:     agora.toLocaleString('pt-BR'),
            atualizadoEm: agora.toLocaleString('pt-BR'),
          })
        }
      }

      setTeste(resultado)
      setProcessStep('sucesso')
    }, minDelay))

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processStep])

  const reset = () => {
    setForm({ nome: '', telefone: '', app: '', servidor: '', deviceKey: '', manualUser: '', manualPass: '', manualCode: '', manualHost: '', manualText: '' })
    setWizardStep('dados'); setProcessStep(null); setEtapas([]); setTeste(null)
    setDirection(1); setMostrarServidores(false);     setModoManualXcloud(false)
    setXcloudWorkers(WORKERS_INIT)
  }

  const handleRetryXcloudStep = (stepId: XcloudWorker['id']) => {
    setXcloudWorkers(prev => prev.map(w => w.id === stepId ? { ...w, status: 'processando', detail: undefined } : w))
    setTimeout(() => {
      setXcloudWorkers(prev => prev.map(w => w.id === stepId ? { ...w, status: 'concluido', detail: 'Retry concluido com sucesso.' } : w))
    }, 1400)
  }

  // ── Telas de processamento (sem card centralizado)
  if (processStep === 'gerando') {
    return (
      <div className="relative min-h-screen flex-1 overflow-hidden">
        <NeonBackground />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(7,10,18,0.97)' }}>
          {form.app === 'xcloud'
            ? <TelaGerandoXCloud
                form={form}
                workers={xcloudWorkers}
                onRetry={handleRetryXcloudStep}
                onModoManual={() => { setModoManualXcloud(true); setProcessStep('sucesso') }}
                onVerLog={() => onNavigate?.('debug')}
              />
            : <TelaGerando form={form} etapas={etapas} />
          }
        </div>
      </div>
    )
  }

  if (processStep === 'sucesso' && teste) {
    // XCloud modo manual
    if (modoManualXcloud) {
      return (
        <div className="relative min-h-screen flex-1 overflow-hidden">
          <NeonBackground />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(7,10,18,0.97)' }}>
            <TelaModoManualXCloud teste={teste} onNovo={reset} />
          </div>
        </div>
      )
    }
    return (
      <div className="relative min-h-screen flex-1 overflow-hidden">
        <NeonBackground />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(7,10,18,0.97)' }}>
          <TelaSucesso
            teste={teste}
            onNovo={reset}
            onVerTestes={() => onNavigate?.('testes')}
            onAtivar={() => {
              addToast('info', 'Ativacao: verifique vagas livres antes de criar nova conta.')
              onNavigate?.('clientes')
            }}
            onVerLog={() => onNavigate?.('debug')}
          />
        </div>
      </div>
    )
  }

  // ── Wizard steps
  const slideVariants = {
    enter:  (d: number) => ({ opacity: 0, x: d * 40 }),
    center: { opacity: 1, x: 0 },
    exit:   (d: number) => ({ opacity: 0, x: d * -40 }),
  }

  return (
    <div className="relative flex-1 min-h-screen overflow-hidden">
      <NeonBackground />
      <div className="relative flex flex-col items-center justify-center min-h-screen p-4" style={{ zIndex: 1 }}>

        {/* Stepper */}
        <div className="mb-10 w-full max-w-xl">
          <div className="flex items-center justify-between mb-3">
            {stepsVisiveis.map((step, idx) => (
              <div key={step} className="flex items-center">
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full font-bold transition-all duration-300',
                    wizardStep === step
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : stepsVisiveis.indexOf(wizardStep) > idx
                        ? 'bg-emerald-500 text-white'
                        : 'bg-card border border-border text-muted-foreground'
                  )}
                  style={{ fontSize: 16 }}>
                  {stepsVisiveis.indexOf(wizardStep) > idx
                    ? <CheckCircle className="h-6 w-6" />
                    : idx + 1}
                </div>
                {idx < stepsVisiveis.length - 1 && (
                  <div className={cn('h-1 rounded-full transition-all duration-500', 'w-14 sm:w-20 md:w-24 mx-1.5',
                    stepsVisiveis.indexOf(wizardStep) > idx ? 'bg-emerald-500' : 'bg-border')} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between px-1" style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em' }}>
            {stepsVisiveis.map(s => <span key={s}>{STEP_LABELS[s]}</span>)}
          </div>
        </div>

        {/* Cards */}
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={direction}>
            {wizardStep === 'dados' && (
              <motion.div key="dados" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeInOut' }}>
                <StepDados form={form} onChange={setForm} onNext={() => goNext('dados')} canProceed={canProceed.dados} />
              </motion.div>
            )}
            {wizardStep === 'app' && (
              <motion.div key="app" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeInOut' }}>
                <StepApp form={form} onChange={setForm} onNext={() => goNext('app')} onBack={() => goBack('app')} canProceed={canProceed.app} />
              </motion.div>
            )}
            {wizardStep === 'servidor' && (
              <motion.div key="servidor" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeInOut' }}>
                <StepServidor form={form} onChange={setForm} onNext={() => goNext('servidor')} onBack={() => goBack('servidor')} canProceed={canProceed.servidor}
                  mostrarTodos={mostrarServidores} setMostrarTodos={setMostrarServidores} />
              </motion.div>
            )}
            {wizardStep === 'extra' && precisaExtra && (
              <motion.div key="extra" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeInOut' }}>
                <StepExtra form={form} onChange={setForm} onNext={iniciarGeracao} onBack={() => goBack('extra')} />
              </motion.div>
            )}
            {wizardStep === 'servidor' && !precisaExtra && (
              <motion.div key="confirmar" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeInOut' }}>
                <StepConfirmar form={form} onBack={() => goBack('servidor')} onGerar={iniciarGeracao} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
