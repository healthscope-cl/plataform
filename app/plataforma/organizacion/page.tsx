import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapSucursalRow, mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { SucursalesTable } from '@/components/platform/SucursalesTable'

export default async function OrganizacionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase
    .from('usuarios')
    .select('*, roles(*)')
    .eq('id', user.id)
    .single()
  if (!usuarioRow) redirect('/login')

  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }

  const { data: sucursalRows } = await supabase
    .from('sucursales')
    .select('*')
    .eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map(mapSucursalRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Organización</h1>
      <SucursalesTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialSucursales={sucursales}
      />
    </div>
  )
}
