'use client'

import { Button } from '@/components/ui/button'
import { useHomeContent } from '@/lib/home/LocaleProvider'

interface ClosingCtaProps {
  onOpenDemo: () => void
}

export function ClosingCta({ onOpenDemo }: ClosingCtaProps) {
  const { closing } = useHomeContent()

  return (
    <section id="cierre" className="bg-[#03142F] px-6 py-24 text-center">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">{closing.titulo}</h2>
        <p className="mt-6 text-lg text-white/80">{closing.texto}</p>
        <Button onClick={onOpenDemo} size="lg" className="mt-8 rounded-full bg-[#1455E6] px-8 text-white hover:bg-[#1455E6]/90">
          {closing.cta}
        </Button>
      </div>
    </section>
  )
}
