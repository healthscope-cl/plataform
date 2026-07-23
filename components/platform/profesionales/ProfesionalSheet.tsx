'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapProfesionalRow, type Profesional } from '@/lib/profesionales/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const TIPOS = [
  'psicologo',
  'kinesiologo',
  'ergonomo',
  'terapeuta_ocupacional',
  'nutricionista',
  'medico_laboral',
  'prevencionista',
  'podologo',
] as const

const TIPO_LABELS: Record<(typeof TIPOS)[number], string> = {
  psicologo: 'Psicólogo',
  kinesiologo: 'Kinesiólogo',
  ergonomo: 'Ergónomo',
  terapeuta_ocupacional: 'Terapeuta ocupacional',
  nutricionista: 'Nutricionista',
  medico_laboral: 'Médico laboral',
  prevencionista: 'Prevencionista',
  podologo: 'Podólogo',
}

const schema = z.strictObject({
  tipo: z.enum(TIPOS),
  nombre: z.string().min(1, 'Requerido'),
  email: z.string(),
  telefono: z.string(),
  notas: z.string(),
})

type FormValues = z.infer<typeof schema>

export function ProfesionalSheet({
  tenantId,
  empresaId,
  actorId,
  profesional,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  profesional?: Profesional
  onSaved: (profesional: Profesional) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: profesional?.tipo ?? 'psicologo',
      nombre: profesional?.nombre ?? '',
      email: profesional?.email ?? '',
      telefono: profesional?.telefono ?? '',
      notas: profesional?.notas ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    const supabase = createClient()
    const payload = {
      tipo: values.tipo,
      nombre: values.nombre,
      email: values.email.trim() ? values.email : null,
      telefono: values.telefono.trim() ? values.telefono : null,
      notas: values.notas.trim() ? values.notas : null,
    }

    if (profesional) {
      const { data, error } = await supabase
        .from('profesionales')
        .update(payload)
        .eq('id', profesional.id)
        .select()
        .single()

      if (error || !data) return

      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'profesionales',
        entidadId: profesional.id,
        accion: 'actualizar',
        datosAntes: profesional,
        datosDespues: payload,
      })

      onSaved(mapProfesionalRow(data))
    } else {
      const { data, error } = await supabase
        .from('profesionales')
        .insert({ ...payload, tenant_id: tenantId, empresa_id: empresaId, creada_por: actorId })
        .select()
        .single()

      if (error || !data) return

      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'profesionales',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: payload,
      })

      onSaved(mapProfesionalRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant={profesional ? 'outline' : 'default'} size="sm" />}>
        {profesional ? 'Editar' : 'Nuevo profesional'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{profesional ? 'Editar profesional' : 'Nuevo profesional'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={form.watch('tipo')} onValueChange={(v) => form.setValue('tipo', v as FormValues['tipo'])}>
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue>{(valor: FormValues['tipo']) => TIPO_LABELS[valor]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {TIPO_LABELS[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input id="email" type="email" {...form.register('email')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono (opcional)</Label>
              <Input id="telefono" {...form.register('telefono')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <textarea
              id="notas"
              {...form.register('notas')}
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
