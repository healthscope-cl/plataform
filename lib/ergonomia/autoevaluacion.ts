import type { NivelRiesgo } from './types'

export type RespuestasAutoevaluacion = {
  pantallaAlturaOjos: boolean
  sillaConSoporteLumbar: boolean
  pausasActivas: boolean
  piesApoyados: boolean
  molestias: 'nunca' | 'a_veces' | 'frecuentemente'
}

export type ResultadoAutoevaluacion = {
  nivelRiesgo: NivelRiesgo
  recomendacion: string
}

const TIP_POR_FACTOR: Record<string, string> = {
  pantallaAlturaOjos: 'Sube la pantalla hasta que el borde superior quede a la altura de tus ojos.',
  sillaConSoporteLumbar: 'Ajusta el respaldo de tu silla para que apoye la zona lumbar, o agrega un cojín de apoyo.',
  pausasActivas: 'Programa una pausa activa de 2 a 3 minutos cada 1 a 2 horas de trabajo continuo.',
  piesApoyados: 'Ajusta la altura de la silla o usa un reposapiés para que tus pies apoyen completos en el suelo.',
  molestias: 'Registra en qué momento del día aparecen las molestias para identificar el factor que las provoca.',
}

// Fixed-rule scoring, not a trained model — same principle as accionSugerida() and
// clasificarEpisodio(). Each factor is independently checked so the recommendation can name
// the specific things to fix, not just a generic risk level.
export function evaluarAutoevaluacion(respuestas: RespuestasAutoevaluacion): ResultadoAutoevaluacion {
  const factoresEnRiesgo: string[] = []
  if (!respuestas.pantallaAlturaOjos) factoresEnRiesgo.push('pantallaAlturaOjos')
  if (!respuestas.sillaConSoporteLumbar) factoresEnRiesgo.push('sillaConSoporteLumbar')
  if (!respuestas.pausasActivas) factoresEnRiesgo.push('pausasActivas')
  if (!respuestas.piesApoyados) factoresEnRiesgo.push('piesApoyados')
  if (respuestas.molestias !== 'nunca') factoresEnRiesgo.push('molestias')

  // "molestias: frecuentemente" always counts double — reported discomfort is a stronger
  // signal than an unfavorable workstation setup on its own.
  const puntaje = factoresEnRiesgo.length + (respuestas.molestias === 'frecuentemente' ? 1 : 0)

  let nivelRiesgo: NivelRiesgo
  if (puntaje >= 4) nivelRiesgo = 'alto'
  else if (puntaje >= 2) nivelRiesgo = 'medio'
  else nivelRiesgo = 'bajo'

  if (factoresEnRiesgo.length === 0) {
    return {
      nivelRiesgo,
      recomendacion: 'Tu puesto de trabajo no muestra factores de riesgo con las respuestas entregadas. Mantén tus hábitos actuales.',
    }
  }

  const tips = factoresEnRiesgo.map((factor) => TIP_POR_FACTOR[factor])
  return { nivelRiesgo, recomendacion: tips.join(' ') }
}
