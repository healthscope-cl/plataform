import { describe, expect, it } from 'vitest'
import { calcularRiesgoGeneral } from './riesgoGeneral'

describe('calcularRiesgoGeneral', () => {
  it('devuelve nivel null cuando no hay ningún registro', () => {
    expect(calcularRiesgoGeneral([])).toEqual({ nivel: null, valorGauge: 0 })
  })

  it('da bajo cuando todos los registros son bajo', () => {
    expect(calcularRiesgoGeneral(['bajo', 'bajo', 'bajo'])).toEqual({ nivel: 'bajo', valorGauge: 20 })
  })

  it('da alto cuando todos los registros son alto', () => {
    expect(calcularRiesgoGeneral(['alto', 'alto'])).toEqual({ nivel: 'alto', valorGauge: 85 })
  })

  it('da medio con una mezcla balanceada de bajo y alto', () => {
    expect(calcularRiesgoGeneral(['bajo', 'alto'])).toEqual({ nivel: 'medio', valorGauge: 50 })
  })

  it('un solo registro alto entre varios bajos no domina el promedio', () => {
    expect(calcularRiesgoGeneral(['bajo', 'bajo', 'bajo', 'bajo', 'alto'])).toEqual({
      nivel: 'bajo',
      valorGauge: 20,
    })
  })
})
