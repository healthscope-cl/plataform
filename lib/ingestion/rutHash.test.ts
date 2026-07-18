import { describe, expect, it } from 'vitest'
import { hashRut, normalizeRut } from './rutHash'

describe('normalizeRut', () => {
  it('strips dots and dashes and uppercases the check digit', () => {
    expect(normalizeRut('12.345.678-9')).toBe('123456789')
    expect(normalizeRut('12345678-k')).toBe('12345678K')
  })
})

describe('hashRut', () => {
  it('produces the same hash for equivalent RUT formats', async () => {
    const a = await hashRut('12.345.678-9')
    const b = await hashRut('12345678-9')
    expect(a).toBe(b)
  })

  it('produces different hashes for different RUTs', async () => {
    const a = await hashRut('12.345.678-9')
    const b = await hashRut('11.111.111-1')
    expect(a).not.toBe(b)
  })

  it('produces a 64-character hex digest', async () => {
    const hash = await hashRut('12.345.678-9')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
