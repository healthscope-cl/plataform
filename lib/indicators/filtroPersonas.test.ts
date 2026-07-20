import { describe, expect, it } from 'vitest'
import { filtrarPersonas } from './filtroPersonas'

const unidades = [
  { id: 'u1', sucursalId: 's1' },
  { id: 'u2', sucursalId: 's2' },
]

const personas = [
  { id: 'p1', unidadId: 'u1', cargoId: 'c1', turnoId: 't1' },
  { id: 'p2', unidadId: 'u2', cargoId: 'c2', turnoId: 't1' },
  { id: 'p3', unidadId: null, cargoId: null, turnoId: null },
]

describe('filtrarPersonas', () => {
  it('devuelve todas las personas cuando el filtro está vacío', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: null, unidadId: null, cargoId: null, turnoId: null }, unidades)
    expect(resultado).toEqual(personas)
  })

  it('filtra por unidad', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: null, unidadId: 'u1', cargoId: null, turnoId: null }, unidades)
    expect(resultado).toEqual([personas[0]])
  })

  it('filtra por sucursal, incluyendo solo personas de las unidades de esa sucursal', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: 's2', unidadId: null, cargoId: null, turnoId: null }, unidades)
    expect(resultado).toEqual([personas[1]])
  })

  it('excluye personas sin unidad asignada cuando el filtro es por sucursal', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: 's1', unidadId: null, cargoId: null, turnoId: null }, unidades)
    expect(resultado).toEqual([personas[0]])
  })

  it('combina varios filtros a la vez (AND)', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: null, unidadId: null, cargoId: null, turnoId: 't1' }, unidades)
    expect(resultado).toEqual([personas[0], personas[1]])
  })

  it('devuelve arreglo vacío cuando ningún filtro coincide', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: null, unidadId: 'u-inexistente', cargoId: null, turnoId: null }, unidades)
    expect(resultado).toEqual([])
  })
})
