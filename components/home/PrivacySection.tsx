'use client'

import { Lock } from 'lucide-react'
import { useHomeContent } from '@/lib/home/LocaleProvider'

export function PrivacySection() {
  const { privacy } = useHomeContent()

  return (
    <section id="privacidad" className="bg-[#F4F7FB] px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{privacy.titulo}</h2>
        <p className="mt-4 text-sm text-[#48556A]">{privacy.disclaimer}</p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
        {privacy.mensajes.map((mensaje) => (
          <div key={mensaje} className="flex items-center gap-3 rounded-2xl bg-white p-4">
            <Lock className="h-4 w-4 shrink-0 text-[#1455E6]" aria-hidden="true" />
            <p className="text-sm text-[#101827]">{mensaje}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
