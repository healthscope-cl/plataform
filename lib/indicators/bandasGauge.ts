import type { BandaGauge } from '@/components/platform/GaugeChart'

// Placeholder thresholds — a reasonable starting point from commonly cited absenteeism
// benchmarks, NOT a validated business decision. Same caveat as MIN_GROUP_SIZE
// (lib/indicators/formulas.ts) and UMBRAL_SOLIDO (lib/suficiencia/calcular.ts): a real
// threshold here should come from Jose/the client, not an arbitrary engineering choice.
// Only tasa de ausentismo gets a gauge on Resumen/Reportes — it's the one KPI with a genuine
// bounded percent-with-a-known-direction meaning; frecuencia/costo/duración don't have an
// equivalent real-world band to calibrate against without more business input, so forcing a
// gauge onto them would be decoration, not signal.
export const MAXIMO_GAUGE_TASA_AUSENTISMO = 15
export const BANDAS_GAUGE_TASA_AUSENTISMO: BandaGauge[] = [
  { hasta: 3, color: 'var(--success)' },
  { hasta: 6, color: '#F5A623' },
  { hasta: MAXIMO_GAUGE_TASA_AUSENTISMO, color: 'var(--destructive)' },
]
