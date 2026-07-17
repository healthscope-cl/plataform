'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapUnidadRow, type Unidad } from '@/lib/platform/types'
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

const schema = z.object({ nombre: z.string().min(1, 'Requerido') })

export function UnidadSheet({
  tenantId,
  sucursalId,
  actorId,
  unidad,
  onSaved,
}: {
  tenantId: string
  sucursalId: string
  actorId: string
  unidad?: Unidad
  onSaved: (unidad: Unidad) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: unidad?.nombre ?? '' },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()

    if (unidad) {
      const { data, error } = await supabase
        .from('unidades')
        .update({ nombre: values.nombre })
        .eq('id', unidad.id)
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'unidades',
        entidadId: unidad.id,
        accion: 'actualizar',
        datosAntes: unidad,
        datosDespues: values,
      })
      onSaved(mapUnidadRow(data))
    } else {
      const { data, error } = await supabase
        .from('unidades')
        .insert({ tenant_id: tenantId, sucursal_id: sucursalId, nombre: values.nombre })
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'unidades',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: values,
      })
      onSaved(mapUnidadRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        {unidad ? 'Editar' : 'Nueva unidad'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{unidad ? 'Editar unidad' : 'Nueva unidad'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
