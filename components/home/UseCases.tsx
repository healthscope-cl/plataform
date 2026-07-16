import { useCases } from '@/lib/home/content'

export function UseCases() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">Casos de uso</h2>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-2">
        {useCases.map((caso) => (
          <div key={caso.titulo} className="rounded-2xl border border-[#48556A]/10 p-6">
            <h3 className="font-heading text-lg font-semibold text-[#101827]">{caso.titulo}</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="font-medium text-[#1455E6]">Señal</dt>
                <dd className="text-[#48556A]">{caso.senal}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1455E6]">Datos</dt>
                <dd className="text-[#48556A]">{caso.datos}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1455E6]">Acción</dt>
                <dd className="text-[#48556A]">{caso.accion}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1455E6]">Resultado</dt>
                <dd className="text-[#48556A]">{caso.resultado}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#48556A]/70">Limitaciones</dt>
                <dd className="text-[#48556A]/70">{caso.limitaciones}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
