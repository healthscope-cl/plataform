export type NivelRiesgo = 'bajo' | 'medio' | 'alto'
export type EstadoEvaluacion = 'pendiente' | 'en_progreso' | 'resuelto'

export type EvaluacionErgonomica = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  cargoId: string
  sucursalId: string | null
  fecha: string
  nivelRiesgo: NivelRiesgo
  hallazgos: string
  recomendaciones: string | null
  estado: EstadoEvaluacion
}

export type AutoevaluacionErgonomica = {
  id: string
  tenantId: string
  empresaId: string
  personaId: string
  createdAt: string
  respuestas: Record<string, unknown>
  nivelRiesgo: NivelRiesgo
  recomendacion: string
  necesitaAyuda: boolean
}

export function mapAutoevaluacionErgonomicaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  persona_id: string
  created_at: string
  respuestas: Record<string, unknown>
  nivel_riesgo: string
  recomendacion: string
  necesita_ayuda: boolean
}): AutoevaluacionErgonomica {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    personaId: row.persona_id,
    createdAt: row.created_at,
    respuestas: row.respuestas,
    nivelRiesgo: row.nivel_riesgo as NivelRiesgo,
    recomendacion: row.recomendacion,
    necesitaAyuda: row.necesita_ayuda,
  }
}

export function mapEvaluacionErgonomicaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  cargo_id: string
  sucursal_id: string | null
  fecha: string
  nivel_riesgo: string
  hallazgos: string
  recomendaciones: string | null
  estado: string
}): EvaluacionErgonomica {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    cargoId: row.cargo_id,
    sucursalId: row.sucursal_id,
    fecha: row.fecha,
    nivelRiesgo: row.nivel_riesgo as NivelRiesgo,
    hallazgos: row.hallazgos,
    recomendaciones: row.recomendaciones,
    estado: row.estado as EstadoEvaluacion,
  }
}
