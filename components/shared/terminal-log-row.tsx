'use client'

import { motion } from 'framer-motion'

type LogTipo = 'info' | 'erro' | 'warning' | 'success'

const TIPO_CFG: Record<LogTipo, { color: string; tag: string }> = {
  info: { color: '#60a5fa', tag: 'INFO' },
  erro: { color: '#ef4444', tag: 'ERRO' },
  warning: { color: '#f59e0b', tag: 'WARN' },
  success: { color: '#22c55e', tag: ' OK ' },
}

// Linha de log estilo terminal premium.
export function TerminalLogRow({
  tipo,
  timestamp,
  mensagem,
  detalhes,
}: {
  tipo: LogTipo
  timestamp: string
  mensagem: string
  detalhes?: string
}) {
  const cfg = TIPO_CFG[tipo]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-start gap-3 px-4 py-2.5 rounded-lg transition-colors hover:bg-white/[0.02] font-mono"
    >
      <span className="text-[11px] text-slate-600 shrink-0 tabular-nums pt-0.5">{timestamp}</span>
      <span
        className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded"
        style={{ color: cfg.color, background: `${cfg.color}12` }}
      >
        {cfg.tag}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 leading-relaxed break-words">{mensagem}</p>
        {detalhes && <p className="text-[11px] text-slate-600 mt-0.5 break-words">{detalhes}</p>}
      </div>
    </motion.div>
  )
}
