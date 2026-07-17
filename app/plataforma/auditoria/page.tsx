import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapAuditoriaRow, mapUsuarioRow } from '@/lib/platform/types'
import { AuditoriaTable } from '@/components/platform/AuditoriaTable'

export default async function AuditoriaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [registrosRes, usuariosRes] = await Promise.all([
    supabase.from('auditoria').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('usuarios').select('*'),
  ])

  if (registrosRes.error) {
    return (
      <p className="text-muted-foreground">
        No tienes permiso para ver el registro de auditoría completo.
      </p>
    )
  }

  const registros = (registrosRes.data ?? []).map(mapAuditoriaRow)
  const usuarios = (usuariosRes.data ?? []).map(mapUsuarioRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Auditoría</h1>
      <AuditoriaTable registros={registros} usuarios={usuarios} />
    </div>
  )
}
