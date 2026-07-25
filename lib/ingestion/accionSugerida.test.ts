import { describe, expect, it } from 'vitest'
import { accionSugerida } from './accionSugerida'

describe('accionSugerida', () => {
  it('suggests accident investigation for accidente_laboral and accidente_trayecto', () => {
    expect(
      accionSugerida({ tipoAdministrativo: 'accidente_laboral', clasificacionAnalitica: 'accidente' })
    ).toEqual({
      accion: 'Investigar el accidente, evaluar el riesgo del puesto de trabajo y coordinar seguimiento médico.',
      responsable: 'Prevención de riesgos',
      limitaciones:
        'No reemplaza la investigación formal de accidentes exigida por ley; es un recordatorio operativo. ' +
        'Esta es una sugerencia basada en reglas fijas, no un diagnóstico — debe ser evaluada por un profesional antes de implementarse.',
    })
    expect(
      accionSugerida({ tipoAdministrativo: 'accidente_trayecto', clasificacionAnalitica: 'accidente' }).responsable
    ).toBe('Prevención de riesgos')
  })

  it('suggests occupational health evaluation for enfermedad_profesional', () => {
    const resultado = accionSugerida({
      tipoAdministrativo: 'enfermedad_profesional',
      clasificacionAnalitica: 'enfermedad_profesional',
    })
    expect(resultado.accion).toBe(
      'Evaluación de salud ocupacional y revisión de condiciones del puesto asociadas a la enfermedad profesional.'
    )
    expect(resultado.responsable).toBe('Salud ocupacional')
  })

  it('suggests reincorporation planning for maternal and patologia_embarazo', () => {
    expect(
      accionSugerida({ tipoAdministrativo: 'maternal', clasificacionAnalitica: 'maternal' }).accion
    ).toBe('Preparar plan de reincorporación y ajustes de puesto según corresponda al retorno.')
    expect(
      accionSugerida({ tipoAdministrativo: 'patologia_embarazo', clasificacionAnalitica: 'maternal' }).responsable
    ).toBe('RR.HH.')
  })

  it('suggests no extra follow-up for enfermedad_grave_hijo_menor beyond confirming coverage', () => {
    const resultado = accionSugerida({
      tipoAdministrativo: 'enfermedad_grave_hijo_menor',
      clasificacionAnalitica: 'cuidado_familiar',
    })
    expect(resultado.accion).toBe(
      'Confirmar cobertura y duración del permiso; sin acción de seguimiento adicional salvo solicitud del trabajador.'
    )
  })

  it('suggests ongoing follow-up for prorroga_medicina_preventiva', () => {
    const resultado = accionSugerida({
      tipoAdministrativo: 'prorroga_medicina_preventiva',
      clasificacionAnalitica: 'continuacion',
    })
    expect(resultado.accion).toBe('Dar seguimiento como episodio en curso — evaluar necesidad de apoyo adicional.')
    expect(resultado.responsable).toBe('Salud ocupacional')
  })

  it('splits sin_clasificar administrative types into distinct suggestions', () => {
    expect(
      accionSugerida({ tipoAdministrativo: 'permiso_administrativo', clasificacionAnalitica: 'sin_clasificar' }).accion
    ).toBe('Sin acción de seguimiento — permiso administrativo estándar.')
    expect(
      accionSugerida({ tipoAdministrativo: 'ausencia_injustificada', clasificacionAnalitica: 'sin_clasificar' }).accion
    ).toBe('Conversación con la jefatura directa para conocer la causa; evaluar si corresponde una acción de RR.HH.')
    expect(
      accionSugerida({ tipoAdministrativo: 'vacaciones', clasificacionAnalitica: 'sin_clasificar' }).accion
    ).toBe('Sin acción de seguimiento — vacaciones.')
    expect(
      accionSugerida({ tipoAdministrativo: 'otros', clasificacionAnalitica: 'sin_clasificar' }).accion
    ).toBe('Revisar el detalle del caso para determinar si requiere clasificación específica.')
  })

  it('escalates enfermedad_comun by duration and recurrence', () => {
    expect(
      accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'corto' }).accion
    ).toBe('Sin acción de seguimiento — episodio corto y aislado.')
    expect(
      accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'mediano' }).accion
    ).toBe('Sin acción especial; monitorear si se repite.')
    expect(
      accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'prolongado' }).accion
    ).toBe('Plan de retorno gradual con adaptaciones y seguimiento.')
    expect(
      accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'recurrente' }).accion
    ).toBe('Derivar a evaluación de salud ocupacional — 2 o más episodios en 12 meses.')
  })

  it('flags a recurrente episode with the organizational-cause caveat', () => {
    const resultado = accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'recurrente' })
    expect(resultado.limitaciones).toContain('causas organizacionales')
  })

  it('returns a no-action suggestion when data quality is insufficient, regardless of tipo', () => {
    const resultado = accionSugerida({
      tipoAdministrativo: 'enfermedad_comun',
      clasificacionAnalitica: 'calidad_insuficiente',
    })
    expect(resultado.accion).toBe('Sin acción — datos insuficientes para clasificar el episodio.')
    expect(resultado.responsable).toBe('—')
  })

  it('always ends limitaciones with the fixed human-review disclaimer', () => {
    const disclaimer =
      'Esta es una sugerencia basada en reglas fijas, no un diagnóstico — debe ser evaluada por un profesional antes de implementarse.'
    expect(
      accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'corto' }).limitaciones
    ).toContain(disclaimer)
    expect(
      accionSugerida({ tipoAdministrativo: 'vacaciones', clasificacionAnalitica: 'sin_clasificar' }).limitaciones
    ).toContain(disclaimer)
  })
})
