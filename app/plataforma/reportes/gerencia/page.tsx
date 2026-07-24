import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow } from '@/lib/platform/types'
import { calcularIndiceSuficiencia } from '@/lib/suficiencia/calcular'
import { SuficienciaBanner } from '@/components/platform/dashboard/SuficienciaBanner'
import { computeIndicadores } from '@/lib/indicators/aggregate'
import { mapReglaAlertaRow } from '@/lib/alertas/types'
import { evaluarReglas } from '@/lib/alertas/evaluar'
import { AlertasBanner } from '@/components/platform/dashboard/AlertasBanner'
import { mapCampanaRow } from '@/lib/campanas/types'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

export default async function ReporteGerenciaPage() {
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

  const periodoFin = new Date().toISOString().slice(0, 10)
  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  const { data: personaRows } = await supabase
    .from('personas')
    .select('id, codigo, unidad_id, cargo_id, turno_id')
    .eq('empresa_id', empresa.id)
  const personas = (personaRows ?? []).map((row) => ({
    id: row.id as string,
    codigo: row.codigo as string,
    contratoDias: 180,
    unidadId: row.unidad_id as string | null,
    cargoId: row.cargo_id as string | null,
    turnoId: row.turno_id as string | null,
  }))
  const personaIds = personas.map((p) => p.id)

  const { data: episodioRows } =
    personaIds.length > 0
      ? await supabase
          .from('episodios')
          .select('persona_id, dias, estado')
          .in('persona_id', personaIds)
          .gte('fecha_inicio', periodoInicio)
      : { data: [] }
  const episodios = (episodioRows ?? []).map((row) => ({
    personaId: row.persona_id as string,
    dias: row.dias as number,
    estado: row.estado as 'abierto' | 'cerrado',
  }))

  const { data: importacionReciente } = await supabase
    .from('importaciones')
    .select('id')
    .eq('estado', 'completada')
    .gte('created_at', periodoInicio)
    .limit(1)
  const huboImportacionReciente = (importacionReciente ?? []).length > 0

  const indiceSuficiencia = calcularIndiceSuficiencia({
    personas,
    cantidadEpisodios: episodios.length,
    huboImportacionReciente,
  })

  const indicadores = computeIndicadores({ personas, episodios, costos: COSTOS_DEFAULT })

  const { data: sucursalRows } = await supabase.from('sucursales').select('id').eq('empresa_id', empresa.id)
  const sucursalIds = (sucursalRows ?? []).map((row) => row.id as string)

  const { data: unidadRows } =
    sucursalIds.length > 0
      ? await supabase.from('unidades').select('id, nombre, sucursal_id').in('sucursal_id', sucursalIds)
      : { data: [] }
  const unidades = (unidadRows ?? []).map((row) => ({
    id: row.id as string,
    nombre: row.nombre as string,
    sucursalId: row.sucursal_id as string,
  }))

  const { data: reglaRows } = await supabase.from('reglas_alerta').select('*').eq('empresa_id', empresa.id)
  const reglas = (reglaRows ?? []).map(mapReglaAlertaRow)

  const alertasDisparadas = evaluarReglas({ reglas, personas, unidades, episodios, costos: COSTOS_DEFAULT })

  const { data: campanaRows } = await supabase
    .from('campanas')
    .select('*')
    .eq('empresa_id', empresa.id)
    .eq('estado', 'activa')
  const campanasActivas = (campanaRows ?? []).map(mapCampanaRow)
  const costoTotalCampanas = campanasActivas.reduce((acc, campana) => acc + (campana.costo ?? 0), 0)

  const costoEstimado = indicadores.costoEstimado

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Gerencia</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
        <p className="text-sm text-muted-foreground">
          Período: {periodoInicio} a {periodoFin}
        </p>
      </div>

      <SuficienciaBanner indice={indiceSuficiencia} />

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Costo estimado de ausentismo</p>
        <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
          {'suprimido' in costoEstimado
            ? 'Grupo insuficiente para mostrar'
            : `$${costoEstimado.valor.toLocaleString('es-CL')}`}
        </p>
      </div>

      <AlertasBanner alertas={alertasDisparadas} />

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Campañas activas</h2>
        <p className="mt-2 text-sm text-foreground">{campanasActivas.length} campañas activas</p>
        <p className="text-sm text-foreground">Costo total: ${costoTotalCampanas.toLocaleString('es-CL')}</p>
      </div>
    </div>
  )
}
