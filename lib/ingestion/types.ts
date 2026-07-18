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

export type Importacion = {
  id: string
  tenantId: string
  createdAt: string
  responsableId: string
  archivoNombre: string
  archivoHash: string
  estado: 'en_progreso' | 'completada' | 'revertida' | 'fallida'
  filasProcesadas: number
  filasRechazadas: number
  advertencias: number
}

export type ErrorCalidad = {
  id: string
  tenantId: string
  importacionId: string
  fila: number
  severidad: 'critico' | 'advertencia'
  tipo: string
  mensaje: string
}

export type ClasificacionAnalitica =
  | 'corto'
  | 'mediano'
  | 'prolongado'
  | 'recurrente'
  | 'continuacion'
  | 'accidente'
  | 'enfermedad_profesional'
  | 'maternal'
  | 'cuidado_familiar'
  | 'sin_clasificar'
  | 'calidad_insuficiente'

export type Episodio = {
  id: string
  tenantId: string
  personaId: string
  createdAt: string
  importacionId: string | null
  tipoAdministrativoId: string
  fechaInicio: string
  fechaFin: string | null
  dias: number
  clasificacionAnalitica: ClasificacionAnalitica
  estado: 'abierto' | 'cerrado'
}

export function mapImportacionRow(row: {
  id: string
  tenant_id: string
  created_at: string
  responsable_id: string
  archivo_nombre: string
  archivo_hash: string
  estado: 'en_progreso' | 'completada' | 'revertida' | 'fallida'
  filas_procesadas: number
  filas_rechazadas: number
  advertencias: number
}): Importacion {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    responsableId: row.responsable_id,
    archivoNombre: row.archivo_nombre,
    archivoHash: row.archivo_hash,
    estado: row.estado,
    filasProcesadas: row.filas_procesadas,
    filasRechazadas: row.filas_rechazadas,
    advertencias: row.advertencias,
  }
}

export function mapErrorCalidadRow(row: {
  id: string
  tenant_id: string
  importacion_id: string
  fila: number
  severidad: 'critico' | 'advertencia'
  tipo: string
  mensaje: string
}): ErrorCalidad {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    importacionId: row.importacion_id,
    fila: row.fila,
    severidad: row.severidad,
    tipo: row.tipo,
    mensaje: row.mensaje,
  }
}

export function mapEpisodioRow(row: {
  id: string
  tenant_id: string
  persona_id: string
  created_at: string
  importacion_id: string | null
  tipo_administrativo_id: string
  fecha_inicio: string
  fecha_fin: string | null
  dias: number
  clasificacion_analitica: ClasificacionAnalitica
  estado: 'abierto' | 'cerrado'
}): Episodio {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    createdAt: row.created_at,
    importacionId: row.importacion_id,
    tipoAdministrativoId: row.tipo_administrativo_id,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    dias: row.dias,
    clasificacionAnalitica: row.clasificacion_analitica,
    estado: row.estado,
  }
}
