import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapImportacionRow } from '@/lib/ingestion/types'
import { ImportHistoryTable } from '@/components/platform/import/ImportHistoryTable'

export default async function HistorialImportacionesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await supabase.from('importaciones').select('*').order('created_at', { ascending: false })
  const importaciones = (rows ?? []).map(mapImportacionRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Historial de importaciones</h1>
      <ImportHistoryTable initialImportaciones={importaciones} />
    </div>
  )
}
