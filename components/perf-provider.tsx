'use client'

import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * Otimiza desempenho em celulares fracos.
 *
 * 1. LazyMotion + domAnimation: carrega apenas o nucleo leve (~5KB) do
 *    framer-motion no bundle inicial, em vez da biblioteca inteira (~34KB).
 *    Reduz download + parse de JS, o maior gargalo em aparelhos fracos.
 *    Exige usar o componente `m` (alias `motion`) em vez de `motion` direto.
 * 2. MotionConfig: em mobile/reduced-motion desliga as animacoes de entrada
 *    (transform/layout escalonados), eliminando travamento na troca de abas
 *    e melhorando a fluidez de scroll. Estado final aplicado instantaneamente.
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
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={lowPower ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
