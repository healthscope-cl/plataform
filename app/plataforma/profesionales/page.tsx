import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapProfesionalRow } from '@/lib/profesionales/types'
import { ProfesionalesTable } from '@/components/platform/profesionales/ProfesionalesTable'

export default async function ProfesionalesPage() {
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

  const { data: profesionalRows } = await supabase
    .from('profesionales')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nombre', { ascending: true })
  const profesionales = (profesionalRows ?? []).map(mapProfesionalRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Profesionales</h1>
      <ProfesionalesTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialProfesionales={profesionales}
      />
    </div>
  )
}
