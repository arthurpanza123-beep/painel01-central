'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Terminal, User, Loader2, Plus, Zap } from 'lucide-react'

type Role = 'user' | 'assistant'
interface ChatMessage {
  id: string
  role: Role
  content: string
  pending?: boolean
}

const SUGESTOES = [
  'Quantos testes ativos eu tenho agora?',
  'Liste os clientes que vencem nos próximos 3 dias',
  'Qual painel está com menos créditos?',
  'Resumo financeiro de hoje',
]

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Olá! Eu sou o Codex, seu agente operacional da Central Play. Posso consultar testes, clientes, contas e o financeiro do painel. Pergunte o que precisar — em breve estarei conectado ao agente real via webhook.',
}

export function CodexPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const enviar = (texto?: string) => {
    const conteudo = (texto ?? input).trim()
    if (!conteudo || sending) return

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: conteudo }
    const pendingMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: '', pending: true }
    setMessages((prev) => [...prev, userMsg, pendingMsg])
    setInput('')
    setSending(true)

    // Placeholder visual — sem envio real. O webhook do Codex entra aqui depois.
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id
            ? {
                ...m,
                pending: false,
                content:
                  'Interface pronta. Ainda não estou conectado ao agente real — assim que o webhook do Codex CLI for configurado, vou responder com dados ao vivo do painel.',
              }
            : m,
        ),
      )
      setSending(false)
    }, 1100)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  const novaConversa = () => {
    setMessages([WELCOME])
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-screen">
      {/* Header */}
      <header
        className="flex items-center justify-between gap-3 px-4 py-3 shrink-0 md:px-6"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'rgba(59,130,246,0.14)',
              border: '1px solid rgba(59,130,246,0.32)',
              boxShadow: '0 0 16px rgba(59,130,246,0.22)',
            }}
          >
            <Sparkles className="h-[18px] w-[18px]" style={{ color: '#60a5fa' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Codex
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
              <span className="text-[11px] text-slate-400">Aguardando conexão do agente</span>
            </div>
          </div>
        </div>

        <button
          onClick={novaConversa}
          className="flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Nova conversa</span>
        </button>
      </header>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Sugestões — só na conversa inicial */}
          {messages.length === 1 && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="group flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-sm text-slate-300 transition-all hover:text-white"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <Zap className="h-4 w-4 shrink-0" style={{ color: '#60a5fa' }} />
                  <span className="leading-snug">{s}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 pb-4 pt-2 md:px-6">
        <div className="mx-auto max-w-3xl">
          <div
            className="flex items-end gap-2 rounded-2xl px-3 py-2"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Pergunte ao Codex sobre o painel..."
              className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none max-h-32"
              style={{ minHeight: 24 }}
            />
            <button
              onClick={() => enviar()}
              disabled={!input.trim() || sending}
              aria-label="Enviar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-40"
              style={{
                background: input.trim() && !sending ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                color: input.trim() && !sending ? '#fff' : '#64748b',
              }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-600">
            Interface visual — o Codex será conectado ao agente real via webhook.
          </p>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={
          isUser
            ? { background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)' }
            : { background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.3)' }
        }
      >
        {isUser ? (
          <User className="h-4 w-4 text-slate-300" />
        ) : (
          <Terminal className="h-4 w-4" style={{ color: '#60a5fa' }} />
        )}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'text-white' : 'text-slate-200'}`}
        style={
          isUser
            ? { background: '#3b82f6', borderTopRightRadius: 4 }
            : { background: 'var(--card)', border: '1px solid var(--border)', borderTopLeftRadius: 4 }
        }
      >
        {message.pending ? (
          <span className="flex items-center gap-2 text-slate-400">
            <span className="flex gap-1">
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </span>
            Processando
          </span>
        ) : (
          <span className="whitespace-pre-wrap">{message.content}</span>
        )}
      </div>
    </div>
  )
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={{
        background: '#60a5fa',
        animation: 'codexDot 1s ease-in-out infinite',
        animationDelay: `${delay}ms`,
      }}
    />
  )
}
