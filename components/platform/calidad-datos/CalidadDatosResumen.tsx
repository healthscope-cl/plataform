import type { ErrorCalidad } from '@/lib/ingestion/types'
import { TIPO_LABELS } from '@/lib/ingestion/calidadLabels'

const TIPO_TIPS: Record<string, string> = {
  campo_obligatorio_faltante:
    'Revisa que la plantilla tenga todas las columnas requeridas antes de volver a importar.',
  fila_duplicada:
    'Verifica si el mismo archivo se importó más de una vez, o si hay filas repetidas dentro del mismo archivo.',
  duracion_invalida: 'Confirma que las fechas de inicio y fin de cada licencia sean coherentes entre sí.',
  tipo_no_reconocido:
    'El tipo de licencia del archivo no coincide con ningún tipo administrativo del catálogo — revisa la ortografía o el mapeo de columnas.',
  fecha_imposible: 'Alguna fecha del archivo no es una fecha válida (por ejemplo, fuera de rango o mal formateada).',
  periodo_superpuesto:
    'Dos licencias de la misma persona se superponen en el tiempo — confirma cuál es la correcta antes de reimportar.',
  grupo_no_reconocido:
    'El código de sucursal, unidad, cargo o turno del archivo no coincide con ningún registro existente.',
}

const TIP_GENERICO = 'Revisa el mensaje detallado de cada error en la tabla de abajo.'

export function CalidadDatosResumen({ errores }: { errores: ErrorCalidad[] }) {
  const conteos = new Map<string, number>()
  for (const error of errores) {
    conteos.set(error.tipo, (conteos.get(error.tipo) ?? 0) + 1)
  }
  const filas = Array.from(conteos.entries()).sort((a, b) => b[1] - a[1])

  if (filas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin errores de calidad en las importaciones recientes.</p>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filas.map(([tipo, cantidad]) => (
        <div key={tipo} className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{TIPO_LABELS[tipo] ?? tipo}</p>
          <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{cantidad}</p>
          <p className="mt-2 text-xs text-muted-foreground">{TIPO_TIPS[tipo] ?? TIP_GENERICO}</p>
        </div>
      ))}
    </div>
  )
}
