// Semi-circle gauge (green → amber → red bands + needle), the visual pattern from the Cority
// reference Jose pointed to. Hand-rolled SVG rather than recharts: a 180° three-band gauge
// with a needle isn't one of recharts' chart types, and the arc trig is simple enough to own.
const BANDAS = [
  { desde: 0, hasta: 60, color: 'var(--success)' },
  { desde: 60, hasta: 120, color: '#F5A623' },
  { desde: 120, hasta: 180, color: 'var(--destructive)' },
]

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
  etiqueta,
  subtitulo,
}: {
  // 0-100
  valor: number
  etiqueta: string
  subtitulo?: string
}) {
  const valorAcotado = Math.min(Math.max(valor, 0), 100)
  const anguloAguja = (valorAcotado / 100) * 180
  const puntaAguja = puntoEnArco(100, 100, 70, anguloAguja)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 115" className="w-full max-w-[220px]">
        {BANDAS.map((banda) => (
          <path
            key={banda.desde}
            d={trazarArco(100, 100, 80, banda.desde, banda.hasta)}
            fill="none"
            stroke={banda.color}
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
