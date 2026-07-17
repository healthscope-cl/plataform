'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { type Unidad } from '@/lib/platform/types'
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
import { UnidadSheet } from './UnidadSheet'

export function UnidadesTable({
  tenantId,
  sucursalId,
  actorId,
  rolClave,
  initialUnidades,
}: {
  tenantId: string
  sucursalId: string
  actorId: string
  rolClave: string
  initialUnidades: Unidad[]
}) {
  const [unidades, setUnidades] = useState(initialUnidades)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(unidad: Unidad) {
    setUnidades((prev) => {
      const exists = prev.some((u) => u.id === unidad.id)
      return exists ? prev.map((u) => (u.id === unidad.id ? unidad : u)) : [...prev, unidad]
    })
  }

  async function handleDelete(unidad: Unidad) {
    const supabase = createClient()
    const { error } = await supabase.from('unidades').delete().eq('id', unidad.id)
    if (error) return
    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'unidades',
      entidadId: unidad.id,
      accion: 'eliminar',
      datosAntes: unidad,
      datosDespues: null,
    })
    setUnidades((prev) => prev.filter((u) => u.id !== unidad.id))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <UnidadSheet
            tenantId={tenantId}
            sucursalId={sucursalId}
            actorId={actorId}
            onSaved={handleSaved}
          />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {unidades.map((unidad) => (
            <TableRow key={unidad.id}>
              <TableCell>{unidad.nombre}</TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <UnidadSheet
                    tenantId={tenantId}
                    sucursalId={sucursalId}
                    actorId={actorId}
                    unidad={unidad}
                    onSaved={handleSaved}
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(unidad)}>
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
