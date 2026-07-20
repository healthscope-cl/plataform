export type Indicador =
  | 'tasaAusentismo'
  | 'frecuencia'
  | 'severidad'
  | 'duracionPromedio'
  | 'reincidencia'
  | 'costoEstimado'

export type Operador = 'mayor_que' | 'mayor_o_igual'

export type ReglaAlerta = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  nombre: string
  indicador: Indicador
  operador: Operador
  umbral: number
  sucursalId: string | null
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
  activa: boolean
}

export function mapReglaAlertaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  nombre: string
  indicador: string
  operador: string
  umbral: number
  sucursal_id: string | null
  unidad_id: string | null
  cargo_id: string | null
  turno_id: string | null
  activa: boolean
}): ReglaAlerta {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    nombre: row.nombre,
    indicador: row.indicador as Indicador,
    operador: row.operador as Operador,
    umbral: row.umbral,
    sucursalId: row.sucursal_id,
    unidadId: row.unidad_id,
    cargoId: row.cargo_id,
    turnoId: row.turno_id,
    activa: row.activa,
  }
}
