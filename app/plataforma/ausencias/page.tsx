import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow } from '@/lib/platform/types'
import { mapEpisodioRow } from '@/lib/ingestion/types'
import { AusenciasTable, type EpisodioFila } from '@/components/platform/ausencias/AusenciasTable'

export default async function AusenciasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)

  const { data: personaRows } = await supabase.from('personas').select('id, codigo').eq('empresa_id', empresa.id)
  const personas = (personaRows ?? []).map((row) => ({ id: row.id as string, codigo: row.codigo as string }))
  const personaIds = personas.map((p) => p.id)

  const { data: tipoRows } = await supabase.from('tipos_administrativos').select('id, nombre')
  const tipos = (tipoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: episodioRows } =
    personaIds.length > 0
      ? await supabase
          .from('episodios')
          .select('*')
          .in('persona_id', personaIds)
          .order('fecha_inicio', { ascending: false })
          .limit(200)
      : { data: [] }
  const episodios = (episodioRows ?? []).map(mapEpisodioRow)

  const episodiosFilas: EpisodioFila[] = episodios.map((episodio) => ({
    id: episodio.id,
    personaCodigo: personas.find((p) => p.id === episodio.personaId)?.codigo ?? episodio.personaId,
    tipoAdministrativoNombre:
      tipos.find((t) => t.id === episodio.tipoAdministrativoId)?.nombre ?? episodio.tipoAdministrativoId,
    fechaInicio: episodio.fechaInicio,
    fechaFin: episodio.fechaFin,
    dias: episodio.dias,
    estado: episodio.estado,
    clasificacionAnalitica: episodio.clasificacionAnalitica,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Ausencias y licencias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registros más recientes de {empresa.nombre} (máximo 200).
        </p>
      </div>
      <AusenciasTable episodios={episodiosFilas} />
    </div>
  )
}
