'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  Server,
  Smartphone,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  Plug,
  Bot,
  MessageSquare,
  Globe,
  ChevronDown,
  Loader2,
  Save,
  Check,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  MOCK_CONFIG_PAINEIS,
  MOCK_CONFIG_APPS,
  type ConfiguracaoPainel,
  type ConfiguracaoApp,
} from '@/lib/mock-data'

// ——— Integracoes ———
interface Integracao {
  id: string
  nome: string
  descricao: string
  status: 'conectado' | 'desconectado'
  Icon: React.FC<{ className?: string; style?: React.CSSProperties }>
  cor: string
}

const INTEGRACOES: Integracao[] = [
  { id: 'evolution', nome: 'Evolution API', descricao: 'Automacao WhatsApp', status: 'desconectado', Icon: MessageSquare, cor: '#25d366' },
  { id: 'telegram', nome: 'Telegram Bot', descricao: 'Notificacoes', status: 'desconectado', Icon: Bot, cor: '#2aabee' },
  { id: 'n8n', nome: 'n8n / Webhook', descricao: 'Automacoes', status: 'desconectado', Icon: Globe, cor: '#f97316' },
]

// ——— Bloco de integracao ———
function IntegracaoBloco({ integracao }: { integracao: Integracao }) {
  const [status, setStatus] = useState(integracao.status)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [token, setToken] = useState('')
  const isConectado = status === 'conectado'

  const handleConectar = async () => {
    if (!token.trim()) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setStatus('conectado')
    setLoading(false)
    setExpanded(false)
  }

  return (
    <div 
      className="rounded-xl p-4 transition-all"
      style={{ 
        background: 'rgba(255,255,255,0.02)', 
        border: isConectado ? `1px solid ${integracao.cor}25` : '1px solid rgba(255,255,255,0.04)'
      }}
    >
      <div className="flex items-center gap-3">
        <div 
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${integracao.cor}12` }}
        >
          <integracao.Icon className="h-5 w-5" style={{ color: integracao.cor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{integracao.nome}</p>
          <p className="text-xs text-slate-500">{integracao.descricao}</p>
        </div>
        {isConectado ? (
          <span className="text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
            <Check className="h-3 w-3" />
            Conectado
          </span>
        ) : (
          <button
            onClick={() => setExpanded(!expanded)}
            className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
            style={{ background: `${integracao.cor}12`, color: integracao.cor }}
          >
            Configurar
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && !isConectado && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 mt-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <input
                type="text"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Token da API..."
                className="flex-1 h-9 px-3 rounded-lg text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              />
              <button
                onClick={handleConectar}
                disabled={loading || !token.trim()}
                className="h-9 px-4 rounded-lg text-xs font-medium flex items-center gap-2 disabled:opacity-40"
                style={{ background: `${integracao.cor}15`, color: integracao.cor }}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                {loading ? 'Conectando' : 'Conectar'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ——— Bloco de painel ———
function PainelBloco({ painel, onTestar }: { painel: ConfiguracaoPainel; onTestar: () => void }) {
  const [showToken, setShowToken] = useState(false)
  const isOk = painel.status === 'conectado'

  return (
    <div 
      className="rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: isOk ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)' }}>
          <Server className="h-4 w-4" style={{ color: isOk ? '#22c55e' : '#6b7280' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{painel.nome}</p>
          <p className="text-[10px] text-slate-500 truncate">{painel.urlBase}</p>
        </div>
        {isOk && <CheckCircle2 className="h-4 w-4" style={{ color: '#22c55e' }} />}
      </div>

      <div className="flex items-center justify-between p-2 rounded-lg mb-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <span className="text-xs text-slate-500">Token</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white font-mono">{showToken ? painel.token : '••••••••'}</span>
          <button onClick={() => setShowToken(!showToken)} className="text-slate-500 hover:text-white">
            {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <button
        onClick={onTestar}
        className="w-full h-8 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        Testar conexao
      </button>
    </div>
  )
}

// ——— Bloco de app ———
function AppBloco({ app }: { app: ConfiguracaoApp }) {
  return (
    <div 
      className="rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
          <Smartphone className="h-4 w-4" style={{ color: '#60a5fa' }} />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{app.nome}</p>
          <p className="text-[10px] text-slate-500">Codigo: {app.codigo}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {app.servidoresCompativeis.map((s, i) => (
          <span key={i} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

// ——— Page ———
export function ConfiguracoesPage() {
  const { addToast } = useToast()

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
      {/* Header */}
      <div className="text-center mb-10 max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Settings className="h-4 w-4" style={{ color: '#94a3b8' }} />
          <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Sistema</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Configuracoes</h1>
        <p className="text-slate-500 text-sm">Integracoes, paineis e dados da operacao</p>
      </div>

      {/* Conteudo em blocos */}
      <div className="w-full max-w-3xl space-y-8">
        {/* Integracoes */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Plug className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-medium text-white">Integracoes</h2>
          </div>
          <div className="space-y-2">
            {INTEGRACOES.map(i => <IntegracaoBloco key={i.id} integracao={i} />)}
          </div>
        </section>

        {/* Paineis */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-medium text-white">APIs dos paineis</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MOCK_CONFIG_PAINEIS.map(p => (
              <PainelBloco key={p.id} painel={p} onTestar={() => addToast('success', `Testando ${p.nome}...`)} />
            ))}
          </div>
        </section>

        {/* Apps */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-medium text-white">Apps</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MOCK_CONFIG_APPS.map(a => <AppBloco key={a.id} app={a} />)}
          </div>
        </section>

        {/* Seguranca */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-medium text-white">Seguranca</h2>
          </div>
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Nova senha</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="••••••••"
                  className="flex-1 h-9 px-3 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                />
                <button
                  onClick={() => addToast('success', 'Senha atualizada')}
                  className="h-9 px-4 rounded-lg text-xs font-medium flex items-center gap-1.5"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
