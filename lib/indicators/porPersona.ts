export type IndicadorPersona = {
  id: string
  codigo: string
  diasPerdidos: number
  cantidadEpisodios: number
  costoEstimado: number
}

export function computeIndicadoresPorPersona(input: {
  personas: Array<{ id: string; codigo: string }>
  episodios: Array<{ personaId: string; dias: number }>
  costoPromedioDiario: number
}): IndicadorPersona[] {
  const diasPorPersona = new Map<string, number>()
  const episodiosPorPersona = new Map<string, number>()

  for (const episodio of input.episodios) {
    diasPorPersona.set(episodio.personaId, (diasPorPersona.get(episodio.personaId) ?? 0) + episodio.dias)
    episodiosPorPersona.set(episodio.personaId, (episodiosPorPersona.get(episodio.personaId) ?? 0) + 1)
  }

  return input.personas.map((persona) => {
    const diasPerdidos = diasPorPersona.get(persona.id) ?? 0
    return {
      id: persona.id,
      codigo: persona.codigo,
      diasPerdidos,
      cantidadEpisodios: episodiosPorPersona.get(persona.id) ?? 0,
      costoEstimado: diasPerdidos * input.costoPromedioDiario,
    }
  })
}
