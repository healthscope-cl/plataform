import { describe, expect, it } from 'vitest'
import { agregarRespuestas } from './agregar'

describe('agregarRespuestas', () => {
  it('calcula el promedio correcto por pregunta cuando hay suficientes respuestas', () => {
    const respuestas = Array.from({ length: 5 }, (_, i) => ({ estres: i + 1 }))
    const resultado = agregarRespuestas({ preguntaIds: ['estres'], respuestas })
    expect(resultado.estres).toEqual({ promedio: 3, cantidad: 5 })
  })

  it('suprime una pregunta con menos de MIN_GROUP_SIZE respuestas', () => {
    const respuestas = [{ estres: 5 }, { estres: 4 }]
    const resultado = agregarRespuestas({ preguntaIds: ['estres'], respuestas })
    expect(resultado.estres).toEqual({ suprimido: true })
  })

  it('maneja una encuesta sin respuestas todavia', () => {
    const resultado = agregarRespuestas({ preguntaIds: ['estres', 'fatiga'], respuestas: [] })
    expect(resultado.estres).toEqual({ suprimido: true })
    expect(resultado.fatiga).toEqual({ suprimido: true })
  })

  it('solo incluye preguntas listadas en preguntaIds, ignorando otras claves presentes en las respuestas', () => {
    const respuestas = Array.from({ length: 5 }, () => ({ estres: 3, fatiga: 4, otraPregunta: 1 }))
    const resultado = agregarRespuestas({ preguntaIds: ['estres'], respuestas })
    expect(Object.keys(resultado)).toEqual(['estres'])
  })

  it('ignora respuestas parciales que no incluyen una pregunta especifica al calcular su promedio', () => {
    const respuestas = [
      ...Array.from({ length: 5 }, () => ({ estres: 5 })),
      { fatiga: 1 },
    ]
    const resultado = agregarRespuestas({ preguntaIds: ['estres'], respuestas })
    expect(resultado.estres).toEqual({ promedio: 5, cantidad: 5 })
  })
})
