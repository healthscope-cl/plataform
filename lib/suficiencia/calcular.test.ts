import { describe, expect, it } from 'vitest'
import { calcularIndiceSuficiencia } from './calcular'

function personas(n: number, completas = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    unidadId: i < completas ? 'u1' : null,
    cargoId: i < completas ? 'c1' : null,
    turnoId: i < completas ? 't1' : null,
  }))
}

describe('calcularIndiceSuficiencia', () => {
  it('estado solido cuando se superan los tres umbrales, sin razones ni recomendaciones', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(30, 25),
      cantidadEpisodios: 20,
      huboImportacionReciente: true,
    })
    expect(resultado.estado).toBe('solido')
    expect(resultado.razones).toEqual([])
    expect(resultado.recomendaciones).toEqual([])
  })

  it('estado utilizable cuando hay suficiente dotacion y episodios pero no llega a solido', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(10),
      cantidadEpisodios: 5,
      huboImportacionReciente: true,
    })
    expect(resultado.estado).toBe('utilizable')
    expect(resultado.razones.length).toBeGreaterThan(0)
  })

  it('estado limitado cuando hay pocas personas pero al menos un episodio', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(3),
      cantidadEpisodios: 1,
      huboImportacionReciente: true,
    })
    expect(resultado.estado).toBe('limitado')
  })

  it('estado limitado cuando hay al menos 5 personas aunque no haya episodios', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(5),
      cantidadEpisodios: 0,
      huboImportacionReciente: true,
    })
    expect(resultado.estado).toBe('limitado')
  })

  it('estado insuficiente cuando hay menos de 5 personas y cero episodios', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(2),
      cantidadEpisodios: 0,
      huboImportacionReciente: false,
    })
    expect(resultado.estado).toBe('insuficiente')
    expect(resultado.razones.length).toBeGreaterThan(0)
    expect(resultado.recomendaciones.length).toBeGreaterThan(0)
  })

  it('incluye una razon de completitud organizacional cuando menos del 70% tiene unidad/cargo/turno', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(30, 10),
      cantidadEpisodios: 20,
      huboImportacionReciente: true,
    })
    expect(resultado.estado).not.toBe('solido')
    expect(resultado.razones.some((r) => r.includes('unidad, cargo y turno'))).toBe(true)
  })

  it('incluye una razon de cobertura temporal cuando no hay importacion reciente, sin afectar el estado', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(10),
      cantidadEpisodios: 5,
      huboImportacionReciente: false,
    })
    expect(resultado.estado).toBe('utilizable')
    expect(resultado.razones.some((r) => r.includes('importación completada'))).toBe(true)
  })
})
