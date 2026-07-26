// Semi-circle gauge (colored bands + needle), the visual pattern from the Cority reference
// Jose pointed to (screenshots he saved, since live playback kept failing in this session).
// Hand-rolled SVG rather than recharts: a 180° banded gauge with a needle isn't one of
// recharts' chart types, and the arc trig is simple enough to own directly.
//
// Bands are expressed in the metric's own real units (e.g. percent), not a normalized 0-100 —
// so the colored zones line up with a threshold that actually means something (a configured
// alert umbral, a documented placeholder), instead of arbitrary equal thirds.
export type BandaGauge = { hasta: number; color: string }

// Shared preset for a 3-level categorical signal (bajo/medio/alto) with no finer real-world
// unit to calibrate against — equal thirds on an abstract 0-100 scale, matching the underlying
// data's own granularity rather than inventing one. Used by nivel_riesgo displays.
export const BANDAS_NIVEL_RIESGO: BandaGauge[] = [
  { hasta: 33, color: 'var(--success)' },
  { hasta: 66, color: '#F5A623' },
  { hasta: 100, color: 'var(--destructive)' },
]
export const MAXIMO_NIVEL_RIESGO = 100

function puntoEnArco(cx: number, cy: number, r: number, anguloGrados: number) {
  const radianes = ((anguloGrados - 180) * Math.PI) / 180
  return { x: cx + r * Math.cos(radianes), y: cy + r * Math.sin(radianes) }
}

function trazarArco(cx: number, cy: number, r: number, desde: number, hasta: number) {
  const inicio = puntoEnArco(cx, cy, r, hasta)
  const fin = puntoEnArco(cx, cy, r, desde)
  return `M ${inicio.x} ${inicio.y} A ${r} ${r} 0 0 0 ${fin.x} ${fin.y}`
}

export function GaugeChart({
  valor,
  maximo,
  bandas,
  etiqueta,
  subtitulo,
}: {
  valor: number
  maximo: number
  bandas: BandaGauge[]
  etiqueta: string
  subtitulo?: string
}) {
  const valorAcotado = Math.min(Math.max(valor, 0), maximo)
  const anguloAguja = (valorAcotado / maximo) * 180
  const puntaAguja = puntoEnArco(100, 100, 70, anguloAguja)

  const segmentos = bandas.reduce<Array<{ desdeGrados: number; hastaGrados: number; color: string }>>(
    (acumulado, banda, indice) => {
      const desde = indice === 0 ? 0 : bandas[indice - 1].hasta
      acumulado.push({
        desdeGrados: (desde / maximo) * 180,
        hastaGrados: (Math.min(banda.hasta, maximo) / maximo) * 180,
        color: banda.color,
      })
      return acumulado
    },
    []
  )

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 115" className="w-full max-w-[220px]">
        {segmentos.map((segmento) => (
          <path
            key={segmento.hastaGrados}
            d={trazarArco(100, 100, 80, segmento.desdeGrados, segmento.hastaGrados)}
            fill="none"
            stroke={segmento.color}
            strokeWidth={16}
            strokeLinecap="round"
          />
        ))}
        <circle cx={100} cy={100} r={6} fill="var(--foreground)" />
        <line
          x1={100}
          y1={100}
          x2={puntaAguja.x}
          y2={puntaAguja.y}
          stroke="var(--foreground)"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </svg>
      <p className="font-heading text-2xl font-semibold text-foreground">{etiqueta}</p>
      {subtitulo ? <p className="text-sm text-muted-foreground">{subtitulo}</p> : null}
    </div>
  )
}
