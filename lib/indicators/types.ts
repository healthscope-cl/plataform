export type LineaBase = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  periodoInicio: string
  periodoFin: string
  indicadores: unknown
}

export function mapLineaBaseRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  periodo_inicio: string
  periodo_fin: string
  indicadores: unknown
}): LineaBase {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    periodoInicio: row.periodo_inicio,
    periodoFin: row.periodo_fin,
    indicadores: row.indicadores,
  }
}
