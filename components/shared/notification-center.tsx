'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Check, X } from 'lucide-react'

type PanelNotification = {
  id: string
  key: string
  title: string
  body: string
  created_at: string
  read: boolean
}

export function NotificationCenter() {
  const [items, setItems] = useState<PanelNotification[]>([])
  const [open, setOpen] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const unread = useMemo(() => items.filter((item) => !item.read), [items])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    setPermission(Notification.permission)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    let alive = true
    const seen = new Set<string>(JSON.parse(localStorage.getItem('centralplay_notifications_seen') || '[]') as string[])
    async function load() {
      try {
        const res = await fetch('/api/notifications', { cache: 'no-store' })
        const payload = await res.json()
        if (!alive || !Array.isArray(payload.items)) return
        setItems(payload.items)
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          for (const item of payload.items.slice(0, 8) as PanelNotification[]) {
            if (item.read || seen.has(item.id)) continue
            new Notification(item.title, { body: item.body, tag: item.key, icon: '/favicon.png' })
            seen.add(item.id)
          }
          localStorage.setItem('centralplay_notifications_seen', JSON.stringify(Array.from(seen).slice(-200)))
        }
      } catch {
        // notificacoes nao podem quebrar a operacao do painel
      }
    }
    load()
    const timer = window.setInterval(load, 60_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const requestPermission = async () => {
    if (!('Notification' in window)) return
    const next = await Notification.requestPermission()
    setPermission(next)
  }

  const markRead = async () => {
    const ids = unread.map((item) => item.id)
    if (!ids.length) return
    setItems((prev) => prev.map((item) => ids.includes(item.id) ? { ...item, read: true } : item))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => undefined)
  }

  return (
    <div className="fixed z-50" style={{ top: 'calc(12px + env(safe-area-inset-top))', right: 'calc(178px + env(safe-area-inset-right))' }}>
      <button
        onClick={() => setOpen((value) => !value)}
        className="relative hidden h-10 w-10 items-center justify-center rounded-lg text-slate-300 md:flex"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
        aria-label="Notificacoes"
      >
        <Bell className="h-4 w-4" />
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: '#ef4444' }}>
            {unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[360px] overflow-hidden rounded-xl" style={{ background: 'var(--background)', border: '1px solid var(--border)', boxShadow: '0 18px 60px rgba(0,0,0,0.45)' }}>
          <div className="flex items-center justify-between gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <p className="text-sm font-semibold text-white">Notificações</p>
              <p className="text-[11px] text-slate-500">{unread.length} novas</p>
            </div>
            <div className="flex gap-2">
              {permission === 'default' && (
                <button onClick={requestPermission} className="h-8 rounded-lg px-2 text-[11px] font-semibold" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.24)' }}>Ativar</button>
              )}
              <button onClick={markRead} className="h-8 w-8 rounded-lg text-slate-400" style={{ background: 'rgba(255,255,255,0.04)' }} aria-label="Marcar lidas"><Check className="mx-auto h-4 w-4" /></button>
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg text-slate-400" style={{ background: 'rgba(255,255,255,0.04)' }} aria-label="Fechar"><X className="mx-auto h-4 w-4" /></button>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {items.length ? items.map((item) => (
              <div key={item.id} className="rounded-lg p-3" style={{ background: item.read ? 'transparent' : 'rgba(59,130,246,0.08)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 text-xs text-slate-400">{item.body}</p>
                <p className="mt-2 text-[10px] text-slate-600">{new Date(item.created_at).toLocaleString('pt-BR')}</p>
              </div>
            )) : (
              <div className="p-8 text-center text-sm text-slate-500">Sem notificações</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
