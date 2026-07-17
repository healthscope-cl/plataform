'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapCargoRow, type Cargo } from '@/lib/platform/types'
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

export function CargoSheet({
  tenantId,
  empresaId,
  actorId,
  cargo,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  cargo?: Cargo
  onSaved: (cargo: Cargo) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: cargo?.nombre ?? '' },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()

    if (cargo) {
      const { data, error } = await supabase
        .from('cargos')
        .update({ nombre: values.nombre })
        .eq('id', cargo.id)
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'cargos',
        entidadId: cargo.id,
        accion: 'actualizar',
        datosAntes: cargo,
        datosDespues: values,
      })
      onSaved(mapCargoRow(data))
    } else {
      const { data, error } = await supabase
        .from('cargos')
        .insert({ tenant_id: tenantId, empresa_id: empresaId, nombre: values.nombre })
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'cargos',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: values,
      })
      onSaved(mapCargoRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        {cargo ? 'Editar' : 'Nuevo cargo'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{cargo ? 'Editar cargo' : 'Nuevo cargo'}</SheetTitle>
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
