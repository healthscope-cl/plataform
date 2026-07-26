import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
import { importacionIdsPorEmpresa } from '@/lib/ingestion/empresaScope'
import { mapImportacionRow } from '@/lib/ingestion/types'
import { ImportHistoryTable } from '@/components/platform/import/ImportHistoryTable'

export default async function HistorialImportacionesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresa = await getEmpresaActiva(supabase)
  // importaciones has no empresa_id column (only tenant_id) — scope by empresa activa via the
  // episodios join instead of showing the raw tenant-wide RLS set (see empresaScope.ts).
  const importacionIdsPermitidas = empresa ? await importacionIdsPorEmpresa(supabase, empresa.id) : new Set<string>()

  const { data: rows } = await supabase.from('importaciones').select('*').order('created_at', { ascending: false })
  const importaciones = (rows ?? [])
    .map(mapImportacionRow)
    .filter((importacion) => importacionIdsPermitidas.has(importacion.id))

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Historial de importaciones</h1>
      <ImportHistoryTable initialImportaciones={importaciones} />
    </div>
  )
}
