'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { type CentroCosto } from '@/lib/platform/types'
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
import { CentroCostoSheet } from './CentroCostoSheet'

export function CentrosCostoTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialCentrosCosto,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialCentrosCosto: CentroCosto[]
}) {
  const [centrosCosto, setCentrosCosto] = useState(initialCentrosCosto)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(centroCosto: CentroCosto) {
    setCentrosCosto((prev) => {
      const exists = prev.some((c) => c.id === centroCosto.id)
      return exists
        ? prev.map((c) => (c.id === centroCosto.id ? centroCosto : c))
        : [...prev, centroCosto]
    })
  }

  async function handleDelete(centroCosto: CentroCosto) {
    const supabase = createClient()
    const { error } = await supabase.from('centros_costo').delete().eq('id', centroCosto.id)
    if (error) return
    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'centros_costo',
      entidadId: centroCosto.id,
      accion: 'eliminar',
      datosAntes: centroCosto,
      datosDespues: null,
    })
    setCentrosCosto((prev) => prev.filter((c) => c.id !== centroCosto.id))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <CentroCostoSheet
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
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {centrosCosto.map((centroCosto) => (
            <TableRow key={centroCosto.id}>
              <TableCell>{centroCosto.codigo}</TableCell>
              <TableCell>{centroCosto.nombre}</TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <CentroCostoSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    centroCosto={centroCosto}
                    onSaved={handleSaved}
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(centroCosto)}>
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
