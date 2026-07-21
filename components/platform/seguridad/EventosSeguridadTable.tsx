'use client'

import { useState } from 'react'
import { isAdminRole } from '@/lib/platform/roles'
import type { EventoSeguridad } from '@/lib/seguridad/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EventoSeguridadSheet } from './EventoSeguridadSheet'
import { GestionarEventoSheet } from './GestionarEventoSheet'

const TIPO_LABELS: Record<EventoSeguridad['tipo'], string> = {
  accidente: 'Accidente',
  incidente: 'Incidente',
  cuasi_accidente: 'Cuasi accidente',
  condicion_insegura: 'Condición insegura',
}

const ESTADO_LABEL: Record<EventoSeguridad['estado'], string> = {
  abierto: 'Abierto',
  en_seguimiento: 'En seguimiento',
  cerrado: 'Cerrado',
}

export function EventosSeguridadTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialEventos,
  sucursales,
  unidades,
  cargos,
  turnos,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialEventos: EventoSeguridad[]
  sucursales: Array<{ id: string; nombre: string }>
  unidades: Array<{ id: string; nombre: string; sucursalId: string }>
  cargos: Array<{ id: string; nombre: string }>
  turnos: Array<{ id: string; nombre: string }>
}) {
  const [eventos, setEventos] = useState(initialEventos)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(evento: EventoSeguridad) {
    setEventos((prev) => {
      const existe = prev.some((e) => e.id === evento.id)
      return existe ? prev.map((e) => (e.id === evento.id ? evento : e)) : [evento, ...prev]
    })
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <EventoSeguridadSheet
            tenantId={tenantId}
            empresaId={empresaId}
            actorId={actorId}
            sucursales={sucursales}
            unidades={unidades}
            cargos={cargos}
            turnos={turnos}
            onSaved={handleSaved}
          />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Gravedad</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {eventos.map((evento) => (
            <TableRow key={evento.id}>
              <TableCell>{TIPO_LABELS[evento.tipo]}</TableCell>
              <TableCell>{evento.descripcion}</TableCell>
              <TableCell>
                <Badge variant={evento.gravedad === 'grave' ? 'destructive' : 'outline'}>{evento.gravedad}</Badge>
              </TableCell>
              <TableCell>{evento.fecha}</TableCell>
              <TableCell>
                <Badge variant="outline">{ESTADO_LABEL[evento.estado]}</Badge>
              </TableCell>
              {canEdit ? (
                <TableCell className="text-right">
                  <GestionarEventoSheet tenantId={tenantId} actorId={actorId} evento={evento} onSaved={handleSaved} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {eventos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 6 : 5} className="py-4 text-center text-muted-foreground">
                No hay eventos registrados.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
