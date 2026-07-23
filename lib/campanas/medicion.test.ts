import { describe, expect, it } from 'vitest'
import { medirAntesDespues } from './medicion'

describe('medirAntesDespues', () => {
  it('calcula el promedio correcto antes y después cuando hay suficientes valores en cada lado', () => {
    const valores = [
      { valor: 5, fecha: '2026-01-01' },
      { valor: 5, fecha: '2026-01-02' },
      { valor: 5, fecha: '2026-01-03' },
      { valor: 5, fecha: '2026-01-04' },
      { valor: 5, fecha: '2026-01-05' },
      { valor: 2, fecha: '2026-03-01' },
      { valor: 2, fecha: '2026-03-02' },
      { valor: 2, fecha: '2026-03-03' },
      { valor: 2, fecha: '2026-03-04' },
      { valor: 2, fecha: '2026-03-05' },
    ]
    const resultado = medirAntesDespues({ valores, fechaInicio: '2026-02-01', fechaFin: '2026-02-15' })
    expect(resultado.antes).toEqual({ promedio: 5, cantidad: 5 })
    expect(resultado.despues).toEqual({ promedio: 2, cantidad: 5 })
  })

  it('suprime un lado con menos de MIN_GROUP_SIZE valores', () => {
    const valores = [
      { valor: 5, fecha: '2026-01-01' },
      { valor: 5, fecha: '2026-01-02' },
    ]
    const resultado = medirAntesDespues({ valores, fechaInicio: '2026-02-01', fechaFin: '2026-02-15' })
    expect(resultado.antes).toEqual({ suprimido: true })
  })

  it('marca sinDatos cuando un lado tiene cero valores', () => {
    const resultado = medirAntesDespues({ valores: [], fechaInicio: '2026-02-01', fechaFin: '2026-02-15' })
    expect(resultado.antes).toEqual({ sinDatos: true })
    expect(resultado.despues).toEqual({ sinDatos: true })
  })

  it('devuelve despues: null cuando la campaña no tiene fecha de fin', () => {
    const valores = [{ valor: 5, fecha: '2026-01-01' }]
    const resultado = medirAntesDespues({ valores, fechaInicio: '2026-02-01', fechaFin: null })
    expect(resultado.despues).toBeNull()
  })

  it('excluye un valor fechado exactamente en fecha_inicio del grupo "antes"', () => {
    const valores = Array.from({ length: 5 }, () => ({ valor: 5, fecha: '2026-02-01' }))
    const resultado = medirAntesDespues({ valores, fechaInicio: '2026-02-01', fechaFin: '2026-02-15' })
    expect(resultado.antes).toEqual({ sinDatos: true })
  })

  it('excluye un valor fechado exactamente en fecha_fin del grupo "despues"', () => {
    const valores = Array.from({ length: 5 }, () => ({ valor: 5, fecha: '2026-02-15' }))
    const resultado = medirAntesDespues({ valores, fechaInicio: '2026-02-01', fechaFin: '2026-02-15' })
    expect(resultado.despues).toEqual({ sinDatos: true })
  })
})
