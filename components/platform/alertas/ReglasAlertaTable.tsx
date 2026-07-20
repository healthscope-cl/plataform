'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { isAdminRole } from '@/lib/platform/roles'
import type { ReglaAlerta } from '@/lib/alertas/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReglaAlertaSheet } from './ReglaAlertaSheet'

const INDICADOR_LABELS: Record<ReglaAlerta['indicador'], string> = {
  tasaAusentismo: 'Tasa de ausentismo',
  frecuencia: 'Frecuencia',
  severidad: 'Severidad',
  duracionPromedio: 'Duración promedio',
  reincidencia: 'Reincidencia',
  costoEstimado: 'Costo estimado',
}

const OPERADOR_LABELS: Record<ReglaAlerta['operador'], string> = {
  mayor_que: '>',
  mayor_o_igual: '≥',
}

function describirAmbito(
  regla: ReglaAlerta,
  catalogos: {
    sucursales: Array<{ id: string; nombre: string }>
    unidades: Array<{ id: string; nombre: string }>
    cargos: Array<{ id: string; nombre: string }>
    turnos: Array<{ id: string; nombre: string }>
  }
): string {
  const partes: string[] = []
  if (regla.sucursalId) partes.push(catalogos.sucursales.find((s) => s.id === regla.sucursalId)?.nombre ?? '—')
  if (regla.unidadId) partes.push(catalogos.unidades.find((u) => u.id === regla.unidadId)?.nombre ?? '—')
  if (regla.cargoId) partes.push(catalogos.cargos.find((c) => c.id === regla.cargoId)?.nombre ?? '—')
  if (regla.turnoId) partes.push(catalogos.turnos.find((t) => t.id === regla.turnoId)?.nombre ?? '—')
  return partes.length > 0 ? partes.join(' · ') : 'Toda la empresa'
}

export function ReglasAlertaTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialReglas,
  sucursales,
  unidades,
  cargos,
  turnos,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialReglas: ReglaAlerta[]
  sucursales: Array<{ id: string; nombre: string }>
  unidades: Array<{ id: string; nombre: string; sucursalId: string }>
  cargos: Array<{ id: string; nombre: string }>
  turnos: Array<{ id: string; nombre: string }>
}) {
  const [reglas, setReglas] = useState(initialReglas)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(regla: ReglaAlerta) {
    setReglas((prev) => {
      const existe = prev.some((r) => r.id === regla.id)
      return existe ? prev.map((r) => (r.id === regla.id ? regla : r)) : [...prev, regla]
    })
  }

  async function handleToggleActiva(regla: ReglaAlerta) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('reglas_alerta')
      .update({ activa: !regla.activa })
      .eq('id', regla.id)
      .select()
      .single()

    if (error || !data) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'reglas_alerta',
      entidadId: regla.id,
      accion: 'actualizar',
      datosAntes: regla,
      datosDespues: { activa: !regla.activa },
    })

    setReglas((prev) => prev.map((r) => (r.id === regla.id ? { ...r, activa: !regla.activa } : r)))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <ReglaAlertaSheet
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
            <TableHead>Nombre</TableHead>
            <TableHead>Condición</TableHead>
            <TableHead>Ámbito</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reglas.map((regla) => (
            <TableRow key={regla.id}>
              <TableCell>{regla.nombre}</TableCell>
              <TableCell>
                {INDICADOR_LABELS[regla.indicador]} {OPERADOR_LABELS[regla.operador]} {regla.umbral}
              </TableCell>
              <TableCell>{describirAmbito(regla, { sucursales, unidades, cargos, turnos })}</TableCell>
              <TableCell>
                <Badge
                  variant={regla.activa ? 'default' : 'outline'}
                  className={regla.activa ? 'bg-success/10 text-success' : undefined}
                >
                  {regla.activa ? 'Activa' : 'Inactiva'}
                </Badge>
              </TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <ReglaAlertaSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    regla={regla}
                    sucursales={sucursales}
                    unidades={unidades}
                    cargos={cargos}
                    turnos={turnos}
                    onSaved={handleSaved}
                  />
                  <Button variant="outline" size="sm" onClick={() => handleToggleActiva(regla)}>
                    {regla.activa ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {reglas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 5 : 4} className="py-4 text-center text-muted-foreground">
                No hay reglas de alerta configuradas.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
