export type Tenant = {
  id: string
  createdAt: string
  nombre: string
  estado: 'activo' | 'suspendido'
}

export type Empresa = {
  id: string
  tenantId: string
  createdAt: string
  nombre: string
  rut: string | null
}

export type Sucursal = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  nombre: string
  ciudad: string | null
}

export type Unidad = {
  id: string
  tenantId: string
  sucursalId: string
  createdAt: string
  nombre: string
}

export type CentroCosto = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  codigo: string
  nombre: string
}

export type Cargo = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  nombre: string
}

export type Turno = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  nombre: string
  horaInicio: string | null
  horaFin: string | null
}

export function mapSucursalRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  nombre: string
  ciudad: string | null
}): Sucursal {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    nombre: row.nombre,
    ciudad: row.ciudad,
  }
}

export function mapUnidadRow(row: {
  id: string
  tenant_id: string
  sucursal_id: string
  created_at: string
  nombre: string
}): Unidad {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sucursalId: row.sucursal_id,
    createdAt: row.created_at,
    nombre: row.nombre,
  }
}

export function mapCentroCostoRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  codigo: string
  nombre: string
}): CentroCosto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    codigo: row.codigo,
    nombre: row.nombre,
  }
}

export function mapCargoRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  nombre: string
}): Cargo {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    nombre: row.nombre,
  }
}

export function mapTurnoRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  nombre: string
  hora_inicio: string | null
  hora_fin: string | null
}): Turno {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    nombre: row.nombre,
    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin,
  }
}
