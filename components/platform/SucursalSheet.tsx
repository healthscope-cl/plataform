'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapSucursalRow, type Sucursal } from '@/lib/platform/types'
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
  ciudad: z.string().optional(),
})

export function SucursalSheet({
  tenantId,
  empresaId,
  actorId,
  sucursal,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  sucursal?: Sucursal
  onSaved: (sucursal: Sucursal) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: sucursal?.nombre ?? '', ciudad: sucursal?.ciudad ?? '' },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()

    if (sucursal) {
      const { data, error } = await supabase
        .from('sucursales')
        .update({ nombre: values.nombre, ciudad: values.ciudad || null })
        .eq('id', sucursal.id)
        .select()
        .single()

      if (error || !data) return

      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'sucursales',
        entidadId: sucursal.id,
        accion: 'actualizar',
        datosAntes: sucursal,
        datosDespues: values,
      })

      onSaved(mapSucursalRow(data))
    } else {
      const { data, error } = await supabase
        .from('sucursales')
        .insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          nombre: values.nombre,
          ciudad: values.ciudad || null,
        })
        .select()
        .single()

      if (error || !data) return

      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'sucursales',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: values,
      })

      onSaved(mapSucursalRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        {sucursal ? 'Editar' : 'Nueva sucursal'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{sucursal ? 'Editar sucursal' : 'Nueva sucursal'}</SheetTitle>
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
            <Label htmlFor="ciudad">Ciudad</Label>
            <Input id="ciudad" {...form.register('ciudad')} />
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
