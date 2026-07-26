import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export type AutoevaluacionFila = {
  id: string
  personaCodigo: string
  createdAt: string
  nivelRiesgo: 'bajo' | 'medio' | 'alto'
  recomendacion: string
  necesitaAyuda: boolean
}

const NIVEL_LABEL: Record<AutoevaluacionFila['nivelRiesgo'], string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
}

export function AutoevaluacionesTable({ autoevaluaciones }: { autoevaluaciones: AutoevaluacionFila[] }) {
  if (autoevaluaciones.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin autoevaluaciones de trabajadores todavía.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Persona</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Riesgo</TableHead>
          <TableHead>Recomendación</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {autoevaluaciones.map((fila) => (
          <TableRow key={fila.id}>
            <TableCell className="font-medium text-foreground">{fila.personaCodigo}</TableCell>
            <TableCell>{new Date(fila.createdAt).toLocaleDateString('es-CL')}</TableCell>
            <TableCell>
              <Badge variant={fila.nivelRiesgo === 'alto' ? 'destructive' : 'outline'}>
                {NIVEL_LABEL[fila.nivelRiesgo]}
              </Badge>
            </TableCell>
            <TableCell className="max-w-md whitespace-normal text-sm text-muted-foreground">
              {fila.recomendacion}
            </TableCell>
            <TableCell>
              {fila.necesitaAyuda ? (
                <Badge variant="destructive">Necesita ayuda</Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Resuelta sola</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
