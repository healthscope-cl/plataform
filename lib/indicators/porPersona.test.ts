import { describe, expect, it } from 'vitest'
import { computeIndicadoresPorPersona } from './porPersona'

describe('computeIndicadoresPorPersona', () => {
  it('computa dias perdidos, cantidad de episodios y costo estimado por cada persona', () => {
    const personas = [
      { id: 'p1', codigo: 'EMP001' },
      { id: 'p2', codigo: 'EMP002' },
    ]
    const episodios = [
      { personaId: 'p1', dias: 3 },
      { personaId: 'p1', dias: 5 },
      { personaId: 'p2', dias: 10 },
    ]

    const resultado = computeIndicadoresPorPersona({ personas, episodios, costoPromedioDiario: 40000 })

    expect(resultado).toEqual([
      { id: 'p1', codigo: 'EMP001', diasPerdidos: 8, cantidadEpisodios: 2, costoEstimado: 8 * 40000 },
      { id: 'p2', codigo: 'EMP002', diasPerdidos: 10, cantidadEpisodios: 1, costoEstimado: 10 * 40000 },
    ])
  })

  it('devuelve ceros para una persona sin episodios en el período', () => {
    const personas = [{ id: 'p1', codigo: 'EMP001' }]
    const resultado = computeIndicadoresPorPersona({ personas, episodios: [], costoPromedioDiario: 40000 })
    expect(resultado).toEqual([{ id: 'p1', codigo: 'EMP001', diasPerdidos: 0, cantidadEpisodios: 0, costoEstimado: 0 }])
  })

  it('ignora episodios de personas que no están en la lista de personas activas', () => {
    const personas = [{ id: 'p1', codigo: 'EMP001' }]
    const episodios = [
      { personaId: 'p1', dias: 3 },
      { personaId: 'p-fantasma', dias: 99 },
    ]
    const resultado = computeIndicadoresPorPersona({ personas, episodios, costoPromedioDiario: 40000 })
    expect(resultado).toEqual([{ id: 'p1', codigo: 'EMP001', diasPerdidos: 3, cantidadEpisodios: 1, costoEstimado: 3 * 40000 }])
  })
})
