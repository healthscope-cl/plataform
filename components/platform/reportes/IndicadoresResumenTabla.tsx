import { CalendarX, Activity, TrendingDown, Clock, Repeat2, Wallet } from 'lucide-react'
import type { IndicadorResultados } from '@/lib/indicators/aggregate'
import { IndicadorCard } from '@/components/platform/dashboard/IndicadorCard'

export function IndicadoresResumenTabla({ indicadores }: { indicadores: IndicadorResultados }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <IndicadorCard
        titulo="Tasa de ausentismo"
        icon={CalendarX}
        resultado={indicadores.tasaAusentismo}
        sufijo="%"
        etiquetaNumerador="Días perdidos"
        etiquetaDenominador="Días programados"
      />
      <IndicadorCard
        titulo="Frecuencia"
        icon={Activity}
        resultado={indicadores.frecuencia}
        sufijo="%"
        etiquetaNumerador="Episodios"
        etiquetaDenominador="Dotación promedio"
      />
      <IndicadorCard
        titulo="Severidad"
        icon={TrendingDown}
        resultado={indicadores.severidad}
        sufijo=" días/episodio"
        etiquetaNumerador="Días perdidos"
        etiquetaDenominador="Episodios"
      />
      <IndicadorCard
        titulo="Duración promedio"
        icon={Clock}
        resultado={indicadores.duracionPromedio}
        sufijo=" días"
        etiquetaNumerador="Días perdidos"
        etiquetaDenominador="Episodios cerrados"
      />
      <IndicadorCard
        titulo="Reincidencia"
        icon={Repeat2}
        resultado={indicadores.reincidencia}
        sufijo="%"
        etiquetaNumerador="Personas con 2+ episodios"
        etiquetaDenominador="Personas con 1+ episodio"
      />
      <IndicadorCard
        titulo="Costo estimado"
        icon={Wallet}
        resultado={indicadores.costoEstimado}
        sufijo="$"
        etiquetaNumerador="Costo total"
        etiquetaDenominador="—"
      />
    </div>
  )
}
