export function ImportSummary({ filasProcesadas, filasRechazadas }: { filasProcesadas: number; filasRechazadas: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="font-heading text-lg font-semibold text-foreground">Importación completada</p>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Filas procesadas</dt>
          <dd className="font-heading text-2xl font-semibold text-foreground">{filasProcesadas}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Filas rechazadas</dt>
          <dd className="font-heading text-2xl font-semibold text-foreground">{filasRechazadas}</dd>
        </div>
      </dl>
    </div>
  )
}
