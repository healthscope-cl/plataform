import { describe, expect, it } from 'vitest'
import { ADMIN_ROLE_KEYS, isAdminRole, ROLE_KEYS } from './roles'

describe('roles', () => {
  it('has exactly the 13 roles from the master doc', () => {
    expect(ROLE_KEYS).toHaveLength(13)
    expect(ROLE_KEYS).toContain('superadmin')
    expect(ROLE_KEYS).toContain('solo_lectura')
  })

  it('isAdminRole is true only for superadmin and admin_cliente', () => {
    expect(isAdminRole('superadmin')).toBe(true)
    expect(isAdminRole('admin_cliente')).toBe(true)
    expect(isAdminRole('rrhh_local')).toBe(false)
    expect(isAdminRole('solo_lectura')).toBe(false)
  })

  it('ADMIN_ROLE_KEYS is a subset of ROLE_KEYS', () => {
    for (const key of ADMIN_ROLE_KEYS) {
      expect(ROLE_KEYS).toContain(key)
    }
  })
})
