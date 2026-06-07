'use client'

import { useEffect, useState } from 'react'
import { m as motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, Cpu, Terminal, ChevronRight, X, Send, Clock,
} from 'lucide-react'
import {
  MOCK_PROBLEMAS,
  TIPOS_PROBLEMA,
  type Problema,
  type StatusProblema,
} from '@/lib/mock-data'
import { useToast } from '@/components/ui/toast'

const STATUS: Record<StatusProblema, { label: string; color: string; tag: string }> = {
  aberto: { label: 'Aberto', color: '#ef4444', tag: 'OPEN' },
  em_analise: { label: 'Em analise', color: '#f59e0b', tag: 'PROC' },
  resolvido: { label: 'Resolvido', color: '#22c55e', tag: 'DONE' },
}

// Severidade derivada do tipo de problema
function severidade(tipo: string): { label: string; color: string } {
  const criticos = ['app_nao_abre', 'login_invalido', 'renovacao_nao_entrou', 'senha_incorreta']
  const medios = ['travando', 'lista_nao_carrega']
  if (criticos.includes(tipo)) return { label: 'Critica', color: '#ef4444' }
  if (medios.includes(tipo)) return { label: 'Media', color: '#f59e0b' }
  return { label: 'Baixa', color: '#60a5fa' }
}

// ——— Linha de evento tecnico estilo terminal ———
function EventoRow({
  problema, onExpand, expanded, onResolver, onCodex,
}: {
  problema: Problema
  onExpand: () => void
  expanded: boolean
  onResolver: () => void
  onCodex: () => void
}) {
  const cfg = STATUS[problema.status]
  const sev = severidade(problema.tipo)
  const tipoLabel = TIPOS_PROBLEMA.find((t) => t.id === problema.tipo)?.label || problema.tipo
  const resolvido = problema.status === 'resolvido'

  return (
    <div
      className="font-mono transition-colors"
      style={{ borderBottom: '1px solid var(--border)', opacity: resolvido ? 0.55 : 1 }}
    >
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronRight
          className="h-3.5 w-3.5 text-slate-600 shrink-0 transition-transform"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
        />
        <span className="text-[11px] text-slate-600 tabular-nums shrink-0 w-12">{problema.criadoEm.split(' ')[1] ?? problema.criadoEm}</span>
        <span
          className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded w-12 text-center"
          style={{ color: cfg.color, background: `${cfg.color}12` }}
        >
          {cfg.tag}
        </span>
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: sev.color }} title={sev.label} />
        <span className="text-xs text-slate-200 truncate flex-1">
          {problema.cliente} <span className="text-slate-600">·</span> {tipoLabel}
        </span>
        <span className="text-[10px] text-slate-600 shrink-0 hidden sm:inline">
          {problema.app}/{problema.servidor}
        </span>
      </button>

      {/* Detalhes expandidos */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pl-[4.5rem]">
              <div className="rounded-lg p-3 mb-3 text-xs leading-relaxed" style={{ background: 'rgba(0,0,0,0.3)', color: '#94a3b8' }}>
                <span className="text-slate-600">$ erro_relatado:</span> {problema.descricao}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[11px]">
                <KV label="cliente" value={problema.cliente} />
                <KV label="telefone" value={problema.telefone} />
                <KV label="app" value={problema.app} />
                <KV label="servidor" value={problema.servidor} />
                <KV label="severidade" value={sev.label} color={sev.color} />
                <KV label="status" value={cfg.label} color={cfg.color} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onCodex}
                  className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5"
                  style={{ background: 'rgba(20,184,166,0.1)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.2)' }}
                >
                  <Cpu className="h-3.5 w-3.5" /> Enviar para Codex
                </button>
                {!resolvido && (
                  <button
                    onClick={onResolver}
                    className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Marcar resolvido
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function KV({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-slate-600">{label}</p>
      <p className="truncate" style={{ color: color ?? '#cbd5e1' }}>{value}</p>
    </div>
  )
}

// ——— Modal Codex ———
function CodexModal({
  problema, onClose, onSend,
}: {
  problema: Problema
  onClose: () => void
  onSend: (obs: string) => void
}) {
  const [obs, setObs] = useState('')
  const [phase, setPhase] = useState<'compose' | 'review' | 'running' | 'done'>('compose')
  const [runStep, setRunStep] = useState(0)
  const sev = severidade(problema.tipo)
  const tipoLabel = TIPOS_PROBLEMA.find((t) => t.id === problema.tipo)?.label || problema.tipo

  const contexto = `cliente: ${problema.cliente}
telefone: ${problema.telefone}
app: ${problema.app}
servidor: ${problema.servidor}
erro: ${tipoLabel} — ${problema.descricao}
severidade: ${sev.label}
data/hora: ${problema.criadoEm}${obs ? `\nobservacao: ${obs}` : ''}`

  const sugestao = [
    `Entendimento: analisar ${tipoLabel.toLowerCase()} para ${problema.cliente} no app ${problema.app}.`,
    `Prioridade sugerida: ${sev.label}.`,
    'Acao proposta: abrir uma execucao controlada com contexto da tela, preservar envio manual e registrar o resultado antes de qualquer mudanca operacional.',
  ]

  const runLabels = ['Codex analisando', 'Codex preparando alteração', 'Codex executando', 'Concluído']

  useEffect(() => {
    if (phase !== 'running') return
    setRunStep(0)
    const timers = runLabels.map((_, index) => setTimeout(() => setRunStep(index), index * 850))
    const done = setTimeout(() => {
      setPhase('done')
      setRunStep(runLabels.length - 1)
    }, runLabels.length * 850)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(done)
    }
  }, [phase])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(7,10,18,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.12)', color: '#14b8a6' }}>
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>Codex IA</h3>
              <p className="text-xs text-slate-500">Assistente operacional com confirmação antes de executar</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {phase === 'compose' && (
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 block">O que você quer alterar ou investigar?</label>
              <textarea
                autoFocus
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={4}
                placeholder="Ex: cliente ja reinstalou o app, problema persiste apos renovacao..."
                className="w-full p-3 rounded-lg text-sm text-white placeholder:text-slate-600 outline-none resize-none"
                style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
              />
            </div>
          )}
          {phase === 'review' && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)' }}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#5eead4' }}>Resposta do Codex</p>
              <div className="space-y-2">
                {sugestao.map((line) => <p key={line} className="text-sm text-slate-200">{line}</p>)}
              </div>
            </div>
          )}
          {(phase === 'running' || phase === 'done') && (
            <div className="space-y-2">
              {runLabels.map((label, index) => (
                <div key={label} className="flex items-center gap-3 rounded-lg p-3" style={{ background: index <= runStep ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: index <= runStep ? '#22c55e' : '#334155' }} />
                  <span className="text-sm text-slate-200">{label}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 block">Contexto que sera enviado</label>
            <pre className="p-3 rounded-lg text-[11px] leading-relaxed font-mono whitespace-pre-wrap" style={{ background: 'rgba(0,0,0,0.3)', color: '#94a3b8', border: '1px solid var(--border)' }}>
              {contexto}
            </pre>
          </div>
        </div>

        <div className="p-5 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          {phase === 'compose' && <button
            onClick={() => setPhase('review')}
            className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: '#14b8a6', color: '#04201c' }}
          >
            <Send className="h-4 w-4" /> Analisar com Codex
          </button>}
          {phase === 'review' && <button onClick={() => setPhase('running')} className="flex-1 h-10 rounded-xl text-sm font-semibold" style={{ background: '#22c55e', color: '#052e16' }}>Confirmar execução</button>}
          {phase === 'done' && <button onClick={() => onSend(obs)} className="flex-1 h-10 rounded-xl text-sm font-semibold" style={{ background: '#22c55e', color: '#052e16' }}>Finalizar</button>}
          <button onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: '#94a3b8' }}>
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ——— Page ———
export function ProblemasPage() {
  const [filter, setFilter] = useState<StatusProblema | 'todos'>('todos')
  const [problemas, setProblemas] = useState(MOCK_PROBLEMAS)
  const [dataSource, setDataSource] = useState<'mock' | 'supabase'>('mock')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [codexTarget, setCodexTarget] = useState<Problema | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/problems', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar problemas')
        const payload = await res.json()
        if (!alive) return
        setProblemas(Array.isArray(payload.items) ? payload.items : MOCK_PROBLEMAS)
        setDataSource(payload.data_source === 'supabase' ? 'supabase' : 'mock')
      } catch {
        if (!alive) return
        setProblemas(MOCK_PROBLEMAS)
        setDataSource('mock')
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const metricas = {
    abertos: problemas.filter((p) => p.status === 'aberto').length,
    emAnalise: problemas.filter((p) => p.status === 'em_analise').length,
    resolvidos: problemas.filter((p) => p.status === 'resolvido').length,
  }

  const filtrados = problemas
    .filter((p) => filter === 'todos' || p.status === filter)
    .sort((a, b) => {
      const ordem: Record<StatusProblema, number> = { aberto: 0, em_analise: 1, resolvido: 2 }
      return ordem[a.status] - ordem[b.status]
    })

  const handleResolver = (id: string) => {
    setProblemas((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'resolvido' as StatusProblema } : p)))
    addToast('success', 'Problema resolvido')
  }

  return (
    <>
      <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
        {/* Header */}
        <div className="text-center mb-8 max-w-xl">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Terminal className="h-4 w-4" style={{ color: '#14b8a6' }} />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Central de suporte tecnico</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>Problemas</h1>
          <p className="text-slate-500 text-sm">
            {metricas.abertos} abertos · {metricas.emAnalise} em analise · {metricas.resolvidos} resolvidos
          </p>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-8 mb-8">
          <div className="text-center">
            <p className="text-3xl font-bold" style={{ color: metricas.abertos > 0 ? '#ef4444' : '#22c55e', fontFamily: 'var(--font-display)' }}>{metricas.abertos}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Abertos</p>
          </div>
          <div className="h-10 w-px" style={{ background: 'var(--border)' }} />
          <div className="text-center">
            <p className="text-3xl font-bold" style={{ color: '#f59e0b', fontFamily: 'var(--font-display)' }}>{metricas.emAnalise}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Em analise</p>
          </div>
          <div className="h-10 w-px" style={{ background: 'var(--border)' }} />
          <div className="text-center">
            <p className="text-3xl font-bold" style={{ color: '#22c55e', fontFamily: 'var(--font-display)' }}>{metricas.resolvidos}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Resolvidos</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'aberto', label: 'Abertos' },
            { id: 'em_analise', label: 'Em analise' },
            { id: 'resolvido', label: 'Resolvidos' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
              className="px-4 h-9 rounded-xl text-xs font-medium transition-all"
              style={
                filter === f.id
                  ? { background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.25)', color: '#14b8a6' }
                  : { background: 'var(--card)', border: '1px solid var(--border)', color: '#64748b' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Terminal de eventos */}
        <div className="w-full max-w-3xl rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {/* Barra do terminal */}
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border)' }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ef4444' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#f59e0b' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#22c55e' }} />
            <span className="text-[11px] text-slate-500 font-mono ml-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> suporte@centralplay — {filtrados.length} ocorrencias
            </span>
          </div>

          {filtrados.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: '#22c55e' }} />
              <p className="text-slate-400 text-sm font-mono">Nenhuma ocorrencia em aberto</p>
            </div>
          ) : (
            filtrados.map((p) => (
              <EventoRow
                key={p.id}
                problema={p}
                expanded={expanded === p.id}
                onExpand={() => setExpanded(expanded === p.id ? null : p.id)}
                onResolver={() => handleResolver(p.id)}
                onCodex={() => setCodexTarget(p)}
              />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {codexTarget && (
          <CodexModal
            problema={codexTarget}
            onClose={() => setCodexTarget(null)}
              onSend={(_obs) => {
                addToast('success', 'Contexto enviado ao Codex')
                setCodexTarget(null)
              }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
