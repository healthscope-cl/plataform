import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow } from '@/lib/platform/types'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { mapEvaluacionErgonomicaRow } from '@/lib/ergonomia/types'
import { mapCampanaRow, type Campana } from '@/lib/campanas/types'

const CAMPANA_TIPO_LABELS: Record<Campana['tipo'], string> = {
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

const TIPOS_PREVENCION: ReadonlyArray<Campana['tipo']> = ['ergonomia', 'pausas_activas', 'prevencion']

export default async function ReportePrevencionPage() {
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

  const { data: eventoRows } = await supabase.from('eventos_seguridad').select('*').eq('empresa_id', empresa.id)
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)
  const eventosPorTipo = { accidente: 0, incidente: 0, cuasi_accidente: 0, condicion_insegura: 0 }
  const eventosPorGravedad = { leve: 0, moderada: 0, grave: 0 }
  for (const evento of eventos) {
    eventosPorTipo[evento.tipo] += 1
    eventosPorGravedad[evento.gravedad] += 1
  }

  const { data: evaluacionRows } = await supabase
    .from('evaluaciones_ergonomicas')
    .select('*')
    .eq('empresa_id', empresa.id)
  const evaluaciones = (evaluacionRows ?? []).map(mapEvaluacionErgonomicaRow)
  const evaluacionesPorRiesgo = { bajo: 0, medio: 0, alto: 0 }
  const evaluacionesPorEstado = { pendiente: 0, en_progreso: 0, resuelto: 0 }
  for (const evaluacion of evaluaciones) {
    evaluacionesPorRiesgo[evaluacion.nivelRiesgo] += 1
    evaluacionesPorEstado[evaluacion.estado] += 1
  }

  const { data: campanaRows } = await supabase
    .from('campanas')
    .select('*')
    .eq('empresa_id', empresa.id)
    .eq('estado', 'activa')
  const campanasPrevencion = (campanaRows ?? [])
    .map(mapCampanaRow)
    .filter((campana) => TIPOS_PREVENCION.includes(campana.tipo))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Prevención</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Eventos de seguridad</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Por tipo</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              <li>Accidentes: {eventosPorTipo.accidente}</li>
              <li>Incidentes: {eventosPorTipo.incidente}</li>
              <li>Cuasi accidentes: {eventosPorTipo.cuasi_accidente}</li>
              <li>Condiciones inseguras: {eventosPorTipo.condicion_insegura}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Por gravedad</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              <li>Leve: {eventosPorGravedad.leve}</li>
              <li>Moderada: {eventosPorGravedad.moderada}</li>
              <li>Grave: {eventosPorGravedad.grave}</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Evaluaciones ergonómicas</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Por nivel de riesgo</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              <li>Bajo: {evaluacionesPorRiesgo.bajo}</li>
              <li>Medio: {evaluacionesPorRiesgo.medio}</li>
              <li>Alto: {evaluacionesPorRiesgo.alto}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Por estado</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              <li>Pendiente: {evaluacionesPorEstado.pendiente}</li>
              <li>En progreso: {evaluacionesPorEstado.en_progreso}</li>
              <li>Resuelto: {evaluacionesPorEstado.resuelto}</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Campañas preventivas activas</h2>
        {campanasPrevencion.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin campañas preventivas activas.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {campanasPrevencion.map((campana) => (
              <li key={campana.id}>
                {campana.nombre} — {CAMPANA_TIPO_LABELS[campana.tipo]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
