import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapImportacionRow, mapErrorCalidadRow } from '@/lib/ingestion/types'
import { CalidadDatosResumen } from '@/components/platform/calidad-datos/CalidadDatosResumen'

export default async function ReporteCalidadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const { data: importacionRows } = await supabase
    .from('importaciones')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  const importaciones = (importacionRows ?? []).map(mapImportacionRow)
  const importacionIds = importaciones.map((i) => i.id)

  const { data: errorRows } =
    importacionIds.length > 0
      ? await supabase.from('errores_calidad').select('*').in('importacion_id', importacionIds)
      : { data: [] }
  const errores = (errorRows ?? []).map(mapErrorCalidadRow)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Calidad</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de errores de calidad de las últimas {importaciones.length} importaciones.
        </p>
      </div>
      <CalidadDatosResumen errores={errores} />
    </div>
  )
}
