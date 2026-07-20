import {
  costoEstimado,
  duracionPromedio,
  frecuencia,
  reincidencia,
  severidad,
  tasaAusentismo,
  type IndicadorValor,
} from './formulas'

export type ComputeIndicadoresInput = {
  personas: Array<{ id: string; contratoDias: number }>
  episodios: Array<{ personaId: string; dias: number; estado: 'abierto' | 'cerrado' }>
  costos: {
    costoPromedioDiario: number
    horasExtra: number
    reemplazos: number
    costosAdministrativos: number
  }
}

export type IndicadorResultados = {
  tasaAusentismo: IndicadorValor
  frecuencia: IndicadorValor
  severidad: IndicadorValor
  duracionPromedio: IndicadorValor
  reincidencia: IndicadorValor
  costoEstimado: IndicadorValor
}

export function computeIndicadores(input: ComputeIndicadoresInput): IndicadorResultados {
  const personasActivas = input.personas.length
  const diasProgramados = input.personas.reduce((sum, p) => sum + p.contratoDias, 0)
  const diasPerdidos = input.episodios.reduce((sum, e) => sum + e.dias, 0)
  const episodiosCerrados = input.episodios.filter((e) => e.estado === 'cerrado')
  const diasPerdidosCerrados = episodiosCerrados.reduce((sum, e) => sum + e.dias, 0)

  const episodiosPorPersona = new Map<string, number>()
  for (const episodio of input.episodios) {
    episodiosPorPersona.set(episodio.personaId, (episodiosPorPersona.get(episodio.personaId) ?? 0) + 1)
  }
  const personasConUnOMasEpisodios = Array.from(episodiosPorPersona.values()).filter((count) => count >= 1).length
  const personasConDosOMasEpisodios = Array.from(episodiosPorPersona.values()).filter((count) => count >= 2).length

  return {
    tasaAusentismo: tasaAusentismo({ diasPerdidos, diasProgramados, personasActivas }),
    frecuencia: frecuencia({ episodios: input.episodios.length, dotacionPromedio: personasActivas, personasActivas }),
    severidad: severidad({ diasPerdidos, episodios: input.episodios.length, personasActivas }),
    duracionPromedio: duracionPromedio({
      diasPerdidos: diasPerdidosCerrados,
      episodiosCerrados: episodiosCerrados.length,
      personasActivas,
    }),
    reincidencia: reincidencia({ personasConDosOMasEpisodios, personasConUnOMasEpisodios, personasActivas }),
    costoEstimado: costoEstimado({ diasPerdidos, personasActivas, ...input.costos }),
  }
}
