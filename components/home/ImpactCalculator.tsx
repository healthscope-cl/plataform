'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calcularImpacto, type ImpactCalculatorInput } from '@/lib/home/impactCalculator'
import { useHomeContent } from '@/lib/home/LocaleProvider'

const defaultInput: ImpactCalculatorInput = {
  dotacion: 200,
  diasAusencia: 500,
  costoPromedioDiario: 40000,
  horasExtra: 2000000,
  reemplazos: 1500000,
  costosAdministrativos: 800000,
  mejoraHipotetica: 0.15,
}

const campoSteps: Partial<Record<keyof ImpactCalculatorInput, string>> = {
  mejoraHipotetica: '0.01',
}

function formatCLP(valor: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(valor)
}

export function ImpactCalculator() {
  const { impactCalculator } = useHomeContent()
  const [input, setInput] = useState<ImpactCalculatorInput>(defaultInput)

  const campos = (Object.keys(impactCalculator.campos) as Array<keyof ImpactCalculatorInput>).map((key) => ({
    key,
    label: impactCalculator.campos[key],
    step: campoSteps[key],
  }))

  const resultado = useMemo(() => calcularImpacto(input), [input])

  function handleChange(key: keyof ImpactCalculatorInput, raw: string) {
    const valor = Number(raw)
    const parsed = Number.isFinite(valor) ? Math.max(0, valor) : 0
    setInput((prev) => ({
      ...prev,
      [key]: key === 'mejoraHipotetica' ? parsed / 100 : parsed,
    }))
  }

  return (
    <section className="bg-[#F4F7FB] px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{impactCalculator.titulo}</h2>
        <p className="mt-4 text-sm text-[#48556A]">{impactCalculator.subtitulo}</p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-10 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {campos.map((campo) => (
            <div key={campo.key}>
              <Label htmlFor={campo.key} className="text-sm text-[#48556A]">
                {campo.label}
              </Label>
              <Input
                id={campo.key}
                type="number"
                min={0}
                step={campo.step}
                value={campo.key === 'mejoraHipotetica' ? input.mejoraHipotetica * 100 : input[campo.key]}
                onChange={(event) => handleChange(campo.key, event.target.value)}
                className="mt-1 bg-white"
              />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#48556A]/10 bg-white p-6">
          <p className="text-sm text-[#48556A]">{impactCalculator.costoActualLabel}</p>
          <p className="font-heading text-3xl font-bold text-[#101827] [font-variant-numeric:tabular-nums]">
            {formatCLP(resultado.costoActual)}
          </p>

          <div className="mt-6 space-y-3">
            {resultado.escenarios.map((escenario) => (
              <div key={escenario.nombre} className="flex items-center justify-between rounded-xl bg-[#F4F7FB] px-4 py-3">
                <span className="text-sm text-[#101827]">{impactCalculator.escenarios[escenario.nombre]}</span>
                <span className="font-heading text-sm font-semibold text-[#38D978] [font-variant-numeric:tabular-nums]">
                  {formatCLP(escenario.ahorroEstimado)}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-6 rounded-xl bg-[#F4F7FB] p-4 text-xs text-[#48556A]">{impactCalculator.formula}</p>
        </div>
      </div>
    </section>
  )
}
