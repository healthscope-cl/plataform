'use client'

import { useHomeContent } from '@/lib/home/LocaleProvider'

export function UseCases() {
  const { useCases } = useHomeContent()

  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{useCases.titulo}</h2>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-2">
        {useCases.items.map((caso) => (
          <div key={caso.titulo} className="rounded-2xl border border-[#48556A]/10 p-6">
            <h3 className="font-heading text-lg font-semibold text-[#101827]">{caso.titulo}</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="font-medium text-[#1455E6]">{useCases.labels.senal}</dt>
                <dd className="text-[#48556A]">{caso.senal}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1455E6]">{useCases.labels.datos}</dt>
                <dd className="text-[#48556A]">{caso.datos}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1455E6]">{useCases.labels.accion}</dt>
                <dd className="text-[#48556A]">{caso.accion}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1455E6]">{useCases.labels.resultado}</dt>
                <dd className="text-[#48556A]">{caso.resultado}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#48556A]/70">{useCases.labels.limitaciones}</dt>
                <dd className="text-[#48556A]/70">{caso.limitaciones}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
