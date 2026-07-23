export type TipoProfesional =
  | 'psicologo'
  | 'kinesiologo'
  | 'ergonomo'
  | 'terapeuta_ocupacional'
  | 'nutricionista'
  | 'medico_laboral'
  | 'prevencionista'
  | 'podologo'

export type Profesional = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  tipo: TipoProfesional
  nombre: string
  email: string | null
  telefono: string | null
  notas: string | null
  activo: boolean
}

export function mapProfesionalRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  tipo: string
  nombre: string
  email: string | null
  telefono: string | null
  notas: string | null
  activo: boolean
}): Profesional {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    tipo: row.tipo as TipoProfesional,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono,
    notas: row.notas,
    activo: row.activo,
  }
}
