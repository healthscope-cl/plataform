import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow, mapEmpresaRow } from '@/lib/platform/types'
import { computeIndicadores } from '@/lib/indicators/aggregate'
import { calcularIndiceSuficiencia } from '@/lib/suficiencia/calcular'
import { SuficienciaBanner } from '@/components/platform/dashboard/SuficienciaBanner'
import { mapReglaAlertaRow } from '@/lib/alertas/types'
import { evaluarReglas } from '@/lib/alertas/evaluar'
import { AlertasBanner } from '@/components/platform/dashboard/AlertasBanner'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { mapCampanaRow, type Campana } from '@/lib/campanas/types'
import { IndicadoresResumenTabla } from '@/components/platform/reportes/IndicadoresResumenTabla'
import { ImprimirButton } from '@/components/platform/reportes/ImprimirButton'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

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

export default async function ReportesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('*, roles(*)').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')
  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
  const empresaId = empresa.id

  const periodoFin = new Date().toISOString().slice(0, 10)
  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  const { data: personaRows } = await supabase
    .from('personas')
    .select('id, codigo, unidad_id, cargo_id, turno_id')
    .eq('empresa_id', empresaId)
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
    .eq('tenant_id', usuario.tenantId)
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

  const { data: sucursalRows } = await supabase.from('sucursales').select('id').eq('empresa_id', empresaId)
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

  const { data: reglaRows } = await supabase.from('reglas_alerta').select('*').eq('empresa_id', empresaId)
  const reglas = (reglaRows ?? []).map(mapReglaAlertaRow)

  const alertasDisparadas = evaluarReglas({
    reglas,
    personas,
    unidades,
    episodios,
    costos: COSTOS_DEFAULT,
  })

  const { data: eventoRows } = await supabase.from('eventos_seguridad').select('*').eq('empresa_id', empresaId)
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)
  const eventosPorEstado = { abierto: 0, en_seguimiento: 0, cerrado: 0 }
  for (const evento of eventos) {
    eventosPorEstado[evento.estado] += 1
  }

  const { data: campanaRows } = await supabase
    .from('campanas')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('estado', 'activa')
  const campanasActivas = (campanaRows ?? []).map(mapCampanaRow)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte Ejecutivo</h1>
          <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
          <p className="text-sm text-muted-foreground">
            Período: {periodoInicio} a {periodoFin}
          </p>
          <p className="text-xs text-muted-foreground">
            Generado el {new Date().toLocaleDateString('es-CL')} por {usuario.nombre}
          </p>
        </div>
        <ImprimirButton />
      </div>

      <SuficienciaBanner indice={indiceSuficiencia} />

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Indicadores clave</h2>
        <IndicadoresResumenTabla indicadores={indicadores} />
      </div>

      <AlertasBanner alertas={alertasDisparadas} />

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguridad laboral</h2>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          <li>Eventos abiertos: {eventosPorEstado.abierto}</li>
          <li>En seguimiento: {eventosPorEstado.en_seguimiento}</li>
          <li>Cerrados: {eventosPorEstado.cerrado}</li>
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Campañas activas</h2>
        {campanasActivas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin campañas activas.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {campanasActivas.map((campana) => (
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
