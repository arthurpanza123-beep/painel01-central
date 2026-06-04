'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Layers, Copy, X, UserPlus, Calendar,
  Server, KeyRound, Check, Plus, Tv2,
} from 'lucide-react'
import {
  MOCK_CONTAS,
  MOCK_CLIENTES,
  calcularMetricasContas,
  type Conta,
} from '@/lib/mock-data'
import { AccountGroupCard } from '@/components/shared/account-group-card'
import { useToast } from '@/components/ui/toast'

type VagaTarget = { conta: Conta; index: number }

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(7,10,18,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

// ——— Modal: Ativar cliente que pagou em vaga livre ———
function AtivarModal({
  target, onClose, onConfirm,
}: {
  target: VagaTarget
  onClose: () => void
  onConfirm: (nome: string, telefone: string) => void
}) {
  const { conta } = target
  const { addToast } = useToast()
  const [clienteId, setClienteId] = useState<string>('')
  const [busca, setBusca] = useState('')

  // Clientes que pagaram (ativos/pendentes) disponiveis para vincular
  const candidatos = MOCK_CLIENTES.filter(
    (c) => c.nome.toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca)
  )
  const selecionado = MOCK_CLIENTES.find((c) => c.id === clienteId)

  const copiarCredenciais = () => {
    if (!selecionado) return
    navigator.clipboard.writeText(
      `Cliente: ${selecionado.nome}\nApp: ${conta.app}\nServidor: ${conta.servidor}\nUsuario: ${conta.usuario}\nSenha: ${conta.senha}`
    )
    addToast('success', 'Credenciais copiadas')
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="p-5 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
          <UserPlus className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>Ativar cliente na vaga</h3>
        <p className="text-xs text-slate-500 mt-1">Vaga {target.index + 1} · Conta {conta.codigo}</p>
      </div>

      <div className="p-5 space-y-4">
        {/* 1. Escolher cliente que pagou */}
        <div>
          <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 block">1. Cliente que pagou</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm text-white placeholder:text-slate-600 outline-none"
              style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {candidatos.map((c) => (
              <button
                key={c.id}
                onClick={() => setClienteId(c.id)}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all"
                style={{
                  background: clienteId === c.id ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)',
                  border: clienteId === c.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border)',
                }}
              >
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                  {c.nome.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{c.nome}</p>
                  <p className="text-[10px] text-slate-500">{c.telefone}</p>
                </div>
                {clienteId === c.id && <Check className="h-4 w-4 shrink-0" style={{ color: '#60a5fa' }} />}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Confirmar app/servidor */}
        <div>
          <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 block">2. Confirmar acesso</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
              <Tv2 className="h-3.5 w-3.5 text-slate-500" />
              <div><p className="text-[9px] text-slate-600 uppercase">App</p><p className="text-xs text-slate-200">{conta.app}</p></div>
            </div>
            <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
              <Server className="h-3.5 w-3.5 text-slate-500" />
              <div><p className="text-[9px] text-slate-600 uppercase">Servidor</p><p className="text-xs text-slate-200">{conta.servidor}</p></div>
            </div>
          </div>
        </div>

        {/* 3. Copiar credenciais */}
        {selecionado && (
          <button
            onClick={copiarCredenciais}
            className="w-full h-9 rounded-lg text-xs font-medium flex items-center justify-center gap-2"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <Copy className="h-3.5 w-3.5" /> Copiar credenciais
          </button>
        )}
      </div>

      <div className="p-5 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          disabled={!selecionado}
          onClick={() => selecionado && onConfirm(selecionado.nome, selecionado.telefone)}
          className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          style={{ background: '#22c55e', color: '#06140a' }}
        >
          <Check className="h-4 w-4" /> Vincular a vaga
        </button>
        <button onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: '#94a3b8' }}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </ModalShell>
  )
}

// ——— Modal: Credenciais ———
function CredenciaisModal({ conta, onClose }: { conta: Conta; onClose: () => void }) {
  const { addToast } = useToast()
  const handleCopy = () => {
    const txt = `Conta: ${conta.codigo}\nUsuario: ${conta.usuario}\nSenha: ${conta.senha}\nApp: ${conta.app}\nServidor: ${conta.servidor}\nValidade: ${conta.vencimento}`
    navigator.clipboard.writeText(txt)
    addToast('success', 'Credenciais copiadas')
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="p-5 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
          <KeyRound className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>{conta.codigo}</h3>
        <p className="text-xs text-slate-500 mt-1">{conta.app} · {conta.servidor}</p>
      </div>
      <div className="p-5 space-y-3">
        {[
          { label: 'Usuario', value: conta.usuario },
          { label: 'Senha', value: conta.senha },
          { label: 'Servidor', value: conta.servidor },
          { label: 'Validade', value: conta.vencimento },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs text-slate-500">{label}</span>
            <span className="text-sm text-white font-mono">{value}</span>
          </div>
        ))}
      </div>
      <div className="p-5 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={handleCopy} className="flex-1 h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}>
          <Copy className="h-4 w-4" /> Copiar
        </button>
        <button onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: '#94a3b8' }}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </ModalShell>
  )
}

// ——— Page ———
export function ContasPage() {
  const [search, setSearch] = useState('')
  const [contas, setContas] = useState<Conta[]>(MOCK_CONTAS)
  const [credenciais, setCredenciais] = useState<Conta | null>(null)
  const [ativarTarget, setAtivarTarget] = useState<VagaTarget | null>(null)
  const { addToast } = useToast()
  const metricas = calcularMetricasContas()

  const contasFiltradas = contas.filter((c) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      c.clientePrincipal.toLowerCase().includes(s) ||
      c.codigo.toLowerCase().includes(s) ||
      c.usuario.toLowerCase().includes(s) ||
      c.app.toLowerCase().includes(s) ||
      c.servidor.toLowerCase().includes(s) ||
      c.clientesVinculados.some((v) => v.nome.toLowerCase().includes(s))
    )
  })

  const confirmarAtivacao = (nome: string, telefone: string) => {
    if (!ativarTarget) return
    const { conta } = ativarTarget
    setContas((prev) => prev.map((c) =>
      c.id === conta.id
        ? { ...c, clientesVinculados: [...c.clientesVinculados, { id: `${Date.now()}`, nome, telefone, criadoEm: new Date().toLocaleDateString('pt-BR') }] }
        : c
    ))
    addToast('success', `${nome} ativado na conta ${conta.codigo}`)
    setAtivarTarget(null)
  }

  return (
    <>
      <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
        {/* Header */}
        <div className="text-center mb-8 max-w-xl">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Layers className="h-4 w-4" style={{ color: '#a78bfa' }} />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Contas & Vagas</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>Contas</h1>
          <p className="text-slate-500 text-sm">
            {metricas.totalContas} contas · {metricas.vagasLivres} vagas livres de {metricas.vagasTotais}
          </p>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-8 mb-8">
          {[
            { label: 'Contas', value: metricas.totalContas, color: '#a78bfa' },
            { label: 'Com vaga', value: metricas.contasComVaga, color: '#22c55e' },
            { label: 'Cheias', value: metricas.contasCompletas, color: '#f59e0b' },
            { label: 'Vagas livres', value: metricas.vagasLivres, color: '#60a5fa' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-xl font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{value}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Busca + criar conta */}
        <div className="w-full max-w-2xl mb-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por codigo, cliente, usuario ou app..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            />
          </div>
          <button
            onClick={() => addToast('info', 'Formulario de nova conta em breve')}
            className="h-12 px-4 rounded-xl text-sm font-medium flex items-center gap-2 shrink-0 transition-all"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
          >
            <Plus className="h-4 w-4" /> Nova conta
          </button>
        </div>

        {/* Lista */}
        <div className="w-full max-w-2xl space-y-3">
          {contasFiltradas.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Layers className="h-10 w-10 mx-auto mb-3" style={{ color: '#1e293b' }} />
              <p className="text-slate-500 text-sm">Nenhuma conta encontrada</p>
            </div>
          ) : (
            contasFiltradas.map((conta) => (
              <AccountGroupCard
                key={conta.id}
                conta={conta}
                onAtivar={(index) => setAtivarTarget({ conta, index })}
                onCredenciais={() => setCredenciais(conta)}
              />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {credenciais && <CredenciaisModal conta={credenciais} onClose={() => setCredenciais(null)} />}
        {ativarTarget && (
          <AtivarModal target={ativarTarget} onClose={() => setAtivarTarget(null)} onConfirm={confirmarAtivacao} />
        )}
      </AnimatePresence>
    </>
  )
}
