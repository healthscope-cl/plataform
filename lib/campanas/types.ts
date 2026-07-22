export type TipoCampana =
  | 'bienestar'
  | 'salud_mental'
  | 'ergonomia'
  | 'vacunacion'
  | 'pausas_activas'
  | 'prevencion'
  | 'sueno'
  | 'alimentacion'
  | 'liderazgo'

export type EstadoCampana = 'planificada' | 'activa' | 'finalizada'

export type Campana = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  tipo: TipoCampana
  nombre: string
  fechaInicio: string
  fechaFin: string | null
  responsable: string
  proveedor: string | null
  costo: number | null
  participantes: number | null
  resultado: string | null
  estado: EstadoCampana
}

export function mapCampanaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  tipo: string
  nombre: string
  fecha_inicio: string
  fecha_fin: string | null
  responsable: string
  proveedor: string | null
  costo: number | null
  participantes: number | null
  resultado: string | null
  estado: string
}): Campana {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    tipo: row.tipo as TipoCampana,
    nombre: row.nombre,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    responsable: row.responsable,
    proveedor: row.proveedor,
    costo: row.costo,
    participantes: row.participantes,
    resultado: row.resultado,
    estado: row.estado as EstadoCampana,
  }
}
