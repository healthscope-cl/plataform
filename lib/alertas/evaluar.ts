import { filtrarPersonas, type FiltroGrupo } from '@/lib/indicators/filtroPersonas'
import { computeIndicadores, type IndicadorResultados } from '@/lib/indicators/aggregate'
import type { ReglaAlerta } from './types'

export type AlertaDisparada = {
  regla: ReglaAlerta
  valorActual: number
}

export function evaluarReglas(input: {
  reglas: ReglaAlerta[]
  personas: Array<{
    id: string
    contratoDias: number
    unidadId: string | null
    cargoId: string | null
    turnoId: string | null
  }>
  unidades: Array<{ id: string; sucursalId: string }>
  episodios: Array<{ personaId: string; dias: number; estado: 'abierto' | 'cerrado' }>
  costos: { costoPromedioDiario: number; horasExtra: number; reemplazos: number; costosAdministrativos: number }
}): AlertaDisparada[] {
  const disparadas: AlertaDisparada[] = []

  for (const regla of input.reglas) {
    if (!regla.activa) continue

    const filtro: FiltroGrupo = {
      sucursalId: regla.sucursalId,
      unidadId: regla.unidadId,
      cargoId: regla.cargoId,
      turnoId: regla.turnoId,
    }
    const personasDelAmbito = filtrarPersonas(input.personas, filtro, input.unidades)
    const idsDelAmbito = new Set(personasDelAmbito.map((p) => p.id))
    const episodiosDelAmbito = input.episodios.filter((episodio) => idsDelAmbito.has(episodio.personaId))

    const resultados = computeIndicadores({
      personas: personasDelAmbito,
      episodios: episodiosDelAmbito,
      costos: input.costos,
    })
    const resultado = resultados[regla.indicador as keyof IndicadorResultados]

    if ('suprimido' in resultado) continue

    const disparada =
      regla.operador === 'mayor_que' ? resultado.valor > regla.umbral : resultado.valor >= regla.umbral

    if (disparada) {
      disparadas.push({ regla, valorActual: resultado.valor })
    }
  }

  return disparadas
}
