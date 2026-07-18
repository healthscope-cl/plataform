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

// NOTE: fields are resolved independently and sequentially, so if two canonical fields'
// alias lists ever overlapped (they don't today), the same header could be assigned to
// both fields. This function does not dedupe across fields, only within a single field's
// candidates — acceptable because these are suggestions the user confirms/overrides in
// the import wizard, not final assignments.
export function suggestColumnMapping(headers: string[]): Record<CanonicalField, string | null> {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalize(header) }))
  const result = {} as Record<CanonicalField, string | null>

  for (const field of CANONICAL_FIELDS) {
    const aliases = ALIASES[field].map((alias) => normalize(alias))

    // Tier 1 & 2: exact match, then case/accent-insensitive match (both collapse to the
    // same normalized-string-equality check once both sides are normalized).
    let match = normalizedHeaders.find((candidate) => aliases.includes(candidate.normalized))

    // Tier 3: substring match. Permissive by design (bidirectional) since this is only a
    // suggestion the user confirms/overrides in the wizard UI — being generous here is
    // safer than being strict and missing a plausible mapping.
    if (!match) {
      match = normalizedHeaders.find((candidate) =>
        aliases.some(
          (alias) => candidate.normalized.includes(alias) || alias.includes(candidate.normalized)
        )
      )
    }

    result[field] = match?.header ?? null
  }

  return result
}
