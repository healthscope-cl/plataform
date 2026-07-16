import { describe, it, expect } from 'vitest'
import { calcularImpacto } from './impactCalculator'

describe('calcularImpacto', () => {
  it('calcula el costo actual y los tres escenarios con inputs típicos', () => {
    const resultado = calcularImpacto({
      dotacion: 200,
      diasAusencia: 500,
      costoPromedioDiario: 40000,
      horasExtra: 2000000,
      reemplazos: 1500000,
      costosAdministrativos: 800000,
      mejoraHipotetica: 0.15,
    })

    expect(resultado.costoActual).toBe(500 * 40000 + 2000000 + 1500000 + 800000)
    expect(resultado.escenarios).toHaveLength(3)

    const conservador = resultado.escenarios.find((e) => e.nombre === 'conservador')!
    const moderado = resultado.escenarios.find((e) => e.nombre === 'moderado')!
    const alto = resultado.escenarios.find((e) => e.nombre === 'alto')!

    expect(conservador.factor).toBe(0.5)
    expect(moderado.factor).toBe(1.0)
    expect(alto.factor).toBe(1.5)

    expect(conservador.ahorroEstimado).toBeCloseTo(resultado.costoActual * 0.15 * 0.5)
    expect(moderado.ahorroEstimado).toBeCloseTo(resultado.costoActual * 0.15 * 1.0)
    expect(alto.ahorroEstimado).toBeCloseTo(resultado.costoActual * 0.15 * 1.5)
  })

  it('devuelve ahorro cero en los tres escenarios cuando la mejora hipotética es 0', () => {
    const resultado = calcularImpacto({
      dotacion: 50,
      diasAusencia: 100,
      costoPromedioDiario: 30000,
      horasExtra: 0,
      reemplazos: 0,
      costosAdministrativos: 0,
      mejoraHipotetica: 0,
    })

    resultado.escenarios.forEach((escenario) => {
      expect(escenario.ahorroEstimado).toBe(0)
    })
  })

  it('devuelve costo actual y ahorro cero cuando todos los inputs son cero', () => {
    const resultado = calcularImpacto({
      dotacion: 0,
      diasAusencia: 0,
      costoPromedioDiario: 0,
      horasExtra: 0,
      reemplazos: 0,
      costosAdministrativos: 0,
      mejoraHipotetica: 0,
    })

    expect(resultado.costoActual).toBe(0)
    resultado.escenarios.forEach((escenario) => {
      expect(escenario.ahorroEstimado).toBe(0)
      expect(Number.isFinite(escenario.ahorroEstimado)).toBe(true)
    })
  })
})
