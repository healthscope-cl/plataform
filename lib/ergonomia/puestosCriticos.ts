import type { EvaluacionErgonomica } from './types'

export type PuestoCritico = {
  cargoId: string
  evaluacionId: string
  fecha: string
  hallazgos: string
}

export function calcularPuestosCriticos(evaluaciones: EvaluacionErgonomica[]): PuestoCritico[] {
  const masRecientePorCargo = new Map<string, EvaluacionErgonomica>()

  for (const evaluacion of evaluaciones) {
    const actual = masRecientePorCargo.get(evaluacion.cargoId)
    if (!actual) {
      masRecientePorCargo.set(evaluacion.cargoId, evaluacion)
      continue
    }
    const esMasReciente =
      evaluacion.fecha > actual.fecha || (evaluacion.fecha === actual.fecha && evaluacion.createdAt > actual.createdAt)
    if (esMasReciente) {
      masRecientePorCargo.set(evaluacion.cargoId, evaluacion)
    }
  }

  const criticos: PuestoCritico[] = []
  for (const evaluacion of masRecientePorCargo.values()) {
    if (evaluacion.nivelRiesgo === 'alto' && evaluacion.estado !== 'resuelto') {
      criticos.push({
        cargoId: evaluacion.cargoId,
        evaluacionId: evaluacion.id,
        fecha: evaluacion.fecha,
        hallazgos: evaluacion.hallazgos,
      })
    }
  }

  return criticos
}
