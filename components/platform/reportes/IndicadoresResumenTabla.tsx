import { CalendarX, Activity, TrendingDown, Clock, Repeat2, Wallet } from 'lucide-react'
import type { IndicadorResultados } from '@/lib/indicators/aggregate'
import { INDICADOR_COLORS } from '@/lib/indicators/colors'
import { MAXIMO_GAUGE_TASA_AUSENTISMO, BANDAS_GAUGE_TASA_AUSENTISMO } from '@/lib/indicators/bandasGauge'
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
        color={INDICADOR_COLORS.tasaAusentismo}
        gauge={{ maximo: MAXIMO_GAUGE_TASA_AUSENTISMO, bandas: BANDAS_GAUGE_TASA_AUSENTISMO }}
      />
      <IndicadorCard
        titulo="Frecuencia"
        icon={Activity}
        resultado={indicadores.frecuencia}
        sufijo="%"
        etiquetaNumerador="Episodios"
        etiquetaDenominador="Dotación promedio"
        color={INDICADOR_COLORS.frecuencia}
      />
      <IndicadorCard
        titulo="Severidad"
        icon={TrendingDown}
        resultado={indicadores.severidad}
        sufijo=" días/episodio"
        etiquetaNumerador="Días perdidos"
        etiquetaDenominador="Episodios"
        color={INDICADOR_COLORS.severidad}
      />
      <IndicadorCard
        titulo="Duración promedio"
        icon={Clock}
        resultado={indicadores.duracionPromedio}
        sufijo=" días"
        etiquetaNumerador="Días perdidos"
        etiquetaDenominador="Episodios cerrados"
        color={INDICADOR_COLORS.duracionPromedio}
      />
      <IndicadorCard
        titulo="Reincidencia"
        icon={Repeat2}
        resultado={indicadores.reincidencia}
        sufijo="%"
        etiquetaNumerador="Personas con 2+ episodios"
        etiquetaDenominador="Personas con 1+ episodio"
        color={INDICADOR_COLORS.reincidencia}
      />
      <IndicadorCard
        titulo="Costo estimado"
        icon={Wallet}
        resultado={indicadores.costoEstimado}
        sufijo="$"
        etiquetaNumerador="Costo total"
        etiquetaDenominador="—"
        color={INDICADOR_COLORS.costoEstimado}
      />
    </div>
  )
}
