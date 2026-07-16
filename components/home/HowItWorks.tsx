'use client'

import { motion } from 'motion/react'
import { howItWorks } from '@/lib/home/content'

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-[#F4F7FB] px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">Cómo funciona</h2>
      </div>

      <div className="relative mx-auto mt-16 max-w-5xl">
        <svg
          aria-hidden="true"
          className="absolute left-0 top-6 hidden h-1 w-full md:block"
          viewBox="0 0 1000 4"
          preserveAspectRatio="none"
        >
          <motion.line
            x1="0"
            y1="2"
            x2="1000"
            y2="2"
            stroke="#00B8F5"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          />
        </svg>

        <ol className="grid gap-10 md:grid-cols-5">
          {howItWorks.pasos.map((paso, index) => (
            <motion.li
              key={paso}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.15 }}
              className="relative flex flex-col items-center text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1455E6] font-heading text-lg font-semibold text-white">
                {index + 1}
              </span>
              <p className="mt-4 text-sm text-[#48556A]">{paso}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
