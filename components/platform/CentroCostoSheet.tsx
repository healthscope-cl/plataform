'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapCentroCostoRow, type CentroCosto } from '@/lib/platform/types'
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
  codigo: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
})

export function CentroCostoSheet({
  tenantId,
  empresaId,
  actorId,
  centroCosto,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  centroCosto?: CentroCosto
  onSaved: (centroCosto: CentroCosto) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigo: centroCosto?.codigo ?? '',
      nombre: centroCosto?.nombre ?? '',
    },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()

    if (centroCosto) {
      const { data, error } = await supabase
        .from('centros_costo')
        .update(values)
        .eq('id', centroCosto.id)
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'centros_costo',
        entidadId: centroCosto.id,
        accion: 'actualizar',
        datosAntes: centroCosto,
        datosDespues: values,
      })
      onSaved(mapCentroCostoRow(data))
    } else {
      const { data, error } = await supabase
        .from('centros_costo')
        .insert({ tenant_id: tenantId, empresa_id: empresaId, ...values })
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'centros_costo',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: values,
      })
      onSaved(mapCentroCostoRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        {centroCosto ? 'Editar' : 'Nuevo centro de costo'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{centroCosto ? 'Editar centro de costo' : 'Nuevo centro de costo'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="codigo">Código</Label>
            <Input id="codigo" {...form.register('codigo')} />
            {form.formState.errors.codigo ? (
              <p className="text-sm text-destructive">{form.formState.errors.codigo.message}</p>
            ) : null}
          </div>
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
