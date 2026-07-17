import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { UsuariosTable } from '@/components/platform/UsuariosTable'

export default async function UsuariosPage() {
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

  const [usuariosRes, rolesRes] = await Promise.all([
    supabase.from('usuarios').select('*'),
    supabase.from('roles').select('*'),
  ])

  const usuarios = (usuariosRes.data ?? []).map(mapUsuarioRow)
  const roles = (rolesRes.data ?? []).map(mapRolRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Usuarios y permisos</h1>
      <UsuariosTable
        tenantId={usuario.tenantId}
        actorId={usuario.id}
        initialUsuarios={usuarios}
        roles={roles}
      />
    </div>
  )
}
