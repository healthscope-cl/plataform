'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import type { Campana, EstadoCampana } from '@/lib/campanas/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const SIGUIENTE_ESTADO: Record<EstadoCampana, EstadoCampana | null> = {
  planificada: 'activa',
  activa: 'finalizada',
  finalizada: null,
}

const ESTADO_LABEL: Record<EstadoCampana, string> = {
  planificada: 'Planificada',
  activa: 'Activa',
  finalizada: 'Finalizada',
}

export function GestionarCampanaSheet({
  tenantId,
  actorId,
  campana,
  onSaved,
}: {
  tenantId: string
  actorId: string
  campana: Campana
  onSaved: (campana: Campana) => void
}) {
  const [open, setOpen] = useState(false)
  const [resultado, setResultado] = useState(campana.resultado ?? '')
  const [guardando, setGuardando] = useState(false)
  const siguiente = SIGUIENTE_ESTADO[campana.estado]

  async function handleAvanzar() {
    if (!siguiente) return
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('campanas')
      .update({ estado: siguiente, resultado: resultado || null })
      .eq('id', campana.id)
    setGuardando(false)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'campanas',
      entidadId: campana.id,
      accion: 'actualizar',
      datosAntes: { estado: campana.estado, resultado: campana.resultado },
      datosDespues: { estado: siguiente, resultado },
    })

    onSaved({ ...campana, estado: siguiente, resultado: resultado || null })
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>Gestionar</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{campana.nombre}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">Estado actual: {ESTADO_LABEL[campana.estado]}</p>
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
            <p className="text-sm text-muted-foreground">Esta campaña ya está finalizada.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
