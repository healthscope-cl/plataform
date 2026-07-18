export const CANONICAL_FIELDS = ['rut', 'fechaInicio', 'fechaFin', 'dias', 'tipoAdministrativo', 'codigoPersona'] as const
export type CanonicalField = (typeof CANONICAL_FIELDS)[number]

// Plain string-similarity aliases, no model — see Global Constraints. Listed in priority
// order per field; the first header that matches any alias wins.
const ALIASES: Record<CanonicalField, string[]> = {
  rut: ['rut', 'rut trabajador', 'run'],
  fechaInicio: ['fecha inicio', 'fecha de inicio', 'inicio'],
  fechaFin: ['fecha fin', 'fecha de termino', 'fecha de término', 'termino', 'término'],
  dias: ['dias', 'días', 'dias ausencia', 'días de ausencia'],
  tipoAdministrativo: ['tipo', 'tipo licencia', 'tipo de licencia', 'tipo administrativo'],
  codigoPersona: ['codigo', 'código', 'codigo persona', 'código persona', 'legajo'],
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

export function suggestColumnMapping(headers: string[]): Record<CanonicalField, string | null> {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalize(header) }))
  const result = {} as Record<CanonicalField, string | null>

  for (const field of CANONICAL_FIELDS) {
    const aliases = ALIASES[field]
    const match = normalizedHeaders.find((candidate) => aliases.includes(candidate.normalized))
    result[field] = match?.header ?? null
  }

  return result
}
