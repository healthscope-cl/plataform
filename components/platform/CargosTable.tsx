'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { type Cargo } from '@/lib/platform/types'
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
import { CargoSheet } from './CargoSheet'

export function CargosTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialCargos,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialCargos: Cargo[]
}) {
  const [cargos, setCargos] = useState(initialCargos)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(cargo: Cargo) {
    setCargos((prev) => {
      const exists = prev.some((c) => c.id === cargo.id)
      return exists ? prev.map((c) => (c.id === cargo.id ? cargo : c)) : [...prev, cargo]
    })
  }

  async function handleDelete(cargo: Cargo) {
    const supabase = createClient()
    const { error } = await supabase.from('cargos').delete().eq('id', cargo.id)
    if (error) return
    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'cargos',
      entidadId: cargo.id,
      accion: 'eliminar',
      datosAntes: cargo,
      datosDespues: null,
    })
    setCargos((prev) => prev.filter((c) => c.id !== cargo.id))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <CargoSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
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
          {cargos.map((cargo) => (
            <TableRow key={cargo.id}>
              <TableCell>{cargo.nombre}</TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <CargoSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    cargo={cargo}
                    onSaved={handleSaved}
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(cargo)}>
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
