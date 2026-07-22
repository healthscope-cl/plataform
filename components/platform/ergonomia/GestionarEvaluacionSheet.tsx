'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import type { EvaluacionErgonomica, EstadoEvaluacion } from '@/lib/ergonomia/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const SIGUIENTE_ESTADO: Record<EstadoEvaluacion, EstadoEvaluacion | null> = {
  pendiente: 'en_progreso',
  en_progreso: 'resuelto',
  resuelto: null,
}

const ESTADO_LABEL: Record<EstadoEvaluacion, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
}

export function GestionarEvaluacionSheet({
  tenantId,
  actorId,
  evaluacion,
  onSaved,
}: {
  tenantId: string
  actorId: string
  evaluacion: EvaluacionErgonomica
  onSaved: (evaluacion: EvaluacionErgonomica) => void
}) {
  const [open, setOpen] = useState(false)
  const [recomendaciones, setRecomendaciones] = useState(evaluacion.recomendaciones ?? '')
  const [guardando, setGuardando] = useState(false)
  const siguiente = SIGUIENTE_ESTADO[evaluacion.estado]

  async function handleAvanzar() {
    if (!siguiente) return
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('evaluaciones_ergonomicas')
      .update({ estado: siguiente, recomendaciones: recomendaciones || null })
      .eq('id', evaluacion.id)
    setGuardando(false)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'evaluaciones_ergonomicas',
      entidadId: evaluacion.id,
      accion: 'actualizar',
      datosAntes: { estado: evaluacion.estado, recomendaciones: evaluacion.recomendaciones },
      datosDespues: { estado: siguiente, recomendaciones },
    })

    onSaved({ ...evaluacion, estado: siguiente, recomendaciones: recomendaciones || null })
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>Gestionar</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{evaluacion.hallazgos}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">Estado actual: {ESTADO_LABEL[evaluacion.estado]}</p>
          <div className="space-y-2">
            <Label htmlFor="gestion-recomendaciones">Recomendaciones</Label>
            <textarea
              id="gestion-recomendaciones"
              value={recomendaciones}
              onChange={(e) => setRecomendaciones(e.target.value)}
              disabled={!siguiente}
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {siguiente ? (
            <Button type="button" disabled={guardando} onClick={handleAvanzar}>
              {guardando ? 'Guardando…' : `Avanzar a "${ESTADO_LABEL[siguiente]}"`}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Esta evaluación ya está resuelta.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
