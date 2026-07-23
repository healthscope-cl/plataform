import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { TIPO_LABELS } from '@/lib/ingestion/calidadLabels'

export type ErrorCalidadFila = {
  id: string
  fecha: string
  archivo: string
  fila: number
  severidad: 'critico' | 'advertencia'
  tipo: string
  mensaje: string
}

export function CalidadDatosTable({ errores }: { errores: ErrorCalidadFila[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Archivo</TableHead>
          <TableHead>Fila</TableHead>
          <TableHead>Severidad</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Mensaje</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {errores.map((error) => (
          <TableRow key={error.id}>
            <TableCell>{new Date(error.fecha).toLocaleDateString('es-CL')}</TableCell>
            <TableCell>{error.archivo}</TableCell>
            <TableCell>{error.fila}</TableCell>
            <TableCell>
              <Badge variant={error.severidad === 'critico' ? 'destructive' : 'outline'}>
                {error.severidad === 'critico' ? 'Crítico' : 'Advertencia'}
              </Badge>
            </TableCell>
            <TableCell>{TIPO_LABELS[error.tipo] ?? error.tipo}</TableCell>
            <TableCell>{error.mensaje}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
