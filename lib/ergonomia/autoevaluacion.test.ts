import { describe, expect, it } from 'vitest'
import { evaluarAutoevaluacion, type RespuestasAutoevaluacion } from './autoevaluacion'

const RESPUESTAS_OK: RespuestasAutoevaluacion = {
  pantallaAlturaOjos: true,
  sillaConSoporteLumbar: true,
  pausasActivas: true,
  piesApoyados: true,
  molestias: 'nunca',
}

describe('evaluarAutoevaluacion', () => {
  it('da riesgo bajo y sin recomendaciones cuando todas las respuestas son favorables', () => {
    const resultado = evaluarAutoevaluacion(RESPUESTAS_OK)
    expect(resultado.nivelRiesgo).toBe('bajo')
    expect(resultado.recomendacion).toContain('no muestra factores de riesgo')
  })

  it('da riesgo medio con dos factores desfavorables', () => {
    const resultado = evaluarAutoevaluacion({
      ...RESPUESTAS_OK,
      pantallaAlturaOjos: false,
      sillaConSoporteLumbar: false,
    })
    expect(resultado.nivelRiesgo).toBe('medio')
    expect(resultado.recomendacion).toContain('Sube la pantalla')
    expect(resultado.recomendacion).toContain('respaldo de tu silla')
  })

  it('da riesgo alto con cuatro o más factores desfavorables', () => {
    const resultado = evaluarAutoevaluacion({
      pantallaAlturaOjos: false,
      sillaConSoporteLumbar: false,
      pausasActivas: false,
      piesApoyados: false,
      molestias: 'nunca',
    })
    expect(resultado.nivelRiesgo).toBe('alto')
  })

  it('pesa el doble las molestias frecuentes frente a las mismas respuestas sin molestias', () => {
    const conMolestiasFrecuentes = evaluarAutoevaluacion({ ...RESPUESTAS_OK, molestias: 'frecuentemente' })
    const conMolestiasAVeces = evaluarAutoevaluacion({ ...RESPUESTAS_OK, molestias: 'a_veces' })
    expect(conMolestiasFrecuentes.nivelRiesgo).toBe('medio')
    expect(conMolestiasAVeces.nivelRiesgo).toBe('bajo')
  })

  it('solo incluye tips de los factores realmente desfavorables', () => {
    const resultado = evaluarAutoevaluacion({ ...RESPUESTAS_OK, pausasActivas: false })
    expect(resultado.recomendacion).toContain('pausa activa')
    expect(resultado.recomendacion).not.toContain('Sube la pantalla')
    expect(resultado.recomendacion).not.toContain('respaldo de tu silla')
  })
})
