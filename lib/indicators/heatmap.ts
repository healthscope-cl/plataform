import { tasaAusentismo, type IndicadorValor } from './formulas'

export type PeriodoMapaCalor = { label: string; inicio: string; fin: string }

export type CeldaMapaCalor = {
  periodoLabel: string
  tasaAusentismo: IndicadorValor
}

export type FilaMapaCalor = {
  sucursalId: string
  sucursalNombre: string
  celdas: CeldaMapaCalor[]
}

// Same placeholder used by the Resumen page for its own 6-month window (flat days instead of
// reading each persona's real `contratos` row) — see app/plataforma/resumen/page.tsx. A
// 30-day placeholder here is the per-month equivalent of that same known simplification.
const DIAS_CONTRATO_PLACEHOLDER_MENSUAL = 30

export function computeMapaCalorAusentismo(input: {
  sucursales: Array<{ id: string; nombre: string }>
  unidades: Array<{ id: string; sucursalId: string }>
  personas: Array<{ id: string; unidadId: string | null }>
  episodios: Array<{ personaId: string; dias: number; fechaInicio: string }>
  periodos: PeriodoMapaCalor[]
}): FilaMapaCalor[] {
  const sucursalPorUnidad = new Map(input.unidades.map((u) => [u.id, u.sucursalId]))

  const personasPorSucursal = new Map<string, string[]>()
  for (const persona of input.personas) {
    if (!persona.unidadId) continue
    const sucursalId = sucursalPorUnidad.get(persona.unidadId)
    if (!sucursalId) continue
    const lista = personasPorSucursal.get(sucursalId) ?? []
    lista.push(persona.id)
    personasPorSucursal.set(sucursalId, lista)
  }

  return input.sucursales.map((sucursal) => {
    const personaIds = new Set(personasPorSucursal.get(sucursal.id) ?? [])
    const personasActivas = personaIds.size

    const celdas = input.periodos.map((periodo) => {
      const diasPerdidos = input.episodios
        .filter(
          (e) => personaIds.has(e.personaId) && e.fechaInicio >= periodo.inicio && e.fechaInicio <= periodo.fin
        )
        .reduce((sum, e) => sum + e.dias, 0)

      return {
        periodoLabel: periodo.label,
        tasaAusentismo: tasaAusentismo({
          diasPerdidos,
          diasProgramados: personasActivas * DIAS_CONTRATO_PLACEHOLDER_MENSUAL,
          personasActivas,
        }),
      }
    })

    return { sucursalId: sucursal.id, sucursalNombre: sucursal.nombre, celdas }
  })
}

// Pure UTC day arithmetic on purpose (Date.UTC + millisecond diffs, no setMonth/setDate) —
// this project has already hit real timezone/DST bugs mixing local-time Date mutation with
// UTC re-serialization (see lib/recomendaciones/incidentes.ts). 30-day windows sidestep
// calendar-month-length differences entirely.
export function generarPeriodosMensuales(fechaReferenciaISO: string, cantidad: number): PeriodoMapaCalor[] {
  const [anio, mes, dia] = fechaReferenciaISO.split('-').map(Number)
  const finReferencia = Date.UTC(anio, mes - 1, dia)
  const formatoMes = new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' })
  const unDiaMs = 24 * 60 * 60 * 1000

  const periodos: PeriodoMapaCalor[] = []
  for (let i = cantidad - 1; i >= 0; i--) {
    const finVentanaMs = finReferencia - i * 30 * unDiaMs
    const inicioVentanaMs = finVentanaMs - 29 * unDiaMs
    periodos.push({
      label: formatoMes.format(new Date(finVentanaMs)),
      inicio: new Date(inicioVentanaMs).toISOString().slice(0, 10),
      fin: new Date(finVentanaMs).toISOString().slice(0, 10),
    })
  }
  return periodos
}
