'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Terminal, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  XCircle,
  Copy,
  Trash2
} from 'lucide-react'
import { 
  MOCK_LOGS, 
  type LogEntry 
} from '@/lib/mock-data'
import { useToast } from '@/components/ui/toast'

const LOG_TYPE: Record<string, { icon: React.FC<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  info:    { icon: Info,          color: '#3b82f6' },
  success: { icon: CheckCircle2,  color: '#22c55e' },
  warning: { icon: AlertTriangle, color: '#f59e0b' },
  erro:    { icon: XCircle,       color: '#ef4444' },
}

// ——— Linha de log estilo terminal ———
function LogLine({ log }: { log: LogEntry }) {
  const cfg = LOG_TYPE[log.tipo] || LOG_TYPE.info
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 py-2 px-3 font-mono text-xs hover:bg-white/[0.02] rounded transition-colors"
    >
      <span className="text-slate-600 shrink-0 w-16">{log.timestamp}</span>
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: cfg.color }} />
      <span className="text-slate-300 flex-1">{log.mensagem}</span>
      {log.detalhes && (
        <span className="text-slate-600 truncate max-w-[200px]">{log.detalhes}</span>
      )}
    </motion.div>
  )
}

// ——— Page ———
export function DebugPage() {
  const [logs, setLogs] = useState(MOCK_LOGS)
  const [dataSource, setDataSource] = useState<'mock' | 'supabase'>('mock')
  const [filter, setFilter] = useState<string>('todos')
  const { addToast } = useToast()

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/logs', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar logs')
        const payload = await res.json()
        if (!alive) return
        setLogs(Array.isArray(payload.items) ? payload.items : MOCK_LOGS)
        setDataSource(payload.data_source === 'supabase' ? 'supabase' : 'mock')
      } catch {
        if (!alive) return
        setLogs(MOCK_LOGS)
        setDataSource('mock')
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const logsFiltrados = logs.filter(l => {
    if (filter === 'todos') return true
    return l.tipo === filter
  })

  const metricas = {
    total: logs.length,
    erros: logs.filter(l => l.tipo === 'erro').length,
    warnings: logs.filter(l => l.tipo === 'warning').length,
    success: logs.filter(l => l.tipo === 'success').length,
  }

  const handleCopy = () => {
    const txt = logsFiltrados.map(l => `[${l.timestamp}] [${l.tipo.toUpperCase()}] ${l.mensagem}${l.detalhes ? ` - ${l.detalhes}` : ''}`).join('\n')
    navigator.clipboard.writeText(txt)
    addToast('success', 'Logs copiados!')
  }

  const handleClear = () => {
    setLogs([])
    addToast('info', 'Console limpo localmente')
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0a0c10' }}>
      {/* Header minimo */}
      <div className="shrink-0 px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-3">
          <div 
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}
          >
            <Terminal className="h-5 w-5" style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Debug</h1>
            <p className="text-xs text-slate-500">{metricas.total} logs · {metricas.erros} erros</p>
            <p className="mt-1 inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-[10px] font-medium"
               style={{ background: dataSource === 'supabase' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: dataSource === 'supabase' ? '#4ade80' : '#fbbf24' }}>
              Fonte: {dataSource === 'supabase' ? 'Supabase' : 'Mock'}
            </p>
          </div>
        </div>

        {/* Acoes */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#94a3b8' }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </button>
          <button
            onClick={handleClear}
            className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="shrink-0 px-6 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {[
          { id: 'todos', label: 'Todos', count: metricas.total },
          { id: 'erro', label: 'Erros', count: metricas.erros, color: '#ef4444' },
          { id: 'warning', label: 'Warnings', count: metricas.warnings, color: '#f59e0b' },
          { id: 'success', label: 'Sucesso', count: metricas.success, color: '#22c55e' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-3 h-7 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5"
            style={
              filter === f.id
                ? { background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', color: '#c4b5fd' }
                : { background: 'transparent', color: '#64748b' }
            }
          >
            {f.label}
            <span 
              className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.05)', color: f.color || '#94a3b8' }}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Console */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        style={{ 
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          background: '#050608'
        }}
      >
        {logsFiltrados.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Terminal className="h-10 w-10 mx-auto mb-3" style={{ color: '#1e293b' }} />
              <p className="text-slate-600 text-sm">Console vazio</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {logsFiltrados.map((log) => (
              <LogLine key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div 
        className="shrink-0 px-4 py-2 flex items-center justify-between text-[10px] font-mono border-t"
        style={{ background: '#0a0c10', borderColor: 'rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-4 text-slate-600">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#22c55e' }} />
            Sistema online
          </span>
        </div>
        <span className="text-slate-600">{new Date().toLocaleString('pt-BR')}</span>
      </div>
    </div>
  )
}
