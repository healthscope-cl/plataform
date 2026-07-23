import type { IndicadorResultados } from '@/lib/indicators/aggregate'
import type { IndicadorValor } from '@/lib/indicators/formulas'

const FILAS: Array<{ clave: keyof IndicadorResultados; etiqueta: string; sufijo: string; prefijo?: boolean }> = [
  { clave: 'tasaAusentismo', etiqueta: 'Tasa de ausentismo', sufijo: '%' },
  { clave: 'frecuencia', etiqueta: 'Frecuencia', sufijo: '%' },
  { clave: 'severidad', etiqueta: 'Severidad', sufijo: ' días/episodio' },
  { clave: 'duracionPromedio', etiqueta: 'Duración promedio', sufijo: ' días' },
  { clave: 'reincidencia', etiqueta: 'Reincidencia', sufijo: '%' },
  { clave: 'costoEstimado', etiqueta: 'Costo estimado', sufijo: '', prefijo: true },
]

function formatearValor(resultado: IndicadorValor, prefijo?: boolean, sufijo?: string): string {
  if ('suprimido' in resultado) return 'Grupo insuficiente para mostrar'
  const numero = prefijo ? `$${resultado.valor.toLocaleString('es-CL')}` : resultado.valor.toFixed(1)
  return `${numero}${sufijo ?? ''}`
}

export function IndicadoresResumenTabla({ indicadores }: { indicadores: IndicadorResultados }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="py-2 font-medium text-muted-foreground">Indicador</th>
          <th className="py-2 font-medium text-muted-foreground">Valor</th>
        </tr>
      </thead>
      <tbody>
        {FILAS.map((fila) => (
          <tr key={fila.clave} className="border-b border-border/50">
            <td className="py-2 text-foreground">{fila.etiqueta}</td>
            <td className="py-2 text-foreground">
              {formatearValor(indicadores[fila.clave], fila.prefijo, fila.sufijo)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
