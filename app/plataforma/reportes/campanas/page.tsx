import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapEmpresaRow, mapRolRow } from '@/lib/platform/types'
import { isAdminRole } from '@/lib/platform/roles'
import { mapCampanaRow, type Campana } from '@/lib/campanas/types'
import { mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
import { medirAntesDespues, type ResultadoMedicion } from '@/lib/campanas/medicion'

const TIPO_LABELS: Record<Campana['tipo'], string> = {
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

const ESTADO_LABELS: Record<Campana['estado'], string> = {
  planificada: 'Planificada',
  activa: 'Activa',
  finalizada: 'Finalizada',
}

type Seguimiento = { pregunta: string; antes: ResultadoMedicion; despues: ResultadoMedicion | null }

function renderResultadoMedicion(resultado: ResultadoMedicion | null): string {
  if (resultado === null) return 'La campaña todavía no tiene fecha de término'
  if ('sinDatos' in resultado) return 'Sin datos todavía'
  if ('suprimido' in resultado) return 'Grupo insuficiente para mostrar'
  return `${resultado.promedio.toFixed(1)} / 5 (${resultado.cantidad} respuestas)`
}

export default async function ReporteCampanasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('*, roles(*)').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')
  const rol = mapRolRow(usuarioRow.roles)
  if (!isAdminRole(rol.clave)) {
    return <p className="text-muted-foreground">Este reporte requiere permisos de administrador.</p>
  }

  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)

  const { data: campanaRows } = await supabase.from('campanas').select('*').eq('empresa_id', empresa.id)
  const campanas = (campanaRows ?? []).map(mapCampanaRow)

  const { data: encuestaRows } = await supabase.from('encuestas').select('id').eq('empresa_id', empresa.id)
  const encuestaIds = (encuestaRows ?? []).map((row) => row.id as string)

  let respuestas: Array<{ respuestas: Record<string, number>; createdAt: string }> = []
  if (encuestaIds.length > 0) {
    const admin = createAdminClient()
    const { data: respuestaRows } = await admin.from('encuesta_respuestas').select('*').in('encuesta_id', encuestaIds)
    respuestas = (respuestaRows ?? []).map(mapEncuestaRespuestaRow)
  }

  const seguimientoPorCampana = new Map<string, Seguimiento>()
  for (const campana of campanas) {
    if (!campana.preguntaSeguimientoId) continue
    const preguntaId = campana.preguntaSeguimientoId
    const valores = respuestas
      .filter((r) => typeof r.respuestas[preguntaId] === 'number')
      .map((r) => ({ valor: r.respuestas[preguntaId], fecha: r.createdAt }))
    const resultado = medirAntesDespues({ valores, fechaInicio: campana.fechaInicio, fechaFin: campana.fechaFin })
    const preguntaTexto = CATALOGO_PREGUNTAS.find((p) => p.id === preguntaId)?.texto ?? preguntaId
    seguimientoPorCampana.set(campana.id, { pregunta: preguntaTexto, antes: resultado.antes, despues: resultado.despues })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Campañas</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
      </div>

      {campanas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin campañas registradas.</p>
      ) : (
        <div className="space-y-4">
          {campanas.map((campana) => {
            const seguimiento = seguimientoPorCampana.get(campana.id)
            return (
              <div key={campana.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="font-heading text-lg font-semibold text-foreground">{campana.nombre}</p>
                  <span className="text-sm text-muted-foreground">{ESTADO_LABELS[campana.estado]}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {TIPO_LABELS[campana.tipo]} — {campana.fechaInicio} a {campana.fechaFin ?? 'sin fecha de término'}
                </p>
                {campana.resultado ? <p className="mt-2 text-sm text-foreground">{campana.resultado}</p> : null}
                {seguimiento ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Antes — {seguimiento.pregunta}</p>
                      <p className="text-sm text-foreground">{renderResultadoMedicion(seguimiento.antes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Después — {seguimiento.pregunta}</p>
                      <p className="text-sm text-foreground">{renderResultadoMedicion(seguimiento.despues)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">Sin pregunta de seguimiento configurada.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
