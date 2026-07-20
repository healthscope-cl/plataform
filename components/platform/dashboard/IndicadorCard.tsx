import type { IndicadorValor } from '@/lib/indicators/formulas'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function formatValor(valor: number, sufijo: string) {
  return sufijo === '$' ? `$${valor.toLocaleString('es-CL')}` : `${valor.toFixed(1)}${sufijo}`
}

export function IndicadorCard({
  titulo,
  resultado,
  sufijo,
  etiquetaNumerador,
  etiquetaDenominador,
  cambio,
}: {
  titulo: string
  resultado: IndicadorValor
  sufijo: string
  etiquetaNumerador: string
  etiquetaDenominador: string
  cambio?: IndicadorValor | null
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      {'suprimido' in resultado ? (
        <p className="mt-2 text-sm text-muted-foreground">Grupo insuficiente para mostrar</p>
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger render={<div className="text-left" tabIndex={0} />}>
              <p className="mt-1 font-heading text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">
                {formatValor(resultado.valor, sufijo)}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              {etiquetaNumerador}: {resultado.numerador.toLocaleString('es-CL')} · {etiquetaDenominador}:{' '}
              {resultado.denominador.toLocaleString('es-CL')}
            </TooltipContent>
          </Tooltip>
          {cambio && !('suprimido' in cambio) ? (
            <p
              className={
                cambio.valor <= 0 ? 'mt-1 text-xs text-[#38D978]' : 'mt-1 text-xs text-destructive'
              }
            >
              {cambio.valor > 0 ? '+' : ''}
              {(cambio.valor * 100).toFixed(1)}% vs línea base
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
