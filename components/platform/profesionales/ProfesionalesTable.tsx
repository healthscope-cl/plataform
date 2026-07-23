'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { isAdminRole } from '@/lib/platform/roles'
import type { Profesional } from '@/lib/profesionales/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProfesionalSheet } from './ProfesionalSheet'

const TIPO_LABELS: Record<Profesional['tipo'], string> = {
  psicologo: 'Psicólogo',
  kinesiologo: 'Kinesiólogo',
  ergonomo: 'Ergónomo',
  terapeuta_ocupacional: 'Terapeuta ocupacional',
  nutricionista: 'Nutricionista',
  medico_laboral: 'Médico laboral',
  prevencionista: 'Prevencionista',
  podologo: 'Podólogo',
}

export function ProfesionalesTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialProfesionales,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialProfesionales: Profesional[]
}) {
  const [profesionales, setProfesionales] = useState(initialProfesionales)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(profesional: Profesional) {
    setProfesionales((prev) => {
      const existe = prev.some((p) => p.id === profesional.id)
      return existe ? prev.map((p) => (p.id === profesional.id ? profesional : p)) : [...prev, profesional]
    })
  }

  async function handleToggleActivo(profesional: Profesional) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('profesionales')
      .update({ activo: !profesional.activo })
      .eq('id', profesional.id)
      .select()
      .single()

    if (error || !data) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'profesionales',
      entidadId: profesional.id,
      accion: 'actualizar',
      datosAntes: profesional,
      datosDespues: { activo: !profesional.activo },
    })

    setProfesionales((prev) => prev.map((p) => (p.id === profesional.id ? { ...p, activo: !profesional.activo } : p)))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <ProfesionalSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {profesionales.map((profesional) => (
            <TableRow key={profesional.id}>
              <TableCell>{TIPO_LABELS[profesional.tipo]}</TableCell>
              <TableCell>{profesional.nombre}</TableCell>
              <TableCell>{profesional.email ?? '—'}</TableCell>
              <TableCell>{profesional.telefono ?? '—'}</TableCell>
              <TableCell>
                <Badge
                  variant={profesional.activo ? 'default' : 'outline'}
                  className={profesional.activo ? 'bg-success/10 text-success' : undefined}
                >
                  {profesional.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <ProfesionalSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    profesional={profesional}
                    onSaved={handleSaved}
                  />
                  <Button variant="outline" size="sm" onClick={() => handleToggleActivo(profesional)}>
                    {profesional.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {profesionales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 6 : 5} className="py-4 text-center text-muted-foreground">
                No hay profesionales registrados.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
