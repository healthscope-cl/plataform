export type TipoAdministrativoClave =
  | 'enfermedad_comun'
  | 'prorroga_medicina_preventiva'
  | 'maternal'
  | 'enfermedad_grave_hijo_menor'
  | 'accidente_laboral'
  | 'accidente_trayecto'
  | 'enfermedad_profesional'
  | 'patologia_embarazo'
  | 'permiso_administrativo'
  | 'ausencia_injustificada'
  | 'vacaciones'
  | 'otros'

export type TipoAdministrativo = {
  id: string
  clave: TipoAdministrativoClave
  nombre: string
}

export type Persona = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  codigo: string
  rutHash: string
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
  estado: 'activo' | 'inactivo'
}

export type Contrato = {
  id: string
  tenantId: string
  personaId: string
  createdAt: string
  fechaInicio: string
  fechaFin: string | null
  tipoContrato: 'indefinido' | 'plazo_fijo' | 'obra_o_faena'
  jornadaHorasSemanales: number
}

export function mapTipoAdministrativoRow(row: {
  id: string
  clave: string
  nombre: string
}): TipoAdministrativo {
  return {
    id: row.id,
    clave: row.clave as TipoAdministrativoClave,
    nombre: row.nombre,
  }
}

export function mapPersonaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  codigo: string
  rut_hash: string
  unidad_id: string | null
  cargo_id: string | null
  turno_id: string | null
  estado: 'activo' | 'inactivo'
}): Persona {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    codigo: row.codigo,
    rutHash: row.rut_hash,
    unidadId: row.unidad_id,
    cargoId: row.cargo_id,
    turnoId: row.turno_id,
    estado: row.estado,
  }
}

export function mapContratoRow(row: {
  id: string
  tenant_id: string
  persona_id: string
  created_at: string
  fecha_inicio: string
  fecha_fin: string | null
  tipo_contrato: 'indefinido' | 'plazo_fijo' | 'obra_o_faena'
  jornada_horas_semanales: number
}): Contrato {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    createdAt: row.created_at,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    tipoContrato: row.tipo_contrato,
    jornadaHorasSemanales: row.jornada_horas_semanales,
  }
}
