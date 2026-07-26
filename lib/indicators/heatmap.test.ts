import { describe, expect, it } from 'vitest'
import { computeMapaCalorAusentismo, generarPeriodosMensuales } from './heatmap'

describe('computeMapaCalorAusentismo', () => {
  const sucursales = [
    { id: 's1', nombre: 'Santiago' },
    { id: 's2', nombre: 'Coquimbo' },
  ]
  const unidades = [
    { id: 'u1', sucursalId: 's1' },
    { id: 'u2', sucursalId: 's2' },
  ]
  const periodos = [{ label: 'Jul', inicio: '2026-07-01', fin: '2026-07-30' }]

  it('agrupa personas por sucursal a través de su unidad y calcula la tasa de ausentismo', () => {
    const personas = [
      { id: 'p1', unidadId: 'u1' },
      { id: 'p2', unidadId: 'u1' },
      { id: 'p3', unidadId: 'u1' },
      { id: 'p4', unidadId: 'u1' },
      { id: 'p5', unidadId: 'u1' },
    ]
    const episodios = [{ personaId: 'p1', dias: 3, fechaInicio: '2026-07-05' }]

    const resultado = computeMapaCalorAusentismo({ sucursales, unidades, personas, episodios, periodos })

    const santiago = resultado.find((f) => f.sucursalId === 's1')
    expect(santiago?.celdas[0].tasaAusentismo).toEqual({
      valor: (3 / (5 * 30)) * 100,
      numerador: 3,
      denominador: 5 * 30,
    })
  })

  it('suprime la celda cuando la sucursal tiene menos del mínimo de personas', () => {
    const personas = [
      { id: 'p1', unidadId: 'u1' },
      { id: 'p2', unidadId: 'u1' },
    ]
    const resultado = computeMapaCalorAusentismo({ sucursales, unidades, personas, episodios: [], periodos })

    const santiago = resultado.find((f) => f.sucursalId === 's1')
    expect(santiago?.celdas[0].tasaAusentismo).toEqual({ suprimido: true })
  })

  it('ignora episodios fuera de la ventana del período y de personas sin unidad', () => {
    const personas = [
      { id: 'p1', unidadId: 'u1' },
      { id: 'p2', unidadId: 'u1' },
      { id: 'p3', unidadId: 'u1' },
      { id: 'p4', unidadId: 'u1' },
      { id: 'p5', unidadId: 'u1' },
      { id: 'p6', unidadId: null },
    ]
    const episodios = [
      { personaId: 'p1', dias: 10, fechaInicio: '2026-06-15' },
      { personaId: 'p6', dias: 99, fechaInicio: '2026-07-05' },
    ]

    const resultado = computeMapaCalorAusentismo({ sucursales, unidades, personas, episodios, periodos })

    const santiago = resultado.find((f) => f.sucursalId === 's1')
    expect(santiago?.celdas[0].tasaAusentismo).toEqual({ valor: 0, numerador: 0, denominador: 5 * 30 })
  })

  it('devuelve una celda suprimida para una sucursal sin ninguna unidad con personas', () => {
    const resultado = computeMapaCalorAusentismo({
      sucursales,
      unidades,
      personas: [],
      episodios: [],
      periodos,
    })
    expect(resultado.find((f) => f.sucursalId === 's2')?.celdas[0].tasaAusentismo).toEqual({ suprimido: true })
  })
})

describe('generarPeriodosMensuales', () => {
  it('genera la cantidad de períodos pedida, terminando en la fecha de referencia', () => {
    const periodos = generarPeriodosMensuales('2026-07-26', 6)
    expect(periodos).toHaveLength(6)
    expect(periodos[5].fin).toBe('2026-07-26')
    expect(periodos[5].inicio).toBe('2026-06-27')
  })

  it('genera ventanas contiguas de 30 días sin superposición', () => {
    const periodos = generarPeriodosMensuales('2026-07-26', 3)
    expect(periodos[0]).toEqual({ label: 'may.', inicio: '2026-04-28', fin: '2026-05-27' })
    expect(periodos[1].inicio).toBe('2026-05-28')
    expect(periodos[2].inicio).toBe('2026-06-27')
  })

  it('no se rompe al cruzar un límite de año (frontera dic/ene) — regla del proyecto: nunca Date(string)+setMonth', () => {
    const periodos = generarPeriodosMensuales('2027-01-15', 2)
    expect(periodos[0].fin).toBe('2026-12-16')
    expect(periodos[1].fin).toBe('2027-01-15')
  })
})
