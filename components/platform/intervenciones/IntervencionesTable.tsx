'use client'

import { useState } from 'react'
import Link from 'next/link'
import { isAdminRole } from '@/lib/platform/roles'
import type { Intervencion } from '@/lib/intervenciones/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IntervencionSheet } from './IntervencionSheet'
import { GestionarIntervencionSheet } from './GestionarIntervencionSheet'

const ESTADO_LABEL: Record<Intervencion['estado'], string> = {
  planificada: 'Planificada',
  en_ejecucion: 'En ejecución',
  completada: 'Completada',
}

export function IntervencionesTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialIntervenciones,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialIntervenciones: Intervencion[]
}) {
  const [intervenciones, setIntervenciones] = useState(initialIntervenciones)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(intervencion: Intervencion) {
    setIntervenciones((prev) => {
      const existe = prev.some((i) => i.id === intervencion.id)
      return existe ? prev.map((i) => (i.id === intervencion.id ? intervencion : i)) : [intervencion, ...prev]
    })
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <IntervencionSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Problema</TableHead>
            <TableHead>Objetivo</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {intervenciones.map((intervencion) => (
            <TableRow key={intervencion.id}>
              <TableCell>{intervencion.problema}</TableCell>
              <TableCell>{intervencion.objetivo}</TableCell>
              <TableCell>{intervencion.responsable}</TableCell>
              <TableCell>{intervencion.fecha}</TableCell>
              <TableCell>
                <Badge variant="outline">{ESTADO_LABEL[intervencion.estado]}</Badge>
              </TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <Link href={`/plataforma/intervenciones/${intervencion.id}`}>
                    <Button type="button" variant="outline" size="sm">
                      Ver seguimiento
                    </Button>
                  </Link>
                  <GestionarIntervencionSheet
                    tenantId={tenantId}
                    actorId={actorId}
                    intervencion={intervencion}
                    onSaved={handleSaved}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {intervenciones.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 6 : 5} className="py-4 text-center text-muted-foreground">
                No hay intervenciones registradas.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
