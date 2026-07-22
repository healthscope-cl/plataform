'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import type { Intervencion, EstadoIntervencion } from '@/lib/intervenciones/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const SIGUIENTE_ESTADO: Record<EstadoIntervencion, EstadoIntervencion | null> = {
  planificada: 'en_ejecucion',
  en_ejecucion: 'completada',
  completada: null,
}

const ESTADO_LABEL: Record<EstadoIntervencion, string> = {
  planificada: 'Planificada',
  en_ejecucion: 'En ejecución',
  completada: 'Completada',
}

export function GestionarIntervencionSheet({
  tenantId,
  actorId,
  intervencion,
  onSaved,
}: {
  tenantId: string
  actorId: string
  intervencion: Intervencion
  onSaved: (intervencion: Intervencion) => void
}) {
  const [open, setOpen] = useState(false)
  const [resultado, setResultado] = useState(intervencion.resultado ?? '')
  const [guardando, setGuardando] = useState(false)
  const siguiente = SIGUIENTE_ESTADO[intervencion.estado]

  async function handleAvanzar() {
    if (!siguiente) return
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('intervenciones')
      .update({ estado: siguiente, resultado: resultado || null })
      .eq('id', intervencion.id)
    setGuardando(false)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'intervenciones',
      entidadId: intervencion.id,
      accion: 'actualizar',
      datosAntes: { estado: intervencion.estado, resultado: intervencion.resultado },
      datosDespues: { estado: siguiente, resultado },
    })

    onSaved({ ...intervencion, estado: siguiente, resultado: resultado || null })
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>Gestionar</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{intervencion.objetivo}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">Estado actual: {ESTADO_LABEL[intervencion.estado]}</p>
          <div className="space-y-2">
            <Label htmlFor="gestion-resultado">Resultado</Label>
            <textarea
              id="gestion-resultado"
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              disabled={!siguiente}
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {siguiente ? (
            <Button type="button" disabled={guardando} onClick={handleAvanzar}>
              {guardando ? 'Guardando…' : `Avanzar a "${ESTADO_LABEL[siguiente]}"`}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Esta intervención ya está completada.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
