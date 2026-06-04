'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, MessageCircle, RefreshCw, Copy, Eye, EyeOff,
  User, Phone, Package, Server, Calendar, KeyRound, AlertTriangle, History,
} from 'lucide-react'
import type { Cliente } from '@/lib/mock-data'
import { StatusBadge } from './status-badge'
import { useToast } from '@/components/ui/toast'

function Field({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <Icon className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-200 truncate">{value}</p>
      </div>
    </div>
  )
}

export function ClientDrawer({
  cliente,
  onClose,
  onWhatsApp,
  onRenovar,
}: {
  cliente: Cliente | null
  onClose: () => void
  onWhatsApp: (c: Cliente) => void
  onRenovar: (c: Cliente) => void
}) {
  const { addToast } = useToast()
  const [showSenha, setShowSenha] = useState(false)

  return (
    <AnimatePresence>
      {cliente && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(5,7,12,0.6)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative h-full w-full max-w-md overflow-y-auto"
            style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 p-6" style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                    {cliente.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>{cliente.nome}</h2>
                    <div className="mt-1"><StatusBadge status={cliente.status} dot /></div>
                  </div>
                </div>
                <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Valor */}
              <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Plano {cliente.plano}</p>
                <p className="text-3xl font-bold" style={{ color: '#22c55e', fontFamily: 'var(--font-display)' }}>R$ {cliente.valor.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">Vence em {cliente.vencimento}</p>
              </div>

              {/* Dados */}
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">Dados do cliente</p>
                <div className="space-y-3">
                  <Field icon={User} label="Nome" value={cliente.nome} />
                  <Field icon={Phone} label="Telefone" value={cliente.telefone} />
                  <Field icon={Package} label="Aplicativo" value={cliente.app} />
                  <Field icon={Server} label="Servidor" value={cliente.servidor} />
                  <Field icon={Calendar} label="Vencimento" value={cliente.vencimento} />
                </div>
              </div>

              {/* Credenciais */}
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">Credenciais</p>
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-400">Usuario</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-200 font-mono">{cliente.usuario}</span>
                      <button onClick={() => { navigator.clipboard.writeText(cliente.usuario); addToast('success', 'Usuario copiado') }} className="text-slate-500 hover:text-white">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-400">Senha</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-200 font-mono">{showSenha ? cliente.senha : '•'.repeat(cliente.senha.length)}</span>
                      <button onClick={() => setShowSenha((v) => !v)} className="text-slate-500 hover:text-white">
                        {showSenha ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(cliente.senha); addToast('success', 'Senha copiada') }} className="text-slate-500 hover:text-white">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Historico / Problemas (placeholders preparados para dados reais) */}
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">Atividade recente</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <History className="h-3.5 w-3.5 text-slate-500" />
                    <p className="text-xs text-slate-400">Cliente ativado em {cliente.criadoEm}</p>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                    <p className="text-xs text-slate-400">Sem problemas em aberto</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Acoes fixas */}
            <div className="sticky bottom-0 p-4 flex gap-2" style={{ background: 'var(--background)', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => onWhatsApp(cliente)} className="flex-1 h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
              <button onClick={() => onRenovar(cliente)} className="flex-1 h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                <RefreshCw className="h-4 w-4" /> Renovar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
