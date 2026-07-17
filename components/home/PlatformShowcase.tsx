'use client'

import { useHomeContent } from '@/lib/home/LocaleProvider'

export function PlatformShowcase() {
  const { platformShowcase } = useHomeContent()

  return (
    <section id="plataforma" className="bg-[#03142F] px-6 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        <div>
          <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">{platformShowcase.titulo}</h2>
          <p className="mt-6 text-lg text-white/80">{platformShowcase.texto}</p>
          <a
            href="#cierre"
            className="mt-8 inline-block rounded-full bg-[#1455E6] px-6 py-3 text-sm font-medium text-white hover:bg-[#1455E6]/90"
          >
            {platformShowcase.cta}
          </a>
        </div>

        <div
          aria-hidden="true"
          className="aspect-video rounded-2xl border border-white/10 bg-gradient-to-br from-[#1455E6]/30 via-[#00B8F5]/20 to-[#12C7B4]/20 p-6"
        >
          <div className="grid h-full grid-cols-3 gap-3">
            <div className="col-span-2 rounded-xl bg-white/5" />
            <div className="rounded-xl bg-white/5" />
            <div className="rounded-xl bg-white/5" />
            <div className="col-span-2 rounded-xl bg-white/5" />
          </div>
        </div>
      </div>
    </section>
  )
}
