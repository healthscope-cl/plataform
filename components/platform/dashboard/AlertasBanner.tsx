import type { AlertaDisparada } from '@/lib/alertas/evaluar'

const INDICADOR_LABELS: Record<string, string> = {
  tasaAusentismo: 'Tasa de ausentismo',
  frecuencia: 'Frecuencia',
  severidad: 'Severidad',
  duracionPromedio: 'Duración promedio',
  reincidencia: 'Reincidencia',
  costoEstimado: 'Costo estimado',
}

function describirAmbito(alerta: AlertaDisparada): string | null {
  const { regla } = alerta
  if (!regla.sucursalId && !regla.unidadId && !regla.cargoId && !regla.turnoId) return null
  return 'ámbito acotado'
}

function formatValor(valor: number, indicador: string) {
  if (indicador === 'costoEstimado') return `$${valor.toLocaleString('es-CL')}`
  return `${valor.toFixed(1)}`
}

export function AlertasBanner({ alertas }: { alertas: AlertaDisparada[] }) {
  if (alertas.length === 0) return null

  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-destructive">
        {alertas.length === 1 ? '1 alerta activa' : `${alertas.length} alertas activas`}
      </p>
      <ul className="mt-2 space-y-1">
        {alertas.map((alerta) => (
          <li key={alerta.regla.id} className="text-sm text-foreground">
            <span className="font-medium">{alerta.regla.nombre}</span> —{' '}
            {INDICADOR_LABELS[alerta.regla.indicador]}
            {describirAmbito(alerta) ? ` (${describirAmbito(alerta)})` : ''}:{' '}
            {formatValor(alerta.valorActual, alerta.regla.indicador)} supera el umbral de {alerta.regla.umbral}.
          </li>
        ))}
      </ul>
    </div>
  )
}
