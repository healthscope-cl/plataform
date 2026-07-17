'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapTurnoRow, type Turno } from '@/lib/platform/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  horaInicio: z.string().optional(),
  horaFin: z.string().optional(),
})

export function TurnoSheet({
  tenantId,
  empresaId,
  actorId,
  turno,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  turno?: Turno
  onSaved: (turno: Turno) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: turno?.nombre ?? '',
      horaInicio: turno?.horaInicio ?? '',
      horaFin: turno?.horaFin ?? '',
    },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()
    const payload = {
      nombre: values.nombre,
      hora_inicio: values.horaInicio || null,
      hora_fin: values.horaFin || null,
    }

    if (turno) {
      const { data, error } = await supabase
        .from('turnos')
        .update(payload)
        .eq('id', turno.id)
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'turnos',
        entidadId: turno.id,
        accion: 'actualizar',
        datosAntes: turno,
        datosDespues: values,
      })
      onSaved(mapTurnoRow(data))
    } else {
      const { data, error } = await supabase
        .from('turnos')
        .insert({ tenant_id: tenantId, empresa_id: empresaId, ...payload })
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'turnos',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: values,
      })
      onSaved(mapTurnoRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        {turno ? 'Editar' : 'Nuevo turno'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{turno ? 'Editar turno' : 'Nuevo turno'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="horaInicio">Hora inicio</Label>
            <Input id="horaInicio" type="time" {...form.register('horaInicio')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="horaFin">Hora fin</Label>
            <Input id="horaFin" type="time" {...form.register('horaFin')} />
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
