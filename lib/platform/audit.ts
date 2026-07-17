import type { SupabaseClient } from '@supabase/supabase-js'

type LogAuditParams = {
  tenantId: string
  actorId: string
  entidad: string
  entidadId: string
  accion: 'crear' | 'actualizar' | 'eliminar'
  datosAntes: unknown
  datosDespues: unknown
}

export async function logAudit(
  supabase: SupabaseClient,
  params: LogAuditParams
): Promise<void> {
  const { error } = await supabase.from('auditoria').insert({
    tenant_id: params.tenantId,
    actor_id: params.actorId,
    entidad: params.entidad,
    entidad_id: params.entidadId,
    accion: params.accion,
    datos_antes: params.datosAntes,
    datos_despues: params.datosDespues,
  })

  if (error) {
    throw new Error(error.message)
  }
}
