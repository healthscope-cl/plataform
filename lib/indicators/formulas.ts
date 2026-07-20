// Placeholder minimum group size for small-group suppression — NOT a legal decision. The
// spec (docs/superpowers/specs/2026-07-17-data-platform-mvp.md, section 3) explicitly
// requires this threshold to be set with legal advice on reidentification risk, not an
// arbitrary engineering choice. Controller: replace this value once that advice exists.
export const MIN_GROUP_SIZE = 5

export type IndicadorValor = { valor: number; numerador: number; denominador: number } | { suprimido: true }

function ratio(numerador: number, denominador: number, multiplicador = 1): IndicadorValor {
  if (denominador === 0) {
    return { valor: 0, numerador: 0, denominador: 0 }
  }
  return { valor: (numerador / denominador) * multiplicador, numerador, denominador }
}

export function tasaAusentismo(input: {
  diasPerdidos: number
  diasProgramados: number
  personasActivas: number
}): IndicadorValor {
  if (input.personasActivas < MIN_GROUP_SIZE) return { suprimido: true }
  return ratio(input.diasPerdidos, input.diasProgramados, 100)
}

export function frecuencia(input: {
  episodios: number
  dotacionPromedio: number
  personasActivas: number
}): IndicadorValor {
  if (input.personasActivas < MIN_GROUP_SIZE) return { suprimido: true }
  return ratio(input.episodios, input.dotacionPromedio, 100)
}

export function severidad(input: {
  diasPerdidos: number
  episodios: number
  personasActivas: number
}): IndicadorValor {
  if (input.personasActivas < MIN_GROUP_SIZE) return { suprimido: true }
  return ratio(input.diasPerdidos, input.episodios)
}

export function duracionPromedio(input: {
  diasPerdidos: number
  episodiosCerrados: number
  personasActivas: number
}): IndicadorValor {
  if (input.personasActivas < MIN_GROUP_SIZE) return { suprimido: true }
  return ratio(input.diasPerdidos, input.episodiosCerrados)
}

export function reincidencia(input: {
  personasConDosOMasEpisodios: number
  personasConUnOMasEpisodios: number
  personasActivas: number
}): IndicadorValor {
  if (input.personasActivas < MIN_GROUP_SIZE) return { suprimido: true }
  return ratio(input.personasConDosOMasEpisodios, input.personasConUnOMasEpisodios, 100)
}

// Cost is a total, not a per-person rate — never suppressed by small groups (there's no
// reidentification risk in a currency total the way there is in a rate over few people).
export function costoEstimado(input: {
  diasPerdidos: number
  costoPromedioDiario: number
  horasExtra: number
  reemplazos: number
  costosAdministrativos: number
  personasActivas: number
}): IndicadorValor {
  const total =
    input.diasPerdidos * input.costoPromedioDiario +
    input.horasExtra +
    input.reemplazos +
    input.costosAdministrativos
  return { valor: total, numerador: total, denominador: 1 }
}

// Change vs. a saved baseline. Returns null (not a "0% change") when either side has no
// number to compare — a suppressed/missing value is not the same thing as "no change".
export function cambio(input: {
  valorActual: number | null
  valorLineaBase: number | null
}): IndicadorValor | null {
  if (input.valorActual === null || input.valorLineaBase === null || input.valorLineaBase === 0) {
    return null
  }
  return ratio(input.valorActual - input.valorLineaBase, input.valorLineaBase)
}
