import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapEmpresaRow } from '@/lib/platform/types'
import { mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { agregarRespuestas } from '@/lib/encuestas/agregar'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { huboIncrementoIncidentes } from '@/lib/recomendaciones/incidentes'
import { Badge } from '@/components/ui/badge'

const UMBRAL_PROMEDIO = 3.5

const SENALES_ENCUESTA = [
  {
    preguntaId: 'fatiga',
    nombre: 'Fatiga elevada',
    justificacion:
      'Un promedio elevado de fatiga puede anticipar ausentismo, accidentes o baja productividad si no se interviene a tiempo.',
    limitaciones:
      'No está segmentado por turno, área ni sucursal — un promedio elevado a nivel de empresa puede diluir un problema concentrado en un grupo específico.',
    responsable: 'Prevención de riesgos / Salud ocupacional',
    indicadorAMedir: 'Promedio de fatiga en la próxima medición de encuestas.',
    acciones: [
      'Revisar rotación',
      'Evaluar pausas',
      'Analizar horas extraordinarias',
      'Aplicar encuesta de sueño',
      'Realizar intervención de fatiga',
    ],
  },
  {
    preguntaId: 'dolor_musculoesqueletico',
    nombre: 'Molestias lumbares elevadas',
    justificacion:
      'Las molestias musculoesqueléticas autoreportadas son un precursor conocido de licencias por enfermedad profesional si no se atienden preventivamente.',
    limitaciones:
      'Basado en encuesta autoreportada, no en una evaluación clínica o ergonómica formal — confirmar con evaluaciones ergonómicas antes de intervenir.',
    responsable: 'Ergonomía / Prevención de riesgos',
    indicadorAMedir: 'Promedio de molestias musculoesqueléticas en la próxima medición.',
    acciones: ['Evaluación ergonómica', 'Kinesiología preventiva', 'Pausas activas', 'Capacitación de postura', 'Ajuste de puesto'],
  },
  {
    preguntaId: 'estres',
    nombre: 'Alta tensión psicosocial',
    justificacion:
      'Un nivel alto de estrés percibido es una señal temprana de riesgo psicosocial que puede derivar en ausentismo o rotación si no se atiende.',
    limitaciones:
      'El estrés autoreportado no equivale a un diagnóstico de riesgo psicosocial formal — requiere evaluación especializada antes de concluir causalidad.',
    responsable: 'RR.HH. / Salud ocupacional',
    indicadorAMedir: 'Promedio de estrés percibido en la próxima medición.',
    acciones: ['Evaluación especializada', 'Taller de liderazgo', 'Revisión de carga', 'Canal de apoyo', 'Programa psicológico'],
  },
] as const

const REVISION_HUMANA =
  'Esta es una sugerencia basada en reglas fijas, no un diagnóstico — debe ser evaluada por un profesional antes de implementarse.'

export default async function RecomendacionesPage() {
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

  const { data: encuestaRows } = await supabase.from('encuestas').select('id').eq('empresa_id', empresa.id)
  const encuestaIds = (encuestaRows ?? []).map((row) => row.id as string)

  const admin = createAdminClient()
  const { data: respuestaRows } =
    encuestaIds.length > 0
      ? await admin.from('encuesta_respuestas').select('*').in('encuesta_id', encuestaIds)
      : { data: [] }
  const respuestas = (respuestaRows ?? []).map(mapEncuestaRespuestaRow)

  const resultadosEncuesta = agregarRespuestas({
    preguntaIds: SENALES_ENCUESTA.map((s) => s.preguntaId),
    respuestas: respuestas.map((r) => r.respuestas),
  })

  const { data: eventoRows } = await supabase.from('eventos_seguridad').select('*').eq('empresa_id', empresa.id)
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)
  const fechaCorte = new Date().toISOString().slice(0, 10)
  const incidentes = huboIncrementoIncidentes({ fechas: eventos.map((e) => e.fecha), fechaCorte })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Recomendaciones</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
        <p className="text-sm text-muted-foreground">
          Sugerencias basadas en reglas fijas sobre señales detectadas en los datos actuales — no un diagnóstico
          automático. Cada recomendación debe ser evaluada por un profesional antes de implementarse.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SENALES_ENCUESTA.map((senal) => {
          const resultado = resultadosEncuesta[senal.preguntaId]
          const suprimido = !resultado || 'suprimido' in resultado
          const activa = resultado && !suprimido && resultado.promedio >= UMBRAL_PROMEDIO

          return (
            <div key={senal.preguntaId} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="font-heading text-lg font-semibold text-foreground">{senal.nombre}</p>
                <Badge variant={suprimido ? 'outline' : activa ? 'destructive' : 'secondary'}>
                  {suprimido ? 'Sin datos suficientes' : activa ? 'Activa' : 'No activa'}
                </Badge>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Evidencia: </span>
                {suprimido || !resultado
                  ? 'Grupo insuficiente para mostrar.'
                  : `Promedio actual: ${resultado.promedio.toFixed(1)} / 5, basado en ${resultado.cantidad} respuestas.`}
              </p>

              <p className="mt-2 text-sm text-foreground">
                <span className="font-medium">Acciones sugeridas: </span>
                {senal.acciones.join(', ')}.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Nivel de confianza: </span>
                Media — dato autoreportado, no un diagnóstico clínico.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Justificación: </span>
                {senal.justificacion}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Limitaciones: </span>
                {senal.limitaciones}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Responsable sugerido: </span>
                {senal.responsable}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Indicador a medir: </span>
                {senal.indicadorAMedir}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Revisión humana: {REVISION_HUMANA}</p>
            </div>
          )
        })}

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-heading text-lg font-semibold text-foreground">Incremento de incidentes</p>
            <Badge variant={incidentes.incremento ? 'destructive' : 'secondary'}>
              {incidentes.incremento ? 'Activa' : 'No activa'}
            </Badge>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Evidencia: </span>
            {incidentes.actual} eventos de seguridad en los últimos 3 meses, frente a {incidentes.anterior} en los 3
            meses anteriores.
          </p>

          <p className="mt-2 text-sm text-foreground">
            <span className="font-medium">Acciones sugeridas: </span>
            Investigación, Revisión de procedimientos, Capacitación, Supervisión, Medidas correctivas.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Nivel de confianza: </span>
            Alta — conteo administrativo directo, no autoreportado.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Justificación: </span>
            Un aumento en la cantidad de eventos de seguridad puede indicar un deterioro de condiciones
            operacionales que requiere revisión antes de que ocurra un incidente más grave.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Limitaciones: </span>
            Compara conteos absolutos, no tasas — un cambio en la dotación entre períodos puede afectar la
            comparación.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Responsable sugerido: </span>
            Prevención de riesgos
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Indicador a medir: </span>
            Conteo de eventos de seguridad en el próximo período de 3 meses.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Revisión humana: {REVISION_HUMANA}</p>
        </div>
      </div>
    </div>
  )
}
