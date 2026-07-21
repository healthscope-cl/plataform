import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { EventosSeguridadTable } from '@/components/platform/seguridad/EventosSeguridadTable'

export default async function SeguridadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('*, roles(*)').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')
  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }

  const { data: eventoRows } = await supabase
    .from('eventos_seguridad')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)

  const { data: sucursalRows } = await supabase.from('sucursales').select('id, nombre').eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))
  const sucursalIds = sucursales.map((s) => s.id)

  const { data: unidadRows } =
    sucursalIds.length > 0
      ? await supabase.from('unidades').select('id, nombre, sucursal_id').in('sucursal_id', sucursalIds)
      : { data: [] as { id: string; nombre: string; sucursal_id: string }[] }
  const unidades = (unidadRows ?? []).map((row) => ({
    id: row.id as string,
    nombre: row.nombre as string,
    sucursalId: row.sucursal_id as string,
  }))

  const { data: cargoRows } = await supabase.from('cargos').select('id, nombre').eq('empresa_id', empresaId)
  const cargos = (cargoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: turnoRows } = await supabase.from('turnos').select('id, nombre').eq('empresa_id', empresaId)
  const turnos = (turnoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Seguridad laboral</h1>
      <EventosSeguridadTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialEventos={eventos}
        sucursales={sucursales}
        unidades={unidades}
        cargos={cargos}
        turnos={turnos}
      />
    </div>
  )
}
