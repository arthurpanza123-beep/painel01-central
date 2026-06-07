import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { PerfProvider } from '@/components/perf-provider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'Central Play Plus',
  description: 'Sistema de gerenciamento de testes, ativações e clientes',
  generator: 'v0.app',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0c0e14',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable} ${plusJakartaSans.variable} bg-background`}>
      <body className="font-sans antialiased">
        <PerfProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </PerfProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
