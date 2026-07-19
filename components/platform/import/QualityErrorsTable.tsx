import type { RowError } from '@/lib/ingestion/validate'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export function QualityErrorsTable({ filaErrors }: { filaErrors: Map<number, RowError[]> }) {
  const entries = Array.from(filaErrors.entries())

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No se encontraron errores de calidad.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fila</TableHead>
          <TableHead>Severidad</TableHead>
          <TableHead>Mensaje</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.flatMap(([fila, errors]) =>
          errors.map((error, index) => (
            <TableRow key={`${fila}-${index}`}>
              <TableCell>{fila + 1}</TableCell>
              <TableCell>
                <Badge variant={error.severidad === 'critico' ? 'destructive' : 'secondary'}>
                  {error.severidad === 'critico' ? 'Crítico' : 'Advertencia'}
                </Badge>
              </TableCell>
              <TableCell>{error.mensaje}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
