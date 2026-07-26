import type { SupabaseClient } from '@supabase/supabase-js'

// `importaciones` has no empresa_id column — only tenant_id. An import only implies an
// empresa indirectly, through the episodios it created for personas that belong to that
// empresa. This derives the set of importación ids attributable to `empresaId`. Imports that
// touched personas without producing any episodio (e.g. every row was rejected) can't be
// attributed this way and are excluded — safer to under-show here than to ever attribute an
// import to the wrong empresa once a tenant has more than one.
export async function importacionIdsPorEmpresa(supabase: SupabaseClient, empresaId: string): Promise<Set<string>> {
  const { data: personaRows } = await supabase.from('personas').select('id').eq('empresa_id', empresaId)
  const personaIds = (personaRows ?? []).map((row) => row.id as string)
  if (personaIds.length === 0) return new Set()

  const { data: episodioRows } = await supabase
    .from('episodios')
    .select('importacion_id')
    .in('persona_id', personaIds)
    .not('importacion_id', 'is', null)

  return new Set((episodioRows ?? []).map((row) => row.importacion_id as string))
}
