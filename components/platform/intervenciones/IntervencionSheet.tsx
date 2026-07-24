'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapIntervencionRow, type Intervencion } from '@/lib/intervenciones/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'

const schema = z.strictObject({
  problema: z.string().min(1, 'Requerido'),
  objetivo: z.string().min(1, 'Requerido'),
  responsable: z.string().min(1, 'Requerido'),
  presupuesto: z.string(),
  fecha: z.string().min(1, 'Requerido'),
  indicadores: z.string().min(1, 'Requerido'),
  preguntaSeguimientoId: z.string(),
})

type FormValues = z.infer<typeof schema>

export function IntervencionSheet({
  tenantId,
  empresaId,
  actorId,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  onSaved: (intervencion: Intervencion) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      problema: '',
      objetivo: '',
      responsable: '',
      presupuesto: '',
      fecha: new Date().toISOString().slice(0, 10),
      indicadores: '',
      preguntaSeguimientoId: '',
    },
  })

  async function onSubmit(values: FormValues) {
    const supabase = createClient()
    const presupuesto = values.presupuesto.trim() ? Number(values.presupuesto) : null
    const { data, error } = await supabase
      .from('intervenciones')
      .insert({
        tenant_id: tenantId,
        empresa_id: empresaId,
        creada_por: actorId,
        problema: values.problema,
        objetivo: values.objetivo,
        responsable: values.responsable,
        presupuesto,
        fecha: values.fecha,
        indicadores: values.indicadores,
        pregunta_seguimiento_id: values.preguntaSeguimientoId.trim() ? values.preguntaSeguimientoId : null,
      })
      .select()
      .single()

    if (error || !data) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'intervenciones',
      entidadId: data.id,
      accion: 'crear',
      datosAntes: null,
      datosDespues: values,
    })

    onSaved(mapIntervencionRow(data))
    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>Nueva intervención</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nueva intervención</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="problema">Problema detectado</Label>
            <textarea
              id="problema"
              {...form.register('problema')}
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {form.formState.errors.problema ? (
              <p className="text-sm text-destructive">{form.formState.errors.problema.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="objetivo">Objetivo</Label>
            <textarea
              id="objetivo"
              {...form.register('objetivo')}
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {form.formState.errors.objetivo ? (
              <p className="text-sm text-destructive">{form.formState.errors.objetivo.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="responsable">Responsable</Label>
              <Input id="responsable" {...form.register('responsable')} />
              {form.formState.errors.responsable ? (
                <p className="text-sm text-destructive">{form.formState.errors.responsable.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="presupuesto">Presupuesto (opcional)</Label>
              <Input id="presupuesto" type="number" step="any" {...form.register('presupuesto')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" type="date" {...form.register('fecha')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="indicadores">Indicadores a medir</Label>
              <Input id="indicadores" {...form.register('indicadores')} />
              {form.formState.errors.indicadores ? (
                <p className="text-sm text-destructive">{form.formState.errors.indicadores.message}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preguntaSeguimiento">Pregunta de seguimiento (opcional)</Label>
            <Select
              value={form.watch('preguntaSeguimientoId') || '__ninguna__'}
              onValueChange={(v) => v !== null && form.setValue('preguntaSeguimientoId', v === '__ninguna__' ? '' : v)}
            >
              <SelectTrigger id="preguntaSeguimiento" className="w-full">
                <SelectValue>
                  {(valor: string) =>
                    valor === '__ninguna__' ? 'Ninguna' : (CATALOGO_PREGUNTAS.find((p) => p.id === valor)?.texto ?? valor)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ninguna__">Ninguna</SelectItem>
                {CATALOGO_PREGUNTAS.map((pregunta) => (
                  <SelectItem key={pregunta.id} value={pregunta.id}>
                    {pregunta.texto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
