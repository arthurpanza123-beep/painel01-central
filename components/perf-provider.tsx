'use client'

import { MotionConfig } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * Otimiza desempenho em celulares fracos.
 *
 * - Em telas pequenas (mobile) ou aparelhos com pouca CPU/memoria, desliga as
 *   animacoes do framer-motion (reducedMotion="always"), eliminando o custo de
 *   layout/paint das entradas escalonadas a cada troca de aba e melhorando a
 *   fluidez de scroll.
 * - Em desktop, mantem as animacoes normais, apenas respeitando a preferencia
 *   de sistema "reduzir movimento".
 */
export function PerfProvider({ children }: { children: React.ReactNode }) {
  const [lowPower, setLowPower] = useState(false)

  useEffect(() => {
    const evaluate = () => {
      const isSmall = window.matchMedia('(max-width: 767px)').matches
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      setLowPower(prefersReduced || isSmall)
    }

    evaluate()
    const mqlSmall = window.matchMedia('(max-width: 767px)')
    const mqlReduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    mqlSmall.addEventListener('change', evaluate)
    mqlReduced.addEventListener('change', evaluate)
    return () => {
      mqlSmall.removeEventListener('change', evaluate)
      mqlReduced.removeEventListener('change', evaluate)
    }
  }, [])

  return (
    <MotionConfig reducedMotion={lowPower ? 'always' : 'user'}>
      {children}
    </MotionConfig>
  )
}
