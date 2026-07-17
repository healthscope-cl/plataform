'use client'

import { motion, useReducedMotion } from 'motion/react'
import { results } from '@/lib/home/content'

const barras = [
  { label: 'Línea base', valor: 68, color: '#48556A' },
  { label: 'Intervención', valor: 52, color: '#00B8F5' },
  { label: 'Actual', valor: 41, color: '#38D978' },
]

export function ResultsSection() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{results.titulo}</h2>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[#48556A]/60">
          {results.etiquetaDemo} — período de comparación: 6 meses
        </p>
      </div>

      <div className="mx-auto mt-14 flex max-w-2xl items-end justify-center gap-10">
        {barras.map((barra, index) => (
          <div key={barra.label} className="flex flex-col items-center gap-3">
            <motion.div
              initial={reduceMotion ? { height: `${barra.valor * 2}px` } : { height: 0 }}
              whileInView={reduceMotion ? undefined : { height: `${barra.valor * 2}px` }}
              viewport={{ once: true }}
              transition={reduceMotion ? undefined : { duration: 0.6, delay: index * 0.15 }}
              className="w-16 rounded-t-lg"
              style={{ backgroundColor: barra.color }}
            />
            <p className="font-heading text-lg font-semibold text-[#101827] [font-variant-numeric:tabular-nums]">
              {barra.valor}
            </p>
            <p className="text-xs text-[#48556A]">{barra.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
