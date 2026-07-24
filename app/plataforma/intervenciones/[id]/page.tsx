import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapIntervencionRow } from '@/lib/intervenciones/types'
import { mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
import { medirAntesDespues, type ResultadoMedicion } from '@/lib/campanas/medicion'

const ESTADO_LABELS: Record<string, string> = {
  planificada: 'Planificada',
  en_ejecucion: 'En ejecución',
  completada: 'Completada',
}

// `despues` is typed `ResultadoMedicion | null` by medirAntesDespues's declared return type,
// but for this page it can never actually be null at runtime: intervencion.fecha is always a
// real date (never null), so the fechaFin argument is never null either. This branch exists
// only to satisfy TypeScript, not because it can execute here.
function renderResultadoMedicion(resultado: ResultadoMedicion | null): string {
  if (resultado === null) return 'No aplica'
  if ('sinDatos' in resultado) return 'Sin datos todavía'
  if ('suprimido' in resultado) return 'Grupo insuficiente para mostrar'
  return `${resultado.promedio.toFixed(1)} / 5 (${resultado.cantidad} respuestas)`
}

export default async function SeguimientoIntervencionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const { data: intervencionRow } = await supabase.from('intervenciones').select('*').eq('id', id).maybeSingle()
  if (!intervencionRow) notFound()
  const intervencion = mapIntervencionRow(intervencionRow)

  let seguimientoEncuesta: { pregunta: string; antes: ResultadoMedicion; despues: ResultadoMedicion | null } | null =
    null

  if (intervencion.preguntaSeguimientoId) {
    const preguntaId = intervencion.preguntaSeguimientoId
    const { data: encuestaRows } = await supabase
      .from('encuestas')
      .select('id')
      .eq('empresa_id', intervencion.empresaId)
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

    const resultado = medirAntesDespues({ valores, fechaInicio: intervencion.fecha, fechaFin: intervencion.fecha })
    const preguntaTexto = CATALOGO_PREGUNTAS.find((p) => p.id === preguntaId)?.texto ?? preguntaId

    seguimientoEncuesta = { pregunta: preguntaTexto, antes: resultado.antes, despues: resultado.despues }
  }

  const { data: eventoRows } = await supabase
    .from('eventos_seguridad')
    .select('*')
    .eq('empresa_id', intervencion.empresaId)
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)
  const eventosAntes = eventos.filter((e) => e.fecha < intervencion.fecha).length
  const eventosDespues = eventos.filter((e) => e.fecha > intervencion.fecha).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{intervencion.problema}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ESTADO_LABELS[intervencion.estado] ?? intervencion.estado} — Fecha: {intervencion.fecha} — Responsable:{' '}
          {intervencion.responsable}
        </p>
        <p className="mt-2 text-sm text-foreground">Objetivo: {intervencion.objetivo}</p>
        <p className="text-sm text-foreground">Indicadores a medir: {intervencion.indicadores}</p>
        {intervencion.presupuesto !== null ? (
          <p className="text-sm text-muted-foreground">
            Presupuesto: ${intervencion.presupuesto.toLocaleString('es-CL')}
          </p>
        ) : null}
        {intervencion.resultado ? <p className="mt-2 text-sm text-foreground">{intervencion.resultado}</p> : null}
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
            Esta intervención no tiene una pregunta de seguimiento configurada.
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
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{eventosDespues}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
