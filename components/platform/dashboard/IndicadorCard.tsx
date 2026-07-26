import type { LucideIcon } from 'lucide-react'
import type { IndicadorValor } from '@/lib/indicators/formulas'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GaugeChart, type BandaGauge } from '@/components/platform/GaugeChart'
import { IndicadorMiniChart } from './IndicadorMiniChart'

function formatValor(valor: number, sufijo: string) {
  return sufijo === '$' ? `$${valor.toLocaleString('es-CL')}` : `${valor.toFixed(1)}${sufijo}`
}

function DeltaBadge({ cambio }: { cambio: IndicadorValor }) {
  if ('suprimido' in cambio) return null
  const esMejora = cambio.valor <= 0
  const porcentaje = Math.abs(cambio.valor * 100).toFixed(1)

  return (
    <span
      className={
        'mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ' +
        (esMejora ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')
      }
    >
      {/* Arrow direction follows the actual value movement (down when it decreased, up when
          it increased) — independent of color, which follows good/bad. Since every indicator
          here is lower-is-better, a decrease (esMejora) always points down. */}
      <svg aria-hidden="true" viewBox="0 0 12 12" className={'h-3 w-3 shrink-0' + (esMejora ? ' rotate-180' : '')}>
        <path d="M6 2 L10 8 L7 8 L7 10 L5 10 L5 8 L2 8 Z" fill="currentColor" />
      </svg>
      {porcentaje}% vs línea base
    </span>
  )
}

export function IndicadorCard({
  titulo,
  icon: Icon,
  resultado,
  sufijo,
  etiquetaNumerador,
  etiquetaDenominador,
  cambio,
  valorBase,
  color = 'var(--primary)',
  gauge,
}: {
  titulo: string
  icon: LucideIcon
  resultado: IndicadorValor
  sufijo: string
  etiquetaNumerador: string
  etiquetaDenominador: string
  cambio?: IndicadorValor | null
  valorBase?: number | null
  // Fixed per-indicator identity color (never reassigned by sort/filter) — see the shared
  // INDICADOR_COLORS map in ResumenInteractivo/IndicadoresResumenTabla, the two call sites.
  color?: string
  // Opt-in gauge display for indicators with a genuine bounded real-world band to calibrate
  // against (see lib/indicators/bandasGauge.ts) — not every indicator gets one; forcing a
  // gauge onto a metric with no real threshold would be decoration, not signal.
  gauge?: { maximo: number; bandas: BandaGauge[] }
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
        >
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <p className="text-sm text-muted-foreground">{titulo}</p>
      </div>
      {'suprimido' in resultado ? (
        <div className="mt-3 flex items-start gap-2">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground">
            <path
              fill="currentColor"
              d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3Zm-1.5 5V4a1.5 1.5 0 0 1 3 0v2h-3Z"
            />
          </svg>
          <p className="text-sm text-muted-foreground">Grupo insuficiente para mostrar</p>
        </div>
      ) : gauge ? (
        <>
          <div className="mt-1">
            <GaugeChart
              valor={resultado.valor}
              maximo={gauge.maximo}
              bandas={gauge.bandas}
              etiqueta={formatValor(resultado.valor, sufijo)}
            />
          </div>
          {cambio ? (
            <div className="flex justify-center">
              <DeltaBadge cambio={cambio} />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger render={<div className="mt-2 flex items-baseline gap-1.5 text-left" tabIndex={0} />}>
              <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">
                {formatValor(resultado.valor, sufijo)}
              </p>
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70">
                <path
                  fill="currentColor"
                  d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3.2a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8ZM9 11H7V6.6h2V11Z"
                />
              </svg>
            </TooltipTrigger>
            <TooltipContent>
              {etiquetaNumerador}: {resultado.numerador.toLocaleString('es-CL')} · {etiquetaDenominador}:{' '}
              {resultado.denominador.toLocaleString('es-CL')}
            </TooltipContent>
          </Tooltip>
          {cambio ? <DeltaBadge cambio={cambio} /> : null}
          <IndicadorMiniChart actual={resultado.valor} base={valorBase ?? null} />
        </>
      )}
    </div>
  )
}
