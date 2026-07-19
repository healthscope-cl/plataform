import type { MappedRow } from '@/lib/ingestion/validate'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ImportPreviewTable({ rows, excludedRows }: { rows: MappedRow[]; excludedRows: Set<number> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fila</TableHead>
          <TableHead>RUT</TableHead>
          <TableHead>Fecha inicio</TableHead>
          <TableHead>Días</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Se importará</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={index}>
            <TableCell>{index + 1}</TableCell>
            <TableCell>{row.rut}</TableCell>
            <TableCell>{row.fechaInicio}</TableCell>
            <TableCell>{row.dias}</TableCell>
            <TableCell>{row.tipoAdministrativo}</TableCell>
            <TableCell>{excludedRows.has(index) ? 'No' : 'Sí'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
