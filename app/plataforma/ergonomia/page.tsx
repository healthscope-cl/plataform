import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
import { mapEvaluacionErgonomicaRow } from '@/lib/ergonomia/types'
import { EvaluacionesErgonomicasTable } from '@/components/platform/ergonomia/EvaluacionesErgonomicasTable'

export default async function ErgonomiaPage() {
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

  const { data: evaluacionRows } = await supabase
    .from('evaluaciones_ergonomicas')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const evaluaciones = (evaluacionRows ?? []).map(mapEvaluacionErgonomicaRow)

  const { data: cargoRows } = await supabase.from('cargos').select('id, nombre').eq('empresa_id', empresaId)
  const cargos = (cargoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: sucursalRows } = await supabase.from('sucursales').select('id, nombre').eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Ergonomía</h1>
      <EvaluacionesErgonomicasTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialEvaluaciones={evaluaciones}
        cargos={cargos}
        sucursales={sucursales}
      />
    </div>
  )
}
