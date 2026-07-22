'use client'

import { useState } from 'react'
import { isAdminRole } from '@/lib/platform/roles'
import type { Campana } from '@/lib/campanas/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CampanaSheet } from './CampanaSheet'
import { GestionarCampanaSheet } from './GestionarCampanaSheet'

const TIPO_LABELS: Record<Campana['tipo'], string> = {
  bienestar: 'Bienestar',
  salud_mental: 'Salud mental',
  ergonomia: 'Ergonomía',
  vacunacion: 'Vacunación',
  pausas_activas: 'Pausas activas',
  prevencion: 'Prevención',
  sueno: 'Sueño',
  alimentacion: 'Alimentación',
  liderazgo: 'Liderazgo',
}

const ESTADO_LABEL: Record<Campana['estado'], string> = {
  planificada: 'Planificada',
  activa: 'Activa',
  finalizada: 'Finalizada',
}

export function CampanasTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialCampanas,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialCampanas: Campana[]
}) {
  const [campanas, setCampanas] = useState(initialCampanas)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(campana: Campana) {
    setCampanas((prev) => {
      const existe = prev.some((c) => c.id === campana.id)
      return existe ? prev.map((c) => (c.id === campana.id ? campana : c)) : [campana, ...prev]
    })
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <CampanaSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Fecha de inicio</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {campanas.map((campana) => (
            <TableRow key={campana.id}>
              <TableCell>{TIPO_LABELS[campana.tipo]}</TableCell>
              <TableCell>{campana.nombre}</TableCell>
              <TableCell>{campana.fechaInicio}</TableCell>
              <TableCell>
                <Badge variant="outline">{ESTADO_LABEL[campana.estado]}</Badge>
              </TableCell>
              {canEdit ? (
                <TableCell className="text-right">
                  <GestionarCampanaSheet
                    tenantId={tenantId}
                    actorId={actorId}
                    campana={campana}
                    onSaved={handleSaved}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {campanas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 5 : 4} className="py-4 text-center text-muted-foreground">
                No hay campañas registradas.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
