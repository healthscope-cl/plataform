import type { ClasificacionAnalitica, TipoAdministrativoClave } from './types'

export type AccionSugerida = {
  accion: string
  responsable: string
  limitaciones: string
}

export type AccionSugeridaInput = {
  tipoAdministrativo: TipoAdministrativoClave
  clasificacionAnalitica: ClasificacionAnalitica
}

const REVISION_HUMANA =
  'Esta es una sugerencia basada en reglas fijas, no un diagnóstico — debe ser evaluada por un profesional antes de implementarse.'

// Fixed-rule lookup, not a trained model — same principle as clasificarEpisodio(). Keyed on
// tipoAdministrativo (not clasificacionAnalitica alone) because clasificarEpisodio() collapses
// permiso_administrativo/ausencia_injustificada/vacaciones/otros into a single 'sin_clasificar'
// value, and those four need distinct suggestions.
export function accionSugerida(input: AccionSugeridaInput): AccionSugerida {
  if (input.clasificacionAnalitica === 'calidad_insuficiente') {
    return {
      accion: 'Sin acción — datos insuficientes para clasificar el episodio.',
      responsable: '—',
      limitaciones: REVISION_HUMANA,
    }
  }

  switch (input.tipoAdministrativo) {
    case 'accidente_laboral':
    case 'accidente_trayecto':
      return {
        accion: 'Investigar el accidente, evaluar el riesgo del puesto de trabajo y coordinar seguimiento médico.',
        responsable: 'Prevención de riesgos',
        limitaciones:
          'No reemplaza la investigación formal de accidentes exigida por ley; es un recordatorio operativo. ' +
          REVISION_HUMANA,
      }
    case 'enfermedad_profesional':
      return {
        accion:
          'Evaluación de salud ocupacional y revisión de condiciones del puesto asociadas a la enfermedad profesional.',
        responsable: 'Salud ocupacional',
        limitaciones:
          'Requiere la calificación formal del organismo administrador (mutualidad); esto es solo un recordatorio de seguimiento. ' +
          REVISION_HUMANA,
      }
    case 'maternal':
    case 'patologia_embarazo':
      return {
        accion: 'Preparar plan de reincorporación y ajustes de puesto según corresponda al retorno.',
        responsable: 'RR.HH.',
        limitaciones: 'Los ajustes deben basarse en la indicación médica autorizada, no en suposiciones. ' + REVISION_HUMANA,
      }
    case 'enfermedad_grave_hijo_menor':
      return {
        accion:
          'Confirmar cobertura y duración del permiso; sin acción de seguimiento adicional salvo solicitud del trabajador.',
        responsable: 'RR.HH.',
        limitaciones: 'Es un permiso legal, no requiere intervención salvo que la persona la solicite. ' + REVISION_HUMANA,
      }
    case 'prorroga_medicina_preventiva':
      return {
        accion: 'Dar seguimiento como episodio en curso — evaluar necesidad de apoyo adicional.',
        responsable: 'Salud ocupacional',
        limitaciones: REVISION_HUMANA,
      }
    case 'permiso_administrativo':
      return {
        accion: 'Sin acción de seguimiento — permiso administrativo estándar.',
        responsable: '—',
        limitaciones: REVISION_HUMANA,
      }
    case 'ausencia_injustificada':
      return {
        accion: 'Conversación con la jefatura directa para conocer la causa; evaluar si corresponde una acción de RR.HH.',
        responsable: 'RR.HH.',
        limitaciones: 'No implica automáticamente una falta — debe evaluarse caso a caso. ' + REVISION_HUMANA,
      }
    case 'vacaciones':
      return {
        accion: 'Sin acción de seguimiento — vacaciones.',
        responsable: '—',
        limitaciones: REVISION_HUMANA,
      }
    case 'otros':
      return {
        accion: 'Revisar el detalle del caso para determinar si requiere clasificación específica.',
        responsable: 'RR.HH.',
        limitaciones: REVISION_HUMANA,
      }
    case 'enfermedad_comun':
      return accionEnfermedadComun(input.clasificacionAnalitica)
  }
}

function accionEnfermedadComun(clasificacion: ClasificacionAnalitica): AccionSugerida {
  if (clasificacion === 'recurrente') {
    return {
      accion: 'Derivar a evaluación de salud ocupacional — 2 o más episodios en 12 meses.',
      responsable: 'Salud ocupacional',
      limitaciones:
        'Un aumento de licencias puede reflejar causas organizacionales, no solo individuales — revisar contexto (carga, turno, área) antes de concluir. ' +
        REVISION_HUMANA,
    }
  }
  if (clasificacion === 'prolongado') {
    return {
      accion: 'Plan de retorno gradual con adaptaciones y seguimiento.',
      responsable: 'Salud ocupacional / RR.HH.',
      limitaciones: 'Los ajustes deben basarse en la indicación médica autorizada. ' + REVISION_HUMANA,
    }
  }
  if (clasificacion === 'mediano') {
    return {
      accion: 'Sin acción especial; monitorear si se repite.',
      responsable: '—',
      limitaciones: REVISION_HUMANA,
    }
  }
  return {
    accion: 'Sin acción de seguimiento — episodio corto y aislado.',
    responsable: '—',
    limitaciones: REVISION_HUMANA,
  }
}
