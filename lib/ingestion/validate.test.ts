import { describe, expect, it } from 'vitest'
import { validateRows } from './validate'

const tiposValidos = ['enfermedad_comun', 'accidente_laboral']

describe('validateRows', () => {
  it('flags a missing required field as critical', () => {
    const result = validateRows({
      rows: [{ rut: null, fechaInicio: '2026-01-05', dias: 3, tipoAdministrativo: 'enfermedad_comun' }],
      tiposValidos,
    })
    expect(result.resumen.criticos).toBe(1)
    expect(result.filaErrors.get(0)?.[0].tipo).toBe('campo_obligatorio_faltante')
  })

  it('flags negative or zero dias as critical', () => {
    const result = validateRows({
      rows: [{ rut: '12345678-9', fechaInicio: '2026-01-05', dias: -1, tipoAdministrativo: 'enfermedad_comun' }],
      tiposValidos,
    })
    expect(result.filaErrors.get(0)?.some((e) => e.tipo === 'duracion_invalida')).toBe(true)
  })

  it('flags an unrecognized tipoAdministrativo as critical', () => {
    const result = validateRows({
      rows: [{ rut: '12345678-9', fechaInicio: '2026-01-05', dias: 3, tipoAdministrativo: 'inventado' }],
      tiposValidos,
    })
    expect(result.filaErrors.get(0)?.some((e) => e.tipo === 'tipo_no_reconocido')).toBe(true)
  })

  it('flags an impossible date (fechaFin before fechaInicio) as critical', () => {
    const result = validateRows({
      rows: [
        {
          rut: '12345678-9',
          fechaInicio: '2026-02-01',
          fechaFin: '2026-01-01',
          dias: 3,
          tipoAdministrativo: 'enfermedad_comun',
        },
      ],
      tiposValidos,
    })
    expect(result.filaErrors.get(0)?.some((e) => e.tipo === 'fecha_imposible')).toBe(true)
  })

  it('flags a duplicate row (same rut + fechaInicio) as a warning, keeping the first', () => {
    const result = validateRows({
      rows: [
        { rut: '12345678-9', fechaInicio: '2026-01-05', dias: 3, tipoAdministrativo: 'enfermedad_comun' },
        { rut: '12345678-9', fechaInicio: '2026-01-05', dias: 3, tipoAdministrativo: 'enfermedad_comun' },
      ],
      tiposValidos,
    })
    expect(result.filaErrors.get(0)).toBeUndefined()
    const duplicateRowErrors = result.filaErrors.get(1) ?? []
    expect(duplicateRowErrors).toHaveLength(1)
    expect(duplicateRowErrors[0]).toEqual({ tipo: 'fila_duplicada', severidad: 'advertencia', mensaje: expect.any(String) })
    expect(duplicateRowErrors.some((e) => e.severidad === 'critico')).toBe(false)
    expect(result.resumen.advertencias).toBe(1)
    expect(result.resumen.criticos).toBe(0)
  })

  it('does not flag an exact-duplicate period as periodo_superpuesto (only as fila_duplicada)', () => {
    const result = validateRows({
      rows: [
        {
          rut: '12345678-9',
          fechaInicio: '2026-01-05',
          fechaFin: '2026-01-10',
          dias: 6,
          tipoAdministrativo: 'enfermedad_comun',
        },
        {
          rut: '12345678-9',
          fechaInicio: '2026-01-05',
          fechaFin: '2026-01-10',
          dias: 6,
          tipoAdministrativo: 'enfermedad_comun',
        },
      ],
      tiposValidos,
    })
    const duplicateRowErrors = result.filaErrors.get(1) ?? []
    expect(duplicateRowErrors).toHaveLength(1)
    expect(duplicateRowErrors[0].tipo).toBe('fila_duplicada')
    expect(duplicateRowErrors.some((e) => e.tipo === 'periodo_superpuesto')).toBe(false)
    expect(result.resumen.criticos).toBe(0)
    expect(result.resumen.advertencias).toBe(1)
  })

  it('flags overlapping periods for the same person as critical', () => {
    const result = validateRows({
      rows: [
        {
          rut: '12345678-9',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-01-10',
          dias: 10,
          tipoAdministrativo: 'enfermedad_comun',
        },
        {
          rut: '12345678-9',
          fechaInicio: '2026-01-05',
          fechaFin: '2026-01-15',
          dias: 11,
          tipoAdministrativo: 'enfermedad_comun',
        },
      ],
      tiposValidos,
    })
    expect(result.filaErrors.get(1)?.some((e) => e.tipo === 'periodo_superpuesto')).toBe(true)
  })

  it('returns zero errors for a clean, non-overlapping row set', () => {
    const result = validateRows({
      rows: [
        { rut: '12345678-9', fechaInicio: '2026-01-05', dias: 3, tipoAdministrativo: 'enfermedad_comun' },
        { rut: '11111111-1', fechaInicio: '2026-02-10', dias: 5, tipoAdministrativo: 'accidente_laboral' },
      ],
      tiposValidos,
    })
    expect(result.resumen.criticos).toBe(0)
    expect(result.resumen.advertencias).toBe(0)
  })
})
