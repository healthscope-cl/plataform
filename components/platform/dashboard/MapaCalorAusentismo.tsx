import type { FilaMapaCalor } from '@/lib/indicators/heatmap'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Sequential single-hue ramp (light → dark), fixed to a 0%–20% scale rather than
// auto-scaled to the current data's min/max — an auto-scaled ramp would make the same
// color mean a different tasa de ausentismo depending on which sucursales happen to be
// loaded, which defeats the point of a heatmap that's supposed to read at a glance.
const ESCALA_MAXIMA = 20
const RAMPA = ['#EAF1FE', '#C3D9FC', '#7CA8F5', '#3D74E8', '#1455E6']

function colorCelda(valor: number) {
  const intensidad = Math.min(valor / ESCALA_MAXIMA, 1)
  const paso = Math.min(Math.floor(intensidad * RAMPA.length), RAMPA.length - 1)
  return { background: RAMPA[paso], textoClaro: paso >= 3 }
}

function CeldaSuprimida() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <td className="border border-border bg-muted/40 p-0 text-center align-middle" tabIndex={0}>
            <span className="flex h-12 w-full items-center justify-center">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 text-muted-foreground">
                <path
                  fill="currentColor"
                  d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3Zm-1.5 5V4a1.5 1.5 0 0 1 3 0v2h-3Z"
                />
              </svg>
            </span>
          </td>
        }
      />
      <TooltipContent>Grupo insuficiente para mostrar</TooltipContent>
    </Tooltip>
  )
}

export function MapaCalorAusentismo({ filas }: { filas: FilaMapaCalor[] }) {
  if (filas.length === 0) return null
  const periodos = filas[0].celdas.map((c) => c.periodoLabel)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-foreground">Mapa de calor — tasa de ausentismo</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Menor</span>
          {RAMPA.map((color) => (
            <span key={color} className="h-3 w-5 rounded-sm" style={{ background: color }} />
          ))}
          <span>Mayor</span>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border p-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Sucursal
              </th>
              {periodos.map((label, i) => (
                <th
                  key={i}
                  className="border border-border p-2 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.sucursalId}>
                <td className="border border-border p-2 font-medium text-foreground">{fila.sucursalNombre}</td>
                {fila.celdas.map((celda, i) => {
                  if ('suprimido' in celda.tasaAusentismo) return <CeldaSuprimida key={i} />
                  const { background, textoClaro } = colorCelda(celda.tasaAusentismo.valor)
                  return (
                    <Tooltip key={i}>
                      <TooltipTrigger
                        render={
                          <td
                            className="border border-border p-0 text-center align-middle tabular-nums"
                            style={{ background }}
                            tabIndex={0}
                          >
                            <span className={'flex h-12 w-full items-center justify-center' + (textoClaro ? ' text-white' : ' text-foreground')}>
                              {celda.tasaAusentismo.valor.toFixed(1)}%
                            </span>
                          </td>
                        }
                      />
                      <TooltipContent>
                        {fila.sucursalNombre} · {celda.periodoLabel}: {celda.tasaAusentismo.numerador} días perdidos
                        de {celda.tasaAusentismo.denominador} programados
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
