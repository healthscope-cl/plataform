import { describe, expect, it } from 'vitest'
import { huboIncrementoIncidentes } from './incidentes'

describe('huboIncrementoIncidentes', () => {
  it('detecta incremento cuando el período actual tiene más eventos que el anterior', () => {
    const fechas = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-02-01']
    const resultado = huboIncrementoIncidentes({ fechas, fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 3, anterior: 1, incremento: true })
  })

  it('no marca incremento cuando el período actual tiene la misma cantidad que el anterior', () => {
    const fechas = ['2026-05-01', '2026-06-01', '2026-02-01', '2026-03-01']
    const resultado = huboIncrementoIncidentes({ fechas, fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 2, anterior: 2, incremento: false })
  })

  it('no marca incremento cuando el período actual tiene menos eventos que el anterior', () => {
    const fechas = ['2026-05-01', '2026-02-01', '2026-03-01', '2026-03-15']
    const resultado = huboIncrementoIncidentes({ fechas, fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 1, anterior: 3, incremento: false })
  })

  it('una fecha exactamente en el límite entre los dos períodos cuenta como "actual", no "anterior"', () => {
    const fechas = ['2026-04-24']
    const resultado = huboIncrementoIncidentes({ fechas, fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 1, anterior: 0, incremento: true })
  })

  it('una fecha anterior a la ventana "anterior" no cuenta en ningún período', () => {
    const fechas = ['2025-01-01']
    const resultado = huboIncrementoIncidentes({ fechas, fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 0, anterior: 0, incremento: false })
  })

  it('devuelve ceros y sin incremento cuando no hay fechas', () => {
    const resultado = huboIncrementoIncidentes({ fechas: [], fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 0, anterior: 0, incremento: false })
  })
})
