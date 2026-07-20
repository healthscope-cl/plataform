import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapLineaBaseRow } from '@/lib/indicators/types'
import type { IndicadorResultados } from '@/lib/indicators/aggregate'
import type { IndicadorValor } from '@/lib/indicators/formulas'
import { ResumenInteractivo } from '@/components/platform/dashboard/ResumenInteractivo'
import { calcularIndiceSuficiencia } from '@/lib/suficiencia/calcular'
import { SuficienciaBanner } from '@/components/platform/dashboard/SuficienciaBanner'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

const INDICADOR_KEYS: readonly (keyof IndicadorResultados)[] = [
  'tasaAusentismo',
  'frecuencia',
  'severidad',
  'duracionPromedio',
  'reincidencia',
  'costoEstimado',
]

// A well-formed IndicadorValor is either `{ suprimido: true }` or an object with numeric
// valor/numerador/denominador fields — see lib/indicators/formulas.ts. Checking only for key
// presence lets a malformed value under a present key through, which would then throw inside
// ResumenInteractivo's `'suprimido' in resultado` check.
function esIndicadorValor(valor: unknown): valor is IndicadorValor {
  if (typeof valor !== 'object' || valor === null) return false
  const registro = valor as Record<string, unknown>
  if ('suprimido' in registro) return registro.suprimido === true
  return (
    typeof registro.valor === 'number' &&
    typeof registro.numerador === 'number' &&
    typeof registro.denominador === 'number'
  )
}

function esIndicadorResultados(valor: unknown): valor is IndicadorResultados {
  if (typeof valor !== 'object' || valor === null) return false
  const registro = valor as Record<string, unknown>
  return INDICADOR_KEYS.every((clave) => clave in registro && esIndicadorValor(registro[clave]))
}

export default async function ResumenPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('*, roles(*)').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')
  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }

  const periodoFin = new Date().toISOString().slice(0, 10)
  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  const { data: personaRows } = await supabase
    .from('personas')
    .select('id, codigo, unidad_id, cargo_id, turno_id')
    .eq('empresa_id', empresaId)
  // Placeholder: assumes every active persona was contracted for the full 6-month period
  // (flat 180 days), instead of reading each person's real `contratos` row. Follow-up task
  // should join `contratos` to compute real active-days-in-period per persona.
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

  const { data: sucursalRows } = await supabase.from('sucursales').select('id, nombre').eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))
  const sucursalIds = sucursales.map((s) => s.id)

  const { data: unidadRows } =
    sucursalIds.length > 0
      ? await supabase.from('unidades').select('id, nombre, sucursal_id').in('sucursal_id', sucursalIds)
      : { data: [] }
  const unidades = (unidadRows ?? []).map((row) => ({
    id: row.id as string,
    nombre: row.nombre as string,
    sucursalId: row.sucursal_id as string,
  }))

  const { data: cargoRows } = await supabase.from('cargos').select('id, nombre').eq('empresa_id', empresaId)
  const cargos = (cargoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: turnoRows } = await supabase.from('turnos').select('id, nombre').eq('empresa_id', empresaId)
  const turnos = (turnoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: lineaBaseRows } = await supabase
    .from('lineas_base')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(1)
  const ultimaLineaBase = lineaBaseRows?.[0] ? mapLineaBaseRow(lineaBaseRows[0]) : null
  const indicadoresBaseCrudo = ultimaLineaBase?.indicadores
  const indicadoresBase = esIndicadorResultados(indicadoresBaseCrudo) ? indicadoresBaseCrudo : undefined

  return (
    <div className="space-y-6">
      <SuficienciaBanner indice={indiceSuficiencia} />
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Resumen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Período: {periodoInicio} a {periodoFin}
        </p>
      </div>

      {ultimaLineaBase ? (
        <p className="text-xs text-muted-foreground">
          Última línea base guardada: {new Date(ultimaLineaBase.createdAt).toLocaleDateString('es-CL')} (
          {ultimaLineaBase.periodoInicio} a {ultimaLineaBase.periodoFin})
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sin línea base guardada todavía — guarda una para poder comparar el cambio en el futuro.
        </p>
      )}

      <ResumenInteractivo
        personas={personas}
        episodios={episodios}
        sucursales={sucursales}
        unidades={unidades}
        cargos={cargos}
        turnos={turnos}
        costos={COSTOS_DEFAULT}
        indicadoresBase={indicadoresBase}
        periodoInicio={periodoInicio}
        periodoFin={periodoFin}
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
      />

      <p className="text-xs text-muted-foreground">
        Rol: {rol.nombre}. Los costos usan supuestos por defecto (costo promedio diario
        ${COSTOS_DEFAULT.costoPromedioDiario.toLocaleString('es-CL')}); un panel de configuración de costos
        por empresa queda para un plan posterior.
      </p>
    </div>
  )
}
