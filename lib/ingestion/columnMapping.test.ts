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

  it('matches case- and accent-insensitively', () => {
    const result = suggestColumnMapping(['rut', 'FECHA DE INICIO', 'dias'])
    expect(result.rut).toBe('rut')
    expect(result.dias).toBe('dias')
  })

  it('leaves a field unmapped (null) when no header is a plausible match', () => {
    const result = suggestColumnMapping(['columna_desconocida'])
    expect(result.rut).toBeNull()
  })
})
