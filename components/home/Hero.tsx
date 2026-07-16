'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { hero } from '@/lib/home/content'

interface HeroProps {
  onOpenDemo: () => void
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

function NodesBackground() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
      viewBox="0 0 800 600"
      fill="none"
    >
      <g stroke="#00B8F5" strokeWidth="1">
        <line x1="80" y1="120" x2="220" y2="60" />
        <line x1="220" y1="60" x2="360" y2="140" />
        <line x1="360" y1="140" x2="520" y2="80" />
        <line x1="520" y1="80" x2="680" y2="160" />
        <line x1="120" y1="380" x2="280" y2="320" />
        <line x1="280" y1="320" x2="440" y2="400" />
        <line x1="440" y1="400" x2="600" y2="340" />
      </g>
      <g fill="#00B8F5">
        <circle cx="80" cy="120" r="4" />
        <circle cx="220" cy="60" r="3" />
        <circle cx="360" cy="140" r="4" />
        <circle cx="520" cy="80" r="3" />
        <circle cx="680" cy="160" r="4" />
        <circle cx="120" cy="380" r="3" />
        <circle cx="280" cy="320" r="4" />
        <circle cx="440" cy="400" r="3" />
        <circle cx="600" cy="340" r="4" />
      </g>
    </svg>
  )
}

export function Hero({ onOpenDemo }: HeroProps) {
  const reduceMotion = useReducedMotion()

  return (
    <section className="relative overflow-hidden bg-[#03142F] pt-40 pb-24">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 20% 20%, rgba(0,184,245,0.15), transparent 55%)' }}
      />
      <NodesBackground />

      <motion.div
        initial={reduceMotion ? undefined : 'hidden'}
        animate={reduceMotion ? undefined : 'show'}
        variants={container}
        className="relative mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-2 md:items-center"
      >
        <div>
          <motion.h1
            variants={item}
            className="font-heading text-4xl font-bold leading-tight text-white md:text-5xl"
          >
            {hero.titulo}
          </motion.h1>
          <motion.p variants={item} className="mt-6 max-w-xl text-lg text-white/80">
            {hero.texto}
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap gap-4">
            <Button
              onClick={onOpenDemo}
              size="lg"
              className="rounded-full bg-[#1455E6] px-6 text-white hover:bg-[#1455E6]/90"
            >
              {hero.ctaPrimario}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-white/30 bg-transparent px-6 text-white hover:bg-white/10"
              render={<a href="#como-funciona">{hero.ctaSecundario}</a>}
            />
          </motion.div>
          <motion.p variants={item} className="mt-6 text-sm text-white/50">
            {hero.microtexto}
          </motion.p>
        </div>

        <motion.div variants={item} className="relative">
          <div
            aria-hidden="true"
            className="relative mx-auto aspect-square max-w-md rounded-[40%_60%_55%_45%/50%_45%_55%_50%] bg-gradient-to-br from-[#1455E6] via-[#00B8F5] to-[#12C7B4] opacity-90"
          />
          <div className="absolute inset-0 grid grid-cols-2 gap-3 p-6">
            {hero.tarjetas.map((tarjeta) => (
              <div
                key={tarjeta.label}
                className="self-start rounded-2xl border border-white/20 bg-[#03142F]/80 p-4 backdrop-blur-sm"
              >
                <p className="font-heading text-2xl font-semibold text-white [font-variant-numeric:tabular-nums]">
                  {tarjeta.valor}
                </p>
                <p className="mt-1 text-xs text-white/70">{tarjeta.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
