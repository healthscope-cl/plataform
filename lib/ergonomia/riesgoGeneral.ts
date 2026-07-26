import type { NivelRiesgo } from './types'

export type RiesgoGeneral = { nivel: NivelRiesgo | null; valorGauge: number }

const PESO: Record<NivelRiesgo, number> = { bajo: 1, medio: 2, alto: 3 }
const VALOR_GAUGE: Record<NivelRiesgo, number> = { bajo: 20, medio: 50, alto: 85 }

// Averages every nivel_riesgo on record (admin evaluaciones + worker autoevaluaciones) into a
// single company-wide reading, mirroring the "Current Overall Risk" gauge from the Cority
// reference. Fixed-rule bucketing, not a model — same principle as the rest of this project's
// risk logic.
export function calcularRiesgoGeneral(niveles: NivelRiesgo[]): RiesgoGeneral {
  if (niveles.length === 0) return { nivel: null, valorGauge: 0 }

  const promedio = niveles.reduce((suma, nivel) => suma + PESO[nivel], 0) / niveles.length

  let nivel: NivelRiesgo
  if (promedio < 1.5) nivel = 'bajo'
  else if (promedio < 2.5) nivel = 'medio'
  else nivel = 'alto'

  return { nivel, valorGauge: VALOR_GAUGE[nivel] }
}
