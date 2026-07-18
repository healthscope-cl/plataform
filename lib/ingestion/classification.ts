import type { ClasificacionAnalitica, TipoAdministrativoClave } from './types'

export type ClasificacionInput = {
  tipoAdministrativo: TipoAdministrativoClave
  dias: number
  episodiosPrevios12Meses: number
}

const CORTO_MAX_DIAS = 3
const MEDIANO_MAX_DIAS = 30

// Fixed-threshold rule table, not a trained model — see Global Constraints. Order matters:
// administrative type overrides (accident/professional-illness/maternal/family-care/
// continuation/non-clinical) are checked before the duration-and-recurrence rules, since
// those types carry their own clinical meaning regardless of how long the episode lasted.
export function clasificarEpisodio(input: ClasificacionInput): ClasificacionAnalitica {
  if (!Number.isFinite(input.dias) || input.dias <= 0) {
    return 'calidad_insuficiente'
  }

  switch (input.tipoAdministrativo) {
    case 'accidente_laboral':
    case 'accidente_trayecto':
      return 'accidente'
    case 'enfermedad_profesional':
      return 'enfermedad_profesional'
    case 'maternal':
    case 'patologia_embarazo':
      return 'maternal'
    case 'enfermedad_grave_hijo_menor':
      return 'cuidado_familiar'
    case 'prorroga_medicina_preventiva':
      return 'continuacion'
    case 'permiso_administrativo':
    case 'ausencia_injustificada':
    case 'vacaciones':
    case 'otros':
      return 'sin_clasificar'
    case 'enfermedad_comun':
      break
  }

  if (input.episodiosPrevios12Meses >= 2) {
    return 'recurrente'
  }
  if (input.dias <= CORTO_MAX_DIAS) {
    return 'corto'
  }
  if (input.dias <= MEDIANO_MAX_DIAS) {
    return 'mediano'
  }
  return 'prolongado'
}
