import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
import { mapCampanaRow } from '@/lib/campanas/types'
import { CampanasTable } from '@/components/platform/campanas/CampanasTable'

export default async function CampanasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('*, roles(*)').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')
  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id

  const { data: campanaRows } = await supabase
    .from('campanas')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const campanas = (campanaRows ?? []).map(mapCampanaRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Campañas</h1>
      <CampanasTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialCampanas={campanas}
      />
    </div>
  )
}
