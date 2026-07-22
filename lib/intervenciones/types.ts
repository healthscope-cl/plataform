export type EstadoIntervencion = 'planificada' | 'en_ejecucion' | 'completada'

export type Intervencion = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  problema: string
  objetivo: string
  responsable: string
  presupuesto: number | null
  fecha: string
  indicadores: string
  resultado: string | null
  estado: EstadoIntervencion
}

export function mapIntervencionRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  problema: string
  objetivo: string
  responsable: string
  presupuesto: number | null
  fecha: string
  indicadores: string
  resultado: string | null
  estado: string
}): Intervencion {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    problema: row.problema,
    objetivo: row.objetivo,
    responsable: row.responsable,
    presupuesto: row.presupuesto,
    fecha: row.fecha,
    indicadores: row.indicadores,
    resultado: row.resultado,
    estado: row.estado as EstadoIntervencion,
  }
}
