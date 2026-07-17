import { describe, expect, it, vi } from 'vitest'
import { logAudit } from './audit'

describe('logAudit', () => {
  it('inserts one row into auditoria with the exact given fields', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ insert })
    const supabase = { from } as unknown as Parameters<typeof logAudit>[0]

    await logAudit(supabase, {
      tenantId: 'tenant-1',
      actorId: 'user-1',
      entidad: 'sucursales',
      entidadId: 'suc-1',
      accion: 'crear',
      datosAntes: null,
      datosDespues: { nombre: 'Sucursal Centro' },
    })

    expect(from).toHaveBeenCalledWith('auditoria')
    expect(insert).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      actor_id: 'user-1',
      entidad: 'sucursales',
      entidad_id: 'suc-1',
      accion: 'crear',
      datos_antes: null,
      datos_despues: { nombre: 'Sucursal Centro' },
    })
  })

  it('throws if the insert fails, so callers know the audit trail is incomplete', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    const from = vi.fn().mockReturnValue({ insert })
    const supabase = { from } as unknown as Parameters<typeof logAudit>[0]

    await expect(
      logAudit(supabase, {
        tenantId: 'tenant-1',
        actorId: 'user-1',
        entidad: 'sucursales',
        entidadId: 'suc-1',
        accion: 'eliminar',
        datosAntes: { nombre: 'Sucursal Centro' },
        datosDespues: null,
      })
    ).rejects.toThrow('boom')
  })
})
