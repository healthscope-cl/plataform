import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapRolRow } from '@/lib/platform/types'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
import { isAdminRole } from '@/lib/platform/roles'
import { mapPersonaRow, mapEpisodioRow } from '@/lib/ingestion/types'
import type { TipoAdministrativoClave } from '@/lib/ingestion/types'
import { computeIndicadoresPorPersona } from '@/lib/indicators/porPersona'
import { AusenciasTable, type EpisodioFila } from '@/components/platform/ausencias/AusenciasTable'
import { CopiarLinkAutoevaluacion } from '@/components/ergonomia/CopiarLinkAutoevaluacion'

const COSTO_PROMEDIO_DIARIO = 40000

export default async function PersonaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('*, roles(*)').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')
  const rol = mapRolRow(usuarioRow.roles)
  if (!isAdminRole(rol.clave)) {
    return <p className="text-muted-foreground">Esta página requiere permisos de administrador.</p>
  }

  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }

  const { data: personaRow } = await supabase
    .from('personas')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresa.id)
    .maybeSingle()
  if (!personaRow) notFound()
  const persona = mapPersonaRow(personaRow)

  const [{ data: unidadRow }, { data: cargoRow }, { data: turnoRow }] = await Promise.all([
    persona.unidadId ? supabase.from('unidades').select('nombre').eq('id', persona.unidadId).maybeSingle() : { data: null },
    persona.cargoId ? supabase.from('cargos').select('nombre').eq('id', persona.cargoId).maybeSingle() : { data: null },
    persona.turnoId ? supabase.from('turnos').select('nombre').eq('id', persona.turnoId).maybeSingle() : { data: null },
  ])

  const { data: tipoRows } = await supabase.from('tipos_administrativos').select('id, clave, nombre')
  const tipos = (tipoRows ?? []).map((row) => ({
    id: row.id as string,
    clave: row.clave as TipoAdministrativoClave,
    nombre: row.nombre as string,
  }))

  const { data: episodioRows } = await supabase
    .from('episodios')
    .select('*')
    .eq('persona_id', persona.id)
    .order('fecha_inicio', { ascending: false })
    .limit(200)
  const episodios = (episodioRows ?? []).map(mapEpisodioRow)

  const periodoFin = new Date().toISOString().slice(0, 10)
  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)
  const episodiosPeriodo = episodios.filter((e) => e.fechaInicio >= periodoInicio)

  const [indicador] = computeIndicadoresPorPersona({
    personas: [{ id: persona.id, codigo: persona.codigo }],
    episodios: episodiosPeriodo.map((e) => ({ personaId: e.personaId, dias: e.dias })),
    costoPromedioDiario: COSTO_PROMEDIO_DIARIO,
  })

  const episodiosFilas: EpisodioFila[] = episodios.map((episodio) => {
    const tipo = tipos.find((t) => t.id === episodio.tipoAdministrativoId)
    return {
      id: episodio.id,
      personaCodigo: persona.codigo,
      tipoAdministrativoNombre: tipo?.nombre ?? episodio.tipoAdministrativoId,
      tipoAdministrativoClave: tipo?.clave ?? 'otros',
      fechaInicio: episodio.fechaInicio,
      fechaFin: episodio.fechaFin,
      dias: episodio.dias,
      estado: episodio.estado,
      clasificacionAnalitica: episodio.clasificacionAnalitica,
      costoEstimadoPersona: indicador.costoEstimado,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{persona.codigo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {persona.estado === 'activo' ? 'Activo' : 'Inactivo'}
            {unidadRow ? ` — ${unidadRow.nombre as string}` : ''}
            {cargoRow ? ` — ${cargoRow.nombre as string}` : ''}
            {turnoRow ? ` — ${turnoRow.nombre as string}` : ''}
          </p>
          {persona.email || persona.telefono || persona.fechaIngreso ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                persona.email,
                persona.telefono,
                persona.fechaIngreso ? `Ingreso: ${persona.fechaIngreso}` : null,
              ]
                .filter(Boolean)
                .join(' — ')}
            </p>
          ) : null}
        </div>
        <CopiarLinkAutoevaluacion personaId={persona.id} />
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Últimos 6 meses ({periodoInicio} a {periodoFin}).</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Días perdidos</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{indicador.diasPerdidos}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Episodios</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{indicador.cantidadEpisodios}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Costo estimado</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
              ${indicador.costoEstimado.toLocaleString('es-CL')}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Episodios y plan sugerido</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Historial completo de {persona.codigo} (máximo 200). Cada episodio tiene su propio plan sugerido según su
          tipo y clasificación.
        </p>
        <div className="mt-2">
          {episodiosFilas.length > 0 ? (
            <AusenciasTable episodios={episodiosFilas} />
          ) : (
            <p className="text-sm text-muted-foreground">Esta persona no tiene episodios registrados.</p>
          )}
        </div>
      </div>
    </div>
  )
}
