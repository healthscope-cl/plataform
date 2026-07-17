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

export const ADMIN_ROLE_KEYS: readonly RoleKey[] = ['superadmin', 'admin_cliente']

export function isAdminRole(clave: string): boolean {
  return (ADMIN_ROLE_KEYS as readonly string[]).includes(clave)
}
