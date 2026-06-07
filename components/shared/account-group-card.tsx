'use client'

import { m as motion } from 'framer-motion'
import { Layers, Eye, Calendar, Tv2, UserPlus } from 'lucide-react'
import type { Conta } from '@/lib/mock-data'

// Card de grupo de conta com telas (ocupacao 1/2, 2/2, tela disponivel).
export function AccountGroupCard({
  conta,
  destacar = false,
  onAtivar,
  onCredenciais,
}: {
  conta: Conta
  destacar?: boolean
  onAtivar: (index: number) => void
  onCredenciais: () => void
}) {
  const ocupadas = conta.clientesVinculados.length
  const livres = conta.vagasTotal - ocupadas
  const cheia = livres <= 0
  const cor = cheia ? '#f59e0b' : '#22c55e'

  const vagas = Array.from({ length: conta.vagasTotal }, (_, i) => conta.clientesVinculados[i] ?? null)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5"
      style={{
        background: destacar ? 'linear-gradient(180deg, rgba(34,197,94,0.08), var(--card))' : 'var(--card)',
        border: destacar ? '1px solid rgba(34,197,94,0.22)' : '1px solid var(--border)',
        boxShadow: destacar ? '0 0 0 1px rgba(34,197,94,0.06), 0 12px 36px rgba(34,197,94,0.08)' : undefined,
      }}
    >
      {/* Cabecalho */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
            style={{ background: `${cor}1a`, border: `1px solid ${cor}33` }}
          >
            <Layers className="h-5 w-5" style={{ color: cor }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white truncate" style={{ fontFamily: 'var(--font-display)' }}>
                {conta.codigo}
              </span>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                style={{ background: `${cor}1a`, color: cor }}
              >
                {cheia ? `${ocupadas}/${conta.vagasTotal} Cheia` : `${livres} tela${livres > 1 ? 's' : ''}`}
              </span>
              {destacar && !cheia && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-emerald-300" style={{ background: 'rgba(34,197,94,0.12)' }}>
                  Livre
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
              <Tv2 className="h-3 w-3" /> {conta.app} · {conta.servidor}
            </p>
          </div>
        </div>
        <button
          onClick={onCredenciais}
          className="h-8 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all shrink-0"
          style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          <Eye className="h-3 w-3" /> Ver credenciais
        </button>
      </div>

      {/* Barra de ocupacao */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(ocupadas / conta.vagasTotal) * 100}%`, background: cor }} />
        </div>
        <span className="text-[10px] text-slate-500 tabular-nums">{ocupadas}/{conta.vagasTotal}</span>
        <span className="text-[10px] text-slate-600 flex items-center gap-1">
          <Calendar className="h-3 w-3" /> {conta.vencimento}
        </span>
      </div>

      {/* Telas */}
      <div className="space-y-2">
        {vagas.map((vinc, i) =>
          vinc ? (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg p-2.5"
              style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
              >
                {vinc.nome.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">Cliente {i + 1} · {vinc.nome}</p>
                <p className="text-[10px] text-slate-500">{vinc.telefone}</p>
              </div>
              <span className="text-[9px] text-slate-600 shrink-0">desde {vinc.criadoEm}</span>
            </div>
          ) : (
            <button
              key={i}
              onClick={() => onAtivar(i)}
              className="w-full flex items-center gap-3 rounded-lg p-2.5 transition-all hover:brightness-125 group"
              style={{ background: 'rgba(255,255,255,0.015)', border: '1px dashed var(--border)' }}
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}
              >
                <UserPlus className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="text-xs font-medium block" style={{ color: '#60a5fa' }}>Usar esta tela</span>
                <span className="text-[10px] text-slate-600">Tela {i + 1} disponivel</span>
              </div>
            </button>
          )
        )}
      </div>
    </motion.div>
  )
}
