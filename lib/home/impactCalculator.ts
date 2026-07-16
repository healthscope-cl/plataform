export interface ImpactCalculatorInput {
  dotacion: number
  diasAusencia: number
  costoPromedioDiario: number
  horasExtra: number
  reemplazos: number
  costosAdministrativos: number
  mejoraHipotetica: number // 0-1, ej. 0.15 = 15%
}

export interface ImpactScenario {
  nombre: 'conservador' | 'moderado' | 'alto'
  factor: number
  ahorroEstimado: number
}

export function calcularImpacto(input: ImpactCalculatorInput): {
  costoActual: number
  escenarios: ImpactScenario[]
} {
  const costoActual =
    input.diasAusencia * input.costoPromedioDiario +
    input.horasExtra +
    input.reemplazos +
    input.costosAdministrativos

  const factores: Array<[ImpactScenario['nombre'], number]> = [
    ['conservador', 0.5],
    ['moderado', 1.0],
    ['alto', 1.5],
  ]

  const escenarios = factores.map(([nombre, factor]) => ({
    nombre,
    factor,
    ahorroEstimado: costoActual * input.mejoraHipotetica * factor,
  }))

  return { costoActual, escenarios }
}
