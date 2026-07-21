export type TipoEventoSeguridad = 'accidente' | 'incidente' | 'cuasi_accidente' | 'condicion_insegura'
export type GravedadEvento = 'leve' | 'moderada' | 'grave'
export type EstadoEvento = 'abierto' | 'en_seguimiento' | 'cerrado'

export type EventoSeguridad = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string | null
  tipo: TipoEventoSeguridad
  descripcion: string
  gravedad: GravedadEvento
  fecha: string
  sucursalId: string | null
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
  estado: EstadoEvento
  accionCorrectiva: string | null
}

export function mapEventoSeguridadRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string | null
  tipo: string
  descripcion: string
  gravedad: string
  fecha: string
  sucursal_id: string | null
  unidad_id: string | null
  cargo_id: string | null
  turno_id: string | null
  estado: string
  accion_correctiva: string | null
}): EventoSeguridad {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    tipo: row.tipo as TipoEventoSeguridad,
    descripcion: row.descripcion,
    gravedad: row.gravedad as GravedadEvento,
    fecha: row.fecha,
    sucursalId: row.sucursal_id,
    unidadId: row.unidad_id,
    cargoId: row.cargo_id,
    turnoId: row.turno_id,
    estado: row.estado as EstadoEvento,
    accionCorrectiva: row.accion_correctiva,
  }
}
