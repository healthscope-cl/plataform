'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { type Sucursal } from '@/lib/platform/types'
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
import { SucursalSheet } from './SucursalSheet'

export function SucursalesTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialSucursales,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialSucursales: Sucursal[]
}) {
  const [sucursales, setSucursales] = useState(initialSucursales)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(sucursal: Sucursal) {
    setSucursales((prev) => {
      const exists = prev.some((s) => s.id === sucursal.id)
      return exists ? prev.map((s) => (s.id === sucursal.id ? sucursal : s)) : [...prev, sucursal]
    })
  }

  async function handleDelete(sucursal: Sucursal) {
    const supabase = createClient()
    const { error } = await supabase.from('sucursales').delete().eq('id', sucursal.id)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'sucursales',
      entidadId: sucursal.id,
      accion: 'eliminar',
      datosAntes: sucursal,
      datosDespues: null,
    })

    setSucursales((prev) => prev.filter((s) => s.id !== sucursal.id))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <SucursalSheet
            tenantId={tenantId}
            empresaId={empresaId}
            actorId={actorId}
            onSaved={handleSaved}
          />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Ciudad</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sucursales.map((sucursal) => (
            <TableRow key={sucursal.id}>
              <TableCell>{sucursal.nombre}</TableCell>
              <TableCell>{sucursal.ciudad ?? '—'}</TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <SucursalSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    sucursal={sucursal}
                    onSaved={handleSaved}
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(sucursal)}>
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
