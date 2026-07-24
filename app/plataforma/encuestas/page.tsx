import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
import { mapEncuestaRow } from '@/lib/encuestas/types'
import { EncuestasTable } from '@/components/platform/encuestas/EncuestasTable'

export default async function EncuestasPage() {
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

  const { data: encuestaRows } = await supabase
    .from('encuestas')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const encuestas = (encuestaRows ?? []).map(mapEncuestaRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Encuestas</h1>
      <EncuestasTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialEncuestas={encuestas}
      />
    </div>
  )
}
