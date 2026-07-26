import type { Auditoria, Usuario } from '@/lib/platform/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ENTIDAD_LABELS: Record<string, string> = {
  sucursales: 'Sucursales',
  unidades: 'Unidades',
  centros_costo: 'Centros de costo',
  cargos: 'Cargos',
  turnos: 'Turnos',
  usuarios: 'Usuarios',
  profesionales: 'Profesionales',
  intervenciones: 'Intervenciones',
  evaluaciones_ergonomicas: 'Evaluaciones ergonómicas',
  campanas: 'Campañas',
  eventos_seguridad: 'Eventos de seguridad',
  encuestas: 'Encuestas',
  reglas_alerta: 'Reglas de alerta',
  lineas_base: 'Líneas base',
}

export function AuditoriaTable({
  registros,
  usuarios,
}: {
  registros: Auditoria[]
  usuarios: Usuario[]
}) {
  const nombreActor = (actorId: string) =>
    usuarios.find((u) => u.id === actorId)?.nombre ?? actorId
  const nombreEntidad = (entidad: string) => ENTIDAD_LABELS[entidad] ?? entidad

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
            <TableCell>{nombreEntidad(registro.entidad)}</TableCell>
            <TableCell className="capitalize">{registro.accion}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
