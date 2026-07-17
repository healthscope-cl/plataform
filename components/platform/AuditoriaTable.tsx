import type { Auditoria, Usuario } from '@/lib/platform/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function AuditoriaTable({
  registros,
  usuarios,
}: {
  registros: Auditoria[]
  usuarios: Usuario[]
}) {
  const nombreActor = (actorId: string) =>
    usuarios.find((u) => u.id === actorId)?.nombre ?? actorId

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Usuario</TableHead>
          <TableHead>Entidad</TableHead>
          <TableHead>Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {registros.map((registro) => (
          <TableRow key={registro.id}>
            <TableCell>{new Date(registro.createdAt).toLocaleString('es-CL')}</TableCell>
            <TableCell>{nombreActor(registro.actorId)}</TableCell>
            <TableCell>{registro.entidad}</TableCell>
            <TableCell className="capitalize">{registro.accion}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
