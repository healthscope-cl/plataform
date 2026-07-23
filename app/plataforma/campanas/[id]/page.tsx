import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapCampanaRow } from '@/lib/campanas/types'
import { mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
import { medirAntesDespues, type ResultadoMedicion } from '@/lib/campanas/medicion'

const TIPO_LABELS: Record<string, string> = {
  bienestar: 'Bienestar',
  salud_mental: 'Salud mental',
  ergonomia: 'Ergonomía',
  vacunacion: 'Vacunación',
  pausas_activas: 'Pausas activas',
  prevencion: 'Prevención',
  sueno: 'Sueño',
  alimentacion: 'Alimentación',
  liderazgo: 'Liderazgo',
}

const ESTADO_LABELS: Record<string, string> = {
  planificada: 'Planificada',
  activa: 'Activa',
  finalizada: 'Finalizada',
}

function renderResultadoMedicion(resultado: ResultadoMedicion | null): string {
  if (resultado === null) return 'La campaña todavía no tiene fecha de término'
  if ('sinDatos' in resultado) return 'Sin datos todavía'
  if ('suprimido' in resultado) return 'Grupo insuficiente para mostrar'
  return `${resultado.promedio.toFixed(1)} / 5 (${resultado.cantidad} respuestas)`
}

export default async function SeguimientoCampanaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const { data: campanaRow } = await supabase.from('campanas').select('*').eq('id', id).maybeSingle()
  if (!campanaRow) notFound()
  const campana = mapCampanaRow(campanaRow)

  let seguimientoEncuesta: { pregunta: string; antes: ResultadoMedicion; despues: ResultadoMedicion | null } | null =
    null

  if (campana.preguntaSeguimientoId) {
    const preguntaId = campana.preguntaSeguimientoId
    const { data: encuestaRows } = await supabase.from('encuestas').select('id').eq('empresa_id', campana.empresaId)
    const encuestaIds = (encuestaRows ?? []).map((row) => row.id as string)

    const admin = createAdminClient()
    const { data: respuestaRows } =
      encuestaIds.length > 0
        ? await admin.from('encuesta_respuestas').select('*').in('encuesta_id', encuestaIds)
        : { data: [] }
    const respuestas = (respuestaRows ?? []).map(mapEncuestaRespuestaRow)

    const valores = respuestas
      .filter((r) => typeof r.respuestas[preguntaId] === 'number')
      .map((r) => ({ valor: r.respuestas[preguntaId], fecha: r.createdAt }))

    const resultado = medirAntesDespues({ valores, fechaInicio: campana.fechaInicio, fechaFin: campana.fechaFin })
    const preguntaTexto = CATALOGO_PREGUNTAS.find((p) => p.id === preguntaId)?.texto ?? preguntaId

    seguimientoEncuesta = { pregunta: preguntaTexto, antes: resultado.antes, despues: resultado.despues }
  }

  const { data: eventoRows } = await supabase
    .from('eventos_seguridad')
    .select('*')
    .eq('empresa_id', campana.empresaId)
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)
  const eventosAntes = eventos.filter((e) => e.fecha < campana.fechaInicio).length
  const eventosDespues = campana.fechaFin
    ? eventos.filter((e) => e.fecha > campana.fechaFin!).length
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{campana.nombre}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {TIPO_LABELS[campana.tipo] ?? campana.tipo} — {ESTADO_LABELS[campana.estado] ?? campana.estado}
        </p>
        <p className="text-sm text-muted-foreground">
          {campana.fechaInicio} a {campana.fechaFin ?? 'sin fecha de término'} — Responsable: {campana.responsable}
        </p>
        {campana.participantes !== null ? (
          <p className="text-sm text-muted-foreground">Participantes: {campana.participantes}</p>
        ) : null}
        {campana.resultado ? <p className="mt-2 text-sm text-foreground">{campana.resultado}</p> : null}
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de encuesta</h2>
        {seguimientoEncuesta ? (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Antes — {seguimientoEncuesta.pregunta}</p>
              <p className="mt-1 text-foreground">{renderResultadoMedicion(seguimientoEncuesta.antes)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Después — {seguimientoEncuesta.pregunta}</p>
              <p className="mt-1 text-foreground">{renderResultadoMedicion(seguimientoEncuesta.despues)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Esta campaña no tiene una pregunta de seguimiento configurada.
          </p>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de seguridad</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos antes</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{eventosAntes}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos después</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
              {eventosDespues === null ? 'La campaña todavía no tiene fecha de término' : eventosDespues}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
