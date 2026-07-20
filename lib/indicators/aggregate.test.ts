import { describe, expect, it } from 'vitest'
import { computeIndicadores } from './aggregate'

const COSTOS = { costoPromedioDiario: 40000, horasExtra: 0, reemplazos: 0, costosAdministrativos: 0 }

describe('computeIndicadores', () => {
  it('computes all six indicators from raw episodio/persona rows for a period', () => {
    const personas = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, contratoDias: 90 }))
    const episodios = [
      { personaId: 'p0', dias: 3, estado: 'cerrado' as const },
      { personaId: 'p0', dias: 5, estado: 'cerrado' as const },
      { personaId: 'p1', dias: 10, estado: 'cerrado' as const },
      { personaId: 'p2', dias: 2, estado: 'abierto' as const },
    ]

    const result = computeIndicadores({ personas, episodios, costos: COSTOS })

    expect(result.tasaAusentismo).toEqual({ valor: 20 / 900 * 100, numerador: 20, denominador: 900 })
    expect(result.frecuencia).toEqual({ valor: 4 / 10 * 100, numerador: 4, denominador: 10 })
    expect(result.severidad).toEqual({ valor: 20 / 4, numerador: 20, denominador: 4 })
    expect(result.duracionPromedio).toEqual({ valor: 18 / 3, numerador: 18, denominador: 3 })
    expect(result.reincidencia).toEqual({ valor: 1 / 3 * 100, numerador: 1, denominador: 3 })
    expect(result.costoEstimado).toEqual({ valor: 20 * 40000, numerador: 20 * 40000, denominador: 1 })
  })

  it('suppresses rate indicators (not cost) when fewer than MIN_GROUP_SIZE personas are given', () => {
    const personas = [
      { id: 'p0', contratoDias: 30 },
      { id: 'p1', contratoDias: 30 },
    ]
    const episodios = [{ personaId: 'p0', dias: 2, estado: 'cerrado' as const }]

    const result = computeIndicadores({ personas, episodios, costos: COSTOS })

    expect(result.tasaAusentismo).toEqual({ suprimido: true })
    expect(result.frecuencia).toEqual({ suprimido: true })
    expect(result.severidad).toEqual({ suprimido: true })
    expect(result.reincidencia).toEqual({ suprimido: true })
    expect(result.costoEstimado).toEqual({ valor: 2 * 40000, numerador: 2 * 40000, denominador: 1 })
  })

  it('handles zero episodios without dividing by zero', () => {
    const personas = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, contratoDias: 30 }))
    const result = computeIndicadores({ personas, episodios: [], costos: COSTOS })

    expect(result.severidad).toEqual({ valor: 0, numerador: 0, denominador: 0 })
    expect(result.duracionPromedio).toEqual({ valor: 0, numerador: 0, denominador: 0 })
    expect(result.reincidencia).toEqual({ valor: 0, numerador: 0, denominador: 0 })
  })
})
