'use client'

import { motion } from 'motion/react'
import { problem } from '@/lib/home/content'

export function ProblemSection() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{problem.titulo}</h2>
        <p className="mt-6 text-lg text-[#48556A]">{problem.texto}</p>
      </div>

      <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
        {problem.tarjetas.map((tarjeta, index) => (
          <motion.div
            key={tarjeta}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="rounded-2xl border border-[#48556A]/10 bg-[#F4F7FB] p-6"
          >
            <p className="font-heading text-lg font-semibold text-[#101827]">{tarjeta}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
