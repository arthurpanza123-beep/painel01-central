'use client'

import { useEffect, useState } from 'react'
import { m as motion, AnimatePresence } from 'framer-motion'
import {
  Kanban, X, ArrowRight, Phone, Clock,
  Tv2, Server, DollarSign
} from 'lucide-react'
import { MOCK_PIPELINE, type LeadPipeline, type EtapaPipeline } from '@/lib/mock-data'
import { useToast } from '@/components/ui/toast'

// Fluxo correto solicitado pelo usuário
const ETAPAS: { id: EtapaPipeline; label: string; color: string; glow: string }[] = [
  { id: 'novo_lead',    label: 'Lead',           color: '#3b82f6', glow: '59,130,246' },
  { id: 'contato',      label: 'Baixando app',   color: '#38bdf8', glow: '56,189,248' },
  { id: 'teste_gerado', label: 'Testando',       color: '#f59e0b', glow: '245,158,11' },
  { id: 'testando',     label: 'Finalizou',      color: '#eab308', glow: '234,179,8' },
  { id: 'pagou',        label: 'Pagou',          color: '#22c55e', glow: '34,197,94' },
]

export function PipelinePage() {
  const [leads, setLeads] = useState<LeadPipeline[]>(MOCK_PIPELINE)
  const [dataSource, setDataSource] = useState<'mock' | 'supabase'>('mock')
  const [selecionado, setSelecionado] = useState<LeadPipeline | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/pipeline', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar pipeline')
        const payload = await res.json()
        if (!alive) return
        setLeads(Array.isArray(payload.items) ? payload.items : MOCK_PIPELINE)
        setDataSource(payload.data_source === 'supabase' ? 'supabase' : 'mock')
      } catch {
        if (!alive) return
        setLeads(MOCK_PIPELINE)
        setDataSource('mock')
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const avancar = (lead: LeadPipeline) => {
    const idx = ETAPAS.findIndex(e => e.id === lead.etapa)
    if (idx < 0 || idx >= ETAPAS.length - 1) return
    const proxima = ETAPAS[idx + 1]
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, etapa: proxima.id } : l))
    setSelecionado(prev => prev && prev.id === lead.id ? { ...prev, etapa: proxima.id } : prev)
    addToast('success', `${lead.nome} → ${proxima.label}`)
  }

  const totalDia = leads.length

  return (
    <div className="relative min-h-screen">
      <div className="px-6 py-8 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}
            >
              <Kanban className="h-5 w-5" style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Pipeline</h1>
              <p className="text-xs text-slate-500">{totalDia} leads nas últimas 24h · clique para detalhes</p>
            </div>
          </div>
        </div>

        {/* Resumo do funil — contagem por etapa */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {ETAPAS.map(e => {
            const count = leads.filter(l => l.etapa === e.id).length
            return (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 shrink-0"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
                <span className="text-xs text-slate-400">{e.label}</span>
                <span className="text-xs font-bold text-white">{count}</span>
              </div>
            )
          })}
        </div>

        {/* Kanban */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ETAPAS.map(etapa => {
            const cards = leads.filter(l => l.etapa === etapa.id)
            return (
              <div key={etapa.id} className="shrink-0" style={{ width: 220 }}>
                {/* Cabeçalho coluna */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: etapa.color }} />
                    <span className="text-xs font-semibold text-slate-300">{etapa.label}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: `${etapa.color}1f`, color: etapa.color }}
                  >
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div
                  className="space-y-2 rounded-xl p-2 min-h-[120px]"
                  style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border)' }}
                >
                  <AnimatePresence mode="popLayout">
                    {cards.map(lead => (
                      <PipelineCard
                        key={lead.id}
                        lead={lead}
                        etapa={etapa}
                        onClick={() => setSelecionado(lead)}
                        onAvancar={() => avancar(lead)}
                        isLast={etapa.id === 'pagou'}
                      />
                    ))}
                  </AnimatePresence>
                  {cards.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-[11px] text-slate-700">
                      Sem leads
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Drawer de detalhes */}
      <AnimatePresence>
        {selecionado && (
          <LeadDrawer
            lead={selecionado}
            etapa={ETAPAS.find(e => e.id === selecionado.etapa)!}
            onClose={() => setSelecionado(null)}
            onAvancar={() => avancar(selecionado)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function PipelineCard({
  lead, etapa, onClick, onAvancar, isLast,
}: {
  lead: LeadPipeline
  etapa: { color: string; glow: string }
  onClick: () => void
  onAvancar: () => void
  isLast: boolean
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group rounded-lg p-3 cursor-pointer relative overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      onClick={onClick}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: etapa.color }} />
      <p className="text-sm font-medium text-white truncate mb-1">{lead.nome}</p>
      <p className="text-[11px] text-slate-500 flex items-center gap-1 mb-2">
        <Phone className="h-3 w-3" /> {lead.telefone}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {lead.app && <span className="text-[10px] text-slate-400 truncate">{lead.app}</span>}
          {lead.valor && (
            <span className="text-[10px] font-semibold" style={{ color: etapa.color }}>R$ {lead.valor}</span>
          )}
        </div>
        {!isLast && (
          <button
            onClick={(e) => { e.stopPropagation(); onAvancar() }}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-md shrink-0"
            style={{ background: `${etapa.color}1f`, color: etapa.color }}
            title="Avançar etapa"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

function LeadDrawer({
  lead, etapa, onClose, onAvancar,
}: {
  lead: LeadPipeline
  etapa: { id: EtapaPipeline; label: string; color: string }
  onClose: () => void
  onAvancar: () => void
}) {
  const isLast = etapa.id === 'pagou'

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(7,10,18,0.6)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md overflow-y-auto"
        style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: etapa.color }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: etapa.color }}>
                {etapa.label}
              </span>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>{lead.nome}</h2>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-6">
            <Phone className="h-3.5 w-3.5" /> {lead.telefone}
          </p>

          <div className="space-y-3 mb-6">
            {lead.app && <InfoRow icon={Tv2} label="Aplicativo" value={lead.app} />}
            {lead.servidor && <InfoRow icon={Server} label="Servidor" value={lead.servidor} />}
            {lead.valor && <InfoRow icon={DollarSign} label="Valor" value={`R$ ${lead.valor}`} />}
            <InfoRow icon={Clock} label="Atualizado" value={lead.atualizadoEm} />
          </div>

          {lead.observacoes && (
            <div
              className="rounded-xl p-4 mb-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
            >
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Observações</p>
              <p className="text-sm text-slate-300">{lead.observacoes}</p>
            </div>
          )}

          <div className="space-y-2">
            {!isLast && (
              <button
                onClick={onAvancar}
                className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-110"
                style={{ background: etapa.color, color: '#0b0e16' }}
              >
                Avançar etapa <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.FC<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div>
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-sm text-slate-200">{value}</p>
      </div>
    </div>
  )
}
