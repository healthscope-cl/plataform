export type EstadoEncuesta = 'borrador' | 'activa' | 'cerrada'

export type Encuesta = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  titulo: string
  descripcion: string | null
  preguntaIds: string[]
  estado: EstadoEncuesta
  fechaApertura: string | null
  fechaCierre: string | null
}

export function mapEncuestaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  titulo: string
  descripcion: string | null
  pregunta_ids: string[]
  estado: string
  fecha_apertura: string | null
  fecha_cierre: string | null
}): Encuesta {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    titulo: row.titulo,
    descripcion: row.descripcion,
    preguntaIds: row.pregunta_ids,
    estado: row.estado as EstadoEncuesta,
    fechaApertura: row.fecha_apertura,
    fechaCierre: row.fecha_cierre,
  }
}

export type EncuestaRespuesta = {
  id: string
  encuestaId: string
  createdAt: string
  respuestas: Record<string, number>
}

export function mapEncuestaRespuestaRow(row: {
  id: string
  encuesta_id: string
  created_at: string
  respuestas: Record<string, number>
}): EncuestaRespuesta {
  return {
    id: row.id,
    encuestaId: row.encuesta_id,
    createdAt: row.created_at,
    respuestas: row.respuestas,
  }
}
