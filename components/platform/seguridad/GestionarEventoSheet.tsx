'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import type { EventoSeguridad, EstadoEvento } from '@/lib/seguridad/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const SIGUIENTE_ESTADO: Record<EstadoEvento, EstadoEvento | null> = {
  abierto: 'en_seguimiento',
  en_seguimiento: 'cerrado',
  cerrado: null,
}

const ESTADO_LABEL: Record<EstadoEvento, string> = {
  abierto: 'Abierto',
  en_seguimiento: 'En seguimiento',
  cerrado: 'Cerrado',
}

export function GestionarEventoSheet({
  tenantId,
  actorId,
  evento,
  onSaved,
}: {
  tenantId: string
  actorId: string
  evento: EventoSeguridad
  onSaved: (evento: EventoSeguridad) => void
}) {
  const [open, setOpen] = useState(false)
  const [accionCorrectiva, setAccionCorrectiva] = useState(evento.accionCorrectiva ?? '')
  const [guardando, setGuardando] = useState(false)
  const siguiente = SIGUIENTE_ESTADO[evento.estado]

  async function handleAvanzar() {
    if (!siguiente) return
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('eventos_seguridad')
      .update({ estado: siguiente, accion_correctiva: accionCorrectiva || null })
      .eq('id', evento.id)
    setGuardando(false)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'eventos_seguridad',
      entidadId: evento.id,
      accion: 'actualizar',
      datosAntes: { estado: evento.estado, accionCorrectiva: evento.accionCorrectiva },
      datosDespues: { estado: siguiente, accionCorrectiva },
    })

    onSaved({ ...evento, estado: siguiente, accionCorrectiva: accionCorrectiva || null })
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>Gestionar</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{evento.descripcion}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">Estado actual: {ESTADO_LABEL[evento.estado]}</p>
          <div className="space-y-2">
            <Label htmlFor="accionCorrectiva">Acción correctiva</Label>
            <textarea
              id="accionCorrectiva"
              value={accionCorrectiva}
              onChange={(e) => setAccionCorrectiva(e.target.value)}
              disabled={!siguiente}
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {siguiente ? (
            <Button type="button" disabled={guardando} onClick={handleAvanzar}>
              {guardando ? 'Guardando…' : `Avanzar a "${ESTADO_LABEL[siguiente]}"`}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Este evento ya está cerrado.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
