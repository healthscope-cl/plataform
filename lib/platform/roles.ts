export const ROLE_KEYS = [
  'superadmin',
  'admin_cliente',
  'rrhh_corporativo',
  'rrhh_local',
  'gerencia',
  'jefatura',
  'prevencion',
  'salud_ocupacional',
  'prestador',
  'profesional',
  'auditor',
  'trabajador',
  'solo_lectura',
] as const

export type RoleKey = (typeof ROLE_KEYS)[number]

export const ROLE_LABELS: Record<RoleKey, string> = {
  superadmin: 'Superadministrador',
  admin_cliente: 'Administrador',
  rrhh_corporativo: 'RR.HH. corporativo',
  rrhh_local: 'RR.HH. local',
  gerencia: 'Gerencia',
  jefatura: 'Jefatura',
  prevencion: 'Prevención',
  salud_ocupacional: 'Salud ocupacional',
  prestador: 'Prestador',
  profesional: 'Profesional',
  auditor: 'Auditor',
  trabajador: 'Trabajador',
  solo_lectura: 'Solo lectura',
}

export const ADMIN_ROLE_KEYS: readonly RoleKey[] = ['superadmin', 'admin_cliente']

export function isAdminRole(clave: string): boolean {
  return (ADMIN_ROLE_KEYS as readonly string[]).includes(clave)
}
