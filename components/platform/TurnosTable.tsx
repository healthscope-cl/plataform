'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { type Turno } from '@/lib/platform/types'
import { isAdminRole } from '@/lib/platform/roles'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { TurnoSheet } from './TurnoSheet'

export function TurnosTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialTurnos,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialTurnos: Turno[]
}) {
  const [turnos, setTurnos] = useState(initialTurnos)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(turno: Turno) {
    setTurnos((prev) => {
      const exists = prev.some((t) => t.id === turno.id)
      return exists ? prev.map((t) => (t.id === turno.id ? turno : t)) : [...prev, turno]
    })
  }

  async function handleDelete(turno: Turno) {
    const supabase = createClient()
    const { error } = await supabase.from('turnos').delete().eq('id', turno.id)
    if (error) return
    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'turnos',
      entidadId: turno.id,
      accion: 'eliminar',
      datosAntes: turno,
      datosDespues: null,
    })
    setTurnos((prev) => prev.filter((t) => t.id !== turno.id))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <TurnoSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Hora inicio</TableHead>
            <TableHead>Hora fin</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {turnos.map((turno) => (
            <TableRow key={turno.id}>
              <TableCell>{turno.nombre}</TableCell>
              <TableCell>{turno.horaInicio ?? '—'}</TableCell>
              <TableCell>{turno.horaFin ?? '—'}</TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <TurnoSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    turno={turno}
                    onSaved={handleSaved}
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(turno)}>
                    Eliminar
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
