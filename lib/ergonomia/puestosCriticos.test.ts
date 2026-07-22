import { describe, expect, it } from 'vitest'
import { calcularPuestosCriticos } from './puestosCriticos'
import type { EvaluacionErgonomica } from './types'

function crearEvaluacion(overrides: Partial<EvaluacionErgonomica>): EvaluacionErgonomica {
  return {
    id: 'eval-1',
    tenantId: 'tenant-1',
    empresaId: 'empresa-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    creadaPor: 'usuario-1',
    cargoId: 'cargo-1',
    sucursalId: null,
    fecha: '2026-01-01',
    nivelRiesgo: 'bajo',
    hallazgos: 'Sin hallazgos relevantes',
    recomendaciones: null,
    estado: 'pendiente',
    ...overrides,
  }
}

describe('calcularPuestosCriticos', () => {
  it('marca como critico un cargo con evaluacion de riesgo alto sin resolver', () => {
    const evaluaciones = [crearEvaluacion({ cargoId: 'cargo-1', nivelRiesgo: 'alto', estado: 'pendiente' })]
    const resultado = calcularPuestosCriticos(evaluaciones)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].cargoId).toBe('cargo-1')
  })

  it('no marca como critico un cargo con evaluacion de riesgo alto ya resuelta', () => {
    const evaluaciones = [crearEvaluacion({ cargoId: 'cargo-1', nivelRiesgo: 'alto', estado: 'resuelto' })]
    const resultado = calcularPuestosCriticos(evaluaciones)
    expect(resultado).toHaveLength(0)
  })

  it('no marca como critico un cargo con solo evaluaciones de riesgo bajo o medio', () => {
    const evaluaciones = [
      crearEvaluacion({ id: 'eval-1', cargoId: 'cargo-1', fecha: '2026-01-01', nivelRiesgo: 'bajo' }),
      crearEvaluacion({ id: 'eval-2', cargoId: 'cargo-1', fecha: '2026-01-02', nivelRiesgo: 'medio' }),
    ]
    const resultado = calcularPuestosCriticos(evaluaciones)
    expect(resultado).toHaveLength(0)
  })

  it('usa la evaluacion mas reciente por fecha, no la de mayor riesgo historico', () => {
    const evaluaciones = [
      crearEvaluacion({
        id: 'eval-1',
        cargoId: 'cargo-1',
        fecha: '2026-01-01',
        nivelRiesgo: 'alto',
        estado: 'pendiente',
      }),
      crearEvaluacion({
        id: 'eval-2',
        cargoId: 'cargo-1',
        fecha: '2026-02-01',
        nivelRiesgo: 'bajo',
        estado: 'pendiente',
      }),
    ]
    const resultado = calcularPuestosCriticos(evaluaciones)
    expect(resultado).toHaveLength(0)
  })

  it('devuelve lista vacia cuando no hay evaluaciones', () => {
    const resultado = calcularPuestosCriticos([])
    expect(resultado).toEqual([])
  })
})
