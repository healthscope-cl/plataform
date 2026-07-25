import { Info } from 'lucide-react'
import type { EstadoSuficiencia, IndiceSuficiencia } from '@/lib/suficiencia/calcular'

const ETIQUETAS: Record<EstadoSuficiencia, string> = {
  insuficiente: 'Datos insuficientes',
  limitado: 'Datos limitados',
  utilizable: 'Datos utilizables',
  solido: 'Datos sólidos',
}

export function SuficienciaBanner({ indice }: { indice: IndiceSuficiencia }) {
  if (indice.estado === 'solido') return null

  const precaucion = indice.estado === 'insuficiente' || indice.estado === 'limitado'

  return (
    <div className="flex gap-3 rounded-2xl border border-l-4 border-border border-l-primary bg-primary/5 p-4">
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-semibold text-foreground">{ETIQUETAS[indice.estado]}</p>
        {indice.razones.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {indice.razones.map((razon) => (
              <li key={razon}>{razon}</li>
            ))}
          </ul>
        ) : null}
        {indice.recomendaciones.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {indice.recomendaciones.map((recomendacion) => (
              <li key={recomendacion}>→ {recomendacion}</li>
            ))}
          </ul>
        ) : null}
        {precaucion ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Los indicadores de abajo deben interpretarse con precaución dado el tamaño de la muestra.
          </p>
        ) : null}
      </div>
    </div>
  )
}
