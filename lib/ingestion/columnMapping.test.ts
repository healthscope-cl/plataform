import { describe, expect, it } from 'vitest'
import { suggestColumnMapping } from './columnMapping'

describe('suggestColumnMapping', () => {
  it('matches headers that exactly equal a canonical field label', () => {
    const result = suggestColumnMapping(['RUT', 'Fecha inicio', 'Fecha fin', 'Tipo'])
    expect(result.rut).toBe('RUT')
    expect(result.fechaInicio).toBe('Fecha inicio')
    expect(result.fechaFin).toBe('Fecha fin')
    expect(result.tipoAdministrativo).toBe('Tipo')
  })

  it('matches case-insensitively', () => {
    const result = suggestColumnMapping(['rut', 'FECHA DE INICIO', 'dias'])
    expect(result.rut).toBe('rut')
    expect(result.dias).toBe('dias')
  })

  it('matches accent-insensitively against a header with a real diacritic', () => {
    const result = suggestColumnMapping(['Días de ausencia'])
    expect(result.dias).toBe('Días de ausencia')
  })

  it('falls back to a substring match when no exact/normalized match exists', () => {
    const result = suggestColumnMapping(['Fecha inicio licencia'])
    expect(result.fechaInicio).toBe('Fecha inicio licencia')
  })

  it('leaves a field unmapped (null) when no header is a plausible match', () => {
    const result = suggestColumnMapping(['columna_desconocida'])
    expect(result.rut).toBeNull()
  })
})
