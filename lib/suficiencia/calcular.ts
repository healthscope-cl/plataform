// Placeholder thresholds — a reasonable starting point, not a validated business decision.
// Named and exported so they're easy to find and adjust without touching the logic below,
// same pattern as MIN_GROUP_SIZE in lib/indicators/formulas.ts.
export const UMBRAL_SOLIDO = { personasMin: 30, episodiosMin: 20, completitudMin: 0.7 }
export const UMBRAL_UTILIZABLE = { personasMin: 10, episodiosMin: 5 }
export const UMBRAL_LIMITADO = { personasMin: 5, episodiosMin: 1 }

export type EstadoSuficiencia = 'insuficiente' | 'limitado' | 'utilizable' | 'solido'

export type IndiceSuficiencia = {
  estado: EstadoSuficiencia
  razones: string[]
  recomendaciones: string[]
}

export function calcularIndiceSuficiencia(input: {
  personas: Array<{ id: string; unidadId: string | null; cargoId: string | null; turnoId: string | null }>
  cantidadEpisodios: number
  huboImportacionReciente: boolean
}): IndiceSuficiencia {
  const dotacion = input.personas.length
  const personasCompletas = input.personas.filter((p) => p.unidadId && p.cargoId && p.turnoId).length
  const completitud = dotacion > 0 ? personasCompletas / dotacion : 0

  let estado: EstadoSuficiencia
  if (
    dotacion >= UMBRAL_SOLIDO.personasMin &&
    input.cantidadEpisodios >= UMBRAL_SOLIDO.episodiosMin &&
    completitud >= UMBRAL_SOLIDO.completitudMin
  ) {
    estado = 'solido'
  } else if (dotacion >= UMBRAL_UTILIZABLE.personasMin && input.cantidadEpisodios >= UMBRAL_UTILIZABLE.episodiosMin) {
    estado = 'utilizable'
  } else if (dotacion >= UMBRAL_LIMITADO.personasMin || input.cantidadEpisodios >= UMBRAL_LIMITADO.episodiosMin) {
    estado = 'limitado'
  } else {
    estado = 'insuficiente'
  }

  if (estado === 'solido') {
    return { estado, razones: [], recomendaciones: [] }
  }

  const razones: string[] = []
  const recomendaciones: string[] = []

  if (dotacion < UMBRAL_SOLIDO.personasMin) {
    const plural = dotacion === 1 ? '' : 's'
    razones.push(`Solo ${dotacion} persona${plural} activa${plural} registrada${plural}.`)
    recomendaciones.push('Importa datos de más personas para ampliar la muestra.')
  }
  if (input.cantidadEpisodios < UMBRAL_SOLIDO.episodiosMin) {
    const plural = input.cantidadEpisodios === 1 ? '' : 's'
    razones.push(`Solo ${input.cantidadEpisodios} episodio${plural} registrado${plural} en el período.`)
  }
  if (completitud < UMBRAL_SOLIDO.completitudMin) {
    razones.push(`Solo ${Math.round(completitud * 100)}% de las personas tiene unidad, cargo y turno asignados.`)
    recomendaciones.push('Completa la asignación de unidad/cargo/turno al reimportar o editar personas.')
  }
  if (!input.huboImportacionReciente) {
    razones.push('No hay una importación completada que cubra el período actual.')
    recomendaciones.push('Sube una importación reciente para reflejar el período vigente.')
  }

  return { estado, razones, recomendaciones }
}
