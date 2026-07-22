'use client'

import { useMemo, useState } from 'react'
import { isAdminRole } from '@/lib/platform/roles'
import { calcularPuestosCriticos } from '@/lib/ergonomia/puestosCriticos'
import type { EvaluacionErgonomica } from '@/lib/ergonomia/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EvaluacionErgonomicaSheet } from './EvaluacionErgonomicaSheet'
import { GestionarEvaluacionSheet } from './GestionarEvaluacionSheet'

const NIVEL_RIESGO_LABELS: Record<EvaluacionErgonomica['nivelRiesgo'], string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
}

const ESTADO_LABEL: Record<EvaluacionErgonomica['estado'], string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
}

export function EvaluacionesErgonomicasTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialEvaluaciones,
  cargos,
  sucursales,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialEvaluaciones: EvaluacionErgonomica[]
  cargos: Array<{ id: string; nombre: string }>
  sucursales: Array<{ id: string; nombre: string }>
}) {
  const [evaluaciones, setEvaluaciones] = useState(initialEvaluaciones)
  const canEdit = isAdminRole(rolClave)

  const puestosCriticos = useMemo(() => calcularPuestosCriticos(evaluaciones), [evaluaciones])

  function handleSaved(evaluacion: EvaluacionErgonomica) {
    setEvaluaciones((prev) => {
      const existe = prev.some((e) => e.id === evaluacion.id)
      return existe ? prev.map((e) => (e.id === evaluacion.id ? evaluacion : e)) : [evaluacion, ...prev]
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-foreground">Puestos críticos</h2>
        {puestosCriticos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin puestos críticos detectados.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {puestosCriticos.map((critico) => (
              <div key={critico.evaluacionId} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-foreground">
                  {cargos.find((c) => c.id === critico.cargoId)?.nombre ?? critico.cargoId}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{critico.fecha}</p>
                <p className="mt-1 text-sm text-foreground">{critico.hallazgos}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {canEdit ? (
          <div className="flex justify-end">
            <EvaluacionErgonomicaSheet
              tenantId={tenantId}
              empresaId={empresaId}
              actorId={actorId}
              cargos={cargos}
              sucursales={sucursales}
              onSaved={handleSaved}
            />
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cargo</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Riesgo</TableHead>
              <TableHead>Estado</TableHead>
              {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {evaluaciones.map((evaluacion) => (
              <TableRow key={evaluacion.id}>
                <TableCell>{cargos.find((c) => c.id === evaluacion.cargoId)?.nombre ?? '—'}</TableCell>
                <TableCell>
                  {evaluacion.sucursalId ? (sucursales.find((s) => s.id === evaluacion.sucursalId)?.nombre ?? '—') : '—'}
                </TableCell>
                <TableCell>{evaluacion.fecha}</TableCell>
                <TableCell>
                  <Badge variant={evaluacion.nivelRiesgo === 'alto' ? 'destructive' : 'outline'}>
                    {NIVEL_RIESGO_LABELS[evaluacion.nivelRiesgo]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ESTADO_LABEL[evaluacion.estado]}</Badge>
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
                    <GestionarEvaluacionSheet
                      tenantId={tenantId}
                      actorId={actorId}
                      evaluacion={evaluacion}
                      onSaved={handleSaved}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            {evaluaciones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="py-4 text-center text-muted-foreground">
                  No hay evaluaciones registradas.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
