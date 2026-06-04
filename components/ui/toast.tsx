'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (type: ToastType, title: string, description?: string) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { id, type, title, description }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[]
  removeToast: (id: string) => void
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const Icon = icons[toast.type]

  const styles = {
    success: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', iconColor: '#22c55e' },
    error:   { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', iconColor: '#ef4444' },
    warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', iconColor: '#f59e0b' },
    info:    { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', iconColor: '#3b82f6' },
  }[toast.type]

  return (
    <div
      className="flex w-80 items-start gap-3 rounded-xl p-3.5 animate-in slide-in-from-right-full"
      style={{
        background: '#13161f',
        border: `1px solid ${styles.border}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
      >
        <Icon className="h-4 w-4" style={{ color: styles.iconColor }} />
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-slate-200">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-[11px] text-slate-500">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 text-slate-600 transition-colors hover:text-slate-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
