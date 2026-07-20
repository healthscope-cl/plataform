import { describe, expect, it } from 'vitest'
import { resolveIdPorNombre, resolveUnidadId } from './groupMatching'

describe('resolveIdPorNombre', () => {
  const catalogo = [
    { id: 'c1', nombre: 'Ventas' },
    { id: 'c2', nombre: 'Logística' },
  ]

  it('resuelve por coincidencia exacta', () => {
    expect(resolveIdPorNombre('Ventas', catalogo)).toBe('c1')
  })

  it('resuelve insensible a mayúsculas y acentos', () => {
    expect(resolveIdPorNombre('logistica', catalogo)).toBe('c2')
  })

  it('devuelve null cuando no hay coincidencia', () => {
    expect(resolveIdPorNombre('Marketing', catalogo)).toBeNull()
  })

  it('devuelve null cuando el nombre es null', () => {
    expect(resolveIdPorNombre(null, catalogo)).toBeNull()
  })
})

describe('resolveUnidadId', () => {
  const sucursales = [
    { id: 's1', nombre: 'Santiago Centro' },
    { id: 's2', nombre: 'Valparaíso' },
  ]
  const unidades = [
    { id: 'u1', nombre: 'Ventas', sucursalId: 's1' },
    { id: 'u2', nombre: 'Ventas', sucursalId: 's2' },
    { id: 'u3', nombre: 'Logística', sucursalId: 's2' },
  ]

  it('resuelve la unidad correcta dentro de la sucursal indicada, cuando el mismo nombre existe en varias sucursales', () => {
    expect(resolveUnidadId('Ventas', 'Valparaíso', sucursales, unidades)).toBe('u2')
    expect(resolveUnidadId('Ventas', 'Santiago Centro', sucursales, unidades)).toBe('u1')
  })

  it('resuelve por nombre de unidad sola cuando no se indica sucursal (primera coincidencia)', () => {
    expect(resolveUnidadId('Logística', null, sucursales, unidades)).toBe('u3')
  })

  it('devuelve null cuando la sucursal indicada no existe en el catálogo', () => {
    expect(resolveUnidadId('Ventas', 'Concepción', sucursales, unidades)).toBeNull()
  })

  it('devuelve null cuando el nombre de unidad es null', () => {
    expect(resolveUnidadId(null, null, sucursales, unidades)).toBeNull()
  })
})
