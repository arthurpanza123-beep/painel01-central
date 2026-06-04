import type { ReactNode } from 'react'

interface PageShellProps {
  icon?: ReactNode
  iconBg?: string
  iconBorder?: string
  title: string
  subtitle: string
  children: ReactNode
  action?: ReactNode
}

export function PageShell({
  icon,
  iconBg = 'rgba(59,130,246,0.12)',
  iconBorder = 'rgba(59,130,246,0.25)',
  title,
  subtitle,
  children,
  action,
}: PageShellProps) {
  return (
    <div className="flex flex-col min-h-screen p-6 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: iconBg,
                border: `1px solid ${iconBorder}`,
              }}
            >
              {icon}
            </div>
          )}
          <div>
            <h1
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title}
            </h1>
            <p className="text-xs" style={{ color: '#64748b' }}>
              {subtitle}
            </p>
          </div>
        </div>
        {action && <div>{action}</div>}
      </header>

      {/* Content */}
      <div className="flex-1">{children}</div>
    </div>
  )
}
