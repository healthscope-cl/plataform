import { describe, expect, it } from 'vitest'
import { evaluarReglas } from './evaluar'
import type { ReglaAlerta } from './types'

const COSTOS = { costoPromedioDiario: 40000, horasExtra: 0, reemplazos: 0, costosAdministrativos: 0 }

function reglaBase(overrides: Partial<ReglaAlerta>): ReglaAlerta {
  return {
    id: 'r1',
    tenantId: 't1',
    empresaId: 'e1',
    createdAt: '2026-01-01',
    creadaPor: 'u1',
    nombre: 'Regla de prueba',
    indicador: 'tasaAusentismo',
    operador: 'mayor_que',
    umbral: 5,
    sucursalId: null,
    unidadId: null,
    cargoId: null,
    turnoId: null,
    activa: true,
    ...overrides,
  }
}

describe('evaluarReglas', () => {
  const personas = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    contratoDias: 100,
    unidadId: i < 5 ? 'u1' : 'u2',
    cargoId: null,
    turnoId: null,
  }))
  const unidades = [
    { id: 'u1', sucursalId: 's1' },
    { id: 'u2', sucursalId: 's1' },
  ]

  it('dispara una regla sin ámbito cuando el indicador de toda la empresa supera el umbral', () => {
    const episodios = [{ personaId: 'p0', dias: 60, estado: 'cerrado' as const }]
    const reglas = [reglaBase({ umbral: 5 })]

    const resultado = evaluarReglas({ reglas, personas, unidades, episodios, costos: COSTOS })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].valorActual).toBeCloseTo(6)
  })

  it('no dispara cuando el indicador no supera el umbral', () => {
    const episodios = [{ personaId: 'p0', dias: 10, estado: 'cerrado' as const }]
    const reglas = [reglaBase({ umbral: 5 })]

    const resultado = evaluarReglas({ reglas, personas, unidades, episodios, costos: COSTOS })

    expect(resultado).toHaveLength(0)
  })

  it('evalúa una regla con ámbito solo sobre el subconjunto filtrado, no toda la empresa', () => {
    const episodios = [
      { personaId: 'p5', dias: 60, estado: 'cerrado' as const },
      { personaId: 'p6', dias: 60, estado: 'cerrado' as const },
    ]
    const reglaEnU1 = reglaBase({ umbral: 5, unidadId: 'u1' })
    const reglaEnU2 = reglaBase({ umbral: 5, unidadId: 'u2' })

    const resultado = evaluarReglas({ reglas: [reglaEnU1, reglaEnU2], personas, unidades, episodios, costos: COSTOS })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].regla.unidadId).toBe('u2')
  })

  it('nunca dispara una regla cuyo indicador quedó suprimido por grupo pequeño', () => {
    const personasChicas = personas.slice(0, 2)
    const episodios = [{ personaId: 'p0', dias: 60, estado: 'cerrado' as const }]
    const reglas = [reglaBase({ umbral: 5 })]

    const resultado = evaluarReglas({ reglas, personas: personasChicas, unidades, episodios, costos: COSTOS })

    expect(resultado).toHaveLength(0)
  })

  it('distingue mayor_que de mayor_o_igual exactamente en el valor límite', () => {
    const episodios = [{ personaId: 'p0', dias: 50, estado: 'cerrado' as const }]
    const reglaMayorQue = reglaBase({ umbral: 5, operador: 'mayor_que' })
    const reglaMayorOIgual = reglaBase({ umbral: 5, operador: 'mayor_o_igual' })

    const resultado = evaluarReglas({
      reglas: [reglaMayorQue, reglaMayorOIgual],
      personas,
      unidades,
      episodios,
      costos: COSTOS,
    })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].regla.operador).toBe('mayor_o_igual')
  })

  it('ignora reglas inactivas', () => {
    const episodios = [{ personaId: 'p0', dias: 60, estado: 'cerrado' as const }]
    const reglas = [reglaBase({ umbral: 5, activa: false })]

    const resultado = evaluarReglas({ reglas, personas, unidades, episodios, costos: COSTOS })

    expect(resultado).toHaveLength(0)
  })
})
