import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapLineaBaseRow } from '@/lib/indicators/types'
import { computeIndicadores, type IndicadorResultados } from '@/lib/indicators/aggregate'
import { cambio, type IndicadorValor } from '@/lib/indicators/formulas'
import { IndicadorCard } from '@/components/platform/dashboard/IndicadorCard'
import { GuardarLineaBaseButton } from '@/components/platform/dashboard/GuardarLineaBaseButton'

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
// valor/numerador/denominador fields — see lib/indicators/formulas.ts. Checking only for
// key presence (as the previous guard did) lets a malformed value under a present key
// through, which then throws inside valorNumerico()'s `'suprimido' in resultado` check.
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

  const { data: personaRows } = await supabase.from('personas').select('id').eq('empresa_id', empresaId)
  // Placeholder: assumes every active persona was contracted for the full 6-month period
  // (flat 180 days), instead of reading each person's real `contratos` row. Follow-up task
  // should join `contratos` to compute real active-days-in-period per persona.
  const personas = (personaRows ?? []).map((row) => ({ id: row.id as string, contratoDias: 180 }))

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

  const resultados = computeIndicadores({ personas, episodios, costos: COSTOS_DEFAULT })

  const { data: lineaBaseRows } = await supabase
    .from('lineas_base')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(1)
  const ultimaLineaBase = lineaBaseRows?.[0] ? mapLineaBaseRow(lineaBaseRows[0]) : null
  // Defensive: a saved baseline's `indicadores` blob may predate a future indicator-key
  // change. Verify the expected keys are present before trusting the shape — if they
  // aren't, treat it as if there were no baseline (no comparison shown) instead of letting
  // `cambioDe()` throw on a missing key and crash the whole Server Component render.
  const indicadoresBaseCrudo = ultimaLineaBase?.indicadores
  const indicadoresBase = esIndicadorResultados(indicadoresBaseCrudo) ? indicadoresBaseCrudo : undefined

  function valorNumerico(resultado: IndicadorValor): number | null {
    return 'suprimido' in resultado ? null : resultado.valor
  }

  function cambioDe(clave: keyof IndicadorResultados) {
    if (!indicadoresBase) return null
    return cambio({
      valorActual: valorNumerico(resultados[clave]),
      valorLineaBase: valorNumerico(indicadoresBase[clave]),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Resumen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Período: {periodoInicio} a {periodoFin} · {personas.length} personas activas
          </p>
        </div>
        <GuardarLineaBaseButton
          tenantId={usuario.tenantId}
          empresaId={empresaId}
          actorId={usuario.id}
          rolClave={rol.clave}
          periodoInicio={periodoInicio}
          periodoFin={periodoFin}
          indicadores={resultados}
        />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <IndicadorCard
          titulo="Tasa de ausentismo"
          resultado={resultados.tasaAusentismo}
          sufijo="%"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Días programados"
          cambio={cambioDe('tasaAusentismo')}
        />
        <IndicadorCard
          titulo="Frecuencia"
          resultado={resultados.frecuencia}
          sufijo="%"
          etiquetaNumerador="Episodios"
          etiquetaDenominador="Dotación promedio"
          cambio={cambioDe('frecuencia')}
        />
        <IndicadorCard
          titulo="Severidad"
          resultado={resultados.severidad}
          sufijo=" días/episodio"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Episodios"
          cambio={cambioDe('severidad')}
        />
        <IndicadorCard
          titulo="Duración promedio"
          resultado={resultados.duracionPromedio}
          sufijo=" días"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Episodios cerrados"
          cambio={cambioDe('duracionPromedio')}
        />
        <IndicadorCard
          titulo="Reincidencia"
          resultado={resultados.reincidencia}
          sufijo="%"
          etiquetaNumerador="Personas con 2+ episodios"
          etiquetaDenominador="Personas con 1+ episodio"
          cambio={cambioDe('reincidencia')}
        />
        <IndicadorCard
          titulo="Costo estimado"
          resultado={resultados.costoEstimado}
          sufijo="$"
          etiquetaNumerador="Costo total"
          etiquetaDenominador="—"
          cambio={cambioDe('costoEstimado')}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Rol: {rol.nombre}. Los costos usan supuestos por defecto (costo promedio diario
        ${COSTOS_DEFAULT.costoPromedioDiario.toLocaleString('es-CL')}); un panel de configuración de costos
        por empresa queda para un plan posterior.
      </p>
    </div>
  )
}
