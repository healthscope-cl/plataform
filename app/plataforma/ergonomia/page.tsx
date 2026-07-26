import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
import { mapEvaluacionErgonomicaRow, mapAutoevaluacionErgonomicaRow } from '@/lib/ergonomia/types'
import { calcularRiesgoGeneral } from '@/lib/ergonomia/riesgoGeneral'
import { EvaluacionesErgonomicasTable } from '@/components/platform/ergonomia/EvaluacionesErgonomicasTable'
import { AutoevaluacionesTable, type AutoevaluacionFila } from '@/components/platform/ergonomia/AutoevaluacionesTable'
import { GaugeChart, BANDAS_NIVEL_RIESGO, MAXIMO_NIVEL_RIESGO } from '@/components/platform/GaugeChart'

const NIVEL_LABEL: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' }

export default async function ErgonomiaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('*, roles(*)').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')
  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id

  const { data: evaluacionRows } = await supabase
    .from('evaluaciones_ergonomicas')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const evaluaciones = (evaluacionRows ?? []).map(mapEvaluacionErgonomicaRow)

  const { data: cargoRows } = await supabase.from('cargos').select('id, nombre').eq('empresa_id', empresaId)
  const cargos = (cargoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: sucursalRows } = await supabase.from('sucursales').select('id, nombre').eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: personaRows } = await supabase.from('personas').select('id, codigo').eq('empresa_id', empresaId)
  const personaCodigoPorId = new Map((personaRows ?? []).map((row) => [row.id as string, row.codigo as string]))

  const { data: autoevaluacionRows } = await supabase
    .from('autoevaluaciones_ergonomicas')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(200)
  const autoevaluaciones: AutoevaluacionFila[] = (autoevaluacionRows ?? [])
    .map(mapAutoevaluacionErgonomicaRow)
    .map((autoevaluacion) => ({
      id: autoevaluacion.id,
      personaCodigo: personaCodigoPorId.get(autoevaluacion.personaId) ?? autoevaluacion.personaId,
      createdAt: autoevaluacion.createdAt,
      nivelRiesgo: autoevaluacion.nivelRiesgo,
      recomendacion: autoevaluacion.recomendacion,
      necesitaAyuda: autoevaluacion.necesitaAyuda,
    }))

  const riesgoGeneral = calcularRiesgoGeneral([
    ...evaluaciones.map((e) => e.nivelRiesgo),
    ...autoevaluaciones.map((a) => a.nivelRiesgo),
  ])

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Ergonomía</h1>

      {riesgoGeneral.nivel ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-center text-sm text-muted-foreground">Riesgo ergonómico general de la empresa</p>
          <div className="mt-2">
            <GaugeChart
              valor={riesgoGeneral.valorGauge}
              maximo={MAXIMO_NIVEL_RIESGO}
              bandas={BANDAS_NIVEL_RIESGO}
              etiqueta={NIVEL_LABEL[riesgoGeneral.nivel]}
              subtitulo={`${evaluaciones.length + autoevaluaciones.length} registros considerados`}
            />
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Autoevaluaciones de trabajadores</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Comparte el link de autoevaluación desde la ficha de cada persona. Las respuestas generan una
          recomendación automática al instante; las marcadas &quot;Necesita ayuda&quot; requieren seguimiento.
        </p>
        <div className="mt-3">
          <AutoevaluacionesTable autoevaluaciones={autoevaluaciones} />
        </div>
      </div>

      <EvaluacionesErgonomicasTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialEvaluaciones={evaluaciones}
        cargos={cargos}
        sucursales={sucursales}
      />
    </div>
  )
}
