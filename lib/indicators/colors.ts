// Fixed per-indicator identity colors, in a fixed order that never changes with sorting or
// filtering (a filter that changes which indicators are visible must not repaint the
// survivors). Reuses the app's existing --chart-1..4 tokens plus two brand accents already
// established elsewhere (marketing's cian #00B8F5, and an amber not claimed by any reserved
// status token in this app) rather than inventing a new palette.
export const INDICADOR_COLORS = {
  tasaAusentismo: 'var(--chart-1)',
  frecuencia: 'var(--chart-3)',
  severidad: 'var(--chart-2)',
  duracionPromedio: 'var(--chart-4)',
  reincidencia: '#00B8F5',
  costoEstimado: '#D97706',
} as const
