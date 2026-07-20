import { describe, expect, it } from 'vitest'
import {
  MIN_GROUP_SIZE,
  tasaAusentismo,
  frecuencia,
  severidad,
  duracionPromedio,
  reincidencia,
  costoEstimado,
  cambio,
} from './formulas'

describe('tasaAusentismo', () => {
  it('computes (dias perdidos / dias programados) * 100 with numerador/denominador', () => {
    const result = tasaAusentismo({ diasPerdidos: 28, diasProgramados: 560, personasActivas: 10 })
    expect(result).toEqual({ valor: 5, numerador: 28, denominador: 560 })
  })

  it('suppresses the result when personasActivas is below MIN_GROUP_SIZE', () => {
    const result = tasaAusentismo({ diasPerdidos: 3, diasProgramados: 30, personasActivas: MIN_GROUP_SIZE - 1 })
    expect(result).toEqual({ suprimido: true })
  })

  it('returns valor 0 when diasProgramados is 0 (no active people, avoid division by zero)', () => {
    const result = tasaAusentismo({ diasPerdidos: 0, diasProgramados: 0, personasActivas: MIN_GROUP_SIZE })
    expect(result).toEqual({ valor: 0, numerador: 0, denominador: 0 })
  })
})

describe('frecuencia', () => {
  it('computes (episodios / dotacion promedio) * 100', () => {
    const result = frecuencia({ episodios: 12, dotacionPromedio: 40, personasActivas: MIN_GROUP_SIZE })
    expect(result).toEqual({ valor: 30, numerador: 12, denominador: 40 })
  })

  it('suppresses when personasActivas is below MIN_GROUP_SIZE', () => {
    expect(frecuencia({ episodios: 1, dotacionPromedio: 2, personasActivas: 1 })).toEqual({ suprimido: true })
  })
})

describe('severidad', () => {
  it('computes dias perdidos / episodios', () => {
    expect(severidad({ diasPerdidos: 90, episodios: 12, personasActivas: MIN_GROUP_SIZE })).toEqual({
      valor: 7.5,
      numerador: 90,
      denominador: 12,
    })
  })

  it('returns valor 0 when episodios is 0', () => {
    expect(severidad({ diasPerdidos: 0, episodios: 0, personasActivas: MIN_GROUP_SIZE })).toEqual({
      valor: 0,
      numerador: 0,
      denominador: 0,
    })
  })
})

describe('duracionPromedio', () => {
  it('computes dias perdidos / episodios cerrados', () => {
    expect(
      duracionPromedio({ diasPerdidos: 40, episodiosCerrados: 8, personasActivas: MIN_GROUP_SIZE })
    ).toEqual({ valor: 5, numerador: 40, denominador: 8 })
  })
})

describe('reincidencia', () => {
  it('computes personas con 2+ episodios / personas con 1+ episodio', () => {
    expect(
      reincidencia({ personasConDosOMasEpisodios: 6, personasConUnOMasEpisodios: 24, personasActivas: MIN_GROUP_SIZE })
    ).toEqual({ valor: 25, numerador: 6, denominador: 24 })
  })

  it('returns valor 0 when nobody has any episode', () => {
    expect(
      reincidencia({ personasConDosOMasEpisodios: 0, personasConUnOMasEpisodios: 0, personasActivas: MIN_GROUP_SIZE })
    ).toEqual({ valor: 0, numerador: 0, denominador: 0 })
  })
})

describe('cambio', () => {
  it('computes (valor actual - linea base) / linea base as a fraction', () => {
    expect(cambio({ valorActual: 4.5, valorLineaBase: 6 })).toEqual({ valor: (4.5 - 6) / 6, numerador: 4.5 - 6, denominador: 6 })
  })

  it('returns null when there is no baseline to compare against', () => {
    expect(cambio({ valorActual: 5, valorLineaBase: null })).toBeNull()
  })

  it('returns null when either side is suprimido (nothing to compare)', () => {
    expect(cambio({ valorActual: null, valorLineaBase: 5 })).toBeNull()
  })
})

describe('costoEstimado', () => {
  it('sums directos + reemplazos + horas extra + administrativos', () => {
    const result = costoEstimado({
      diasPerdidos: 20,
      costoPromedioDiario: 40000,
      horasExtra: 500000,
      reemplazos: 300000,
      costosAdministrativos: 100000,
      personasActivas: MIN_GROUP_SIZE,
    })
    expect(result).toEqual({ valor: 20 * 40000 + 500000 + 300000 + 100000, numerador: 20 * 40000 + 500000 + 300000 + 100000, denominador: 1 })
  })

  it('is not suppressed by small groups (a cost total, not a per-person rate)', () => {
    const result = costoEstimado({
      diasPerdidos: 1,
      costoPromedioDiario: 1000,
      horasExtra: 0,
      reemplazos: 0,
      costosAdministrativos: 0,
      personasActivas: 1,
    })
    expect(result).toEqual({ valor: 1000, numerador: 1000, denominador: 1 })
  })
})
