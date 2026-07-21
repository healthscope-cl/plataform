'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
import { mapEncuestaRow, type Encuesta } from '@/lib/encuestas/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const schema = z.object({
  titulo: z.string().min(1, 'Requerido'),
  descripcion: z.string().optional(),
  preguntaIds: z.array(z.string()).min(1, 'Selecciona al menos una pregunta'),
  fechaApertura: z.string().optional(),
  fechaCierre: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function EncuestaSheet({
  tenantId,
  empresaId,
  actorId,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  onSaved: (encuesta: Encuesta) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { titulo: '', descripcion: '', preguntaIds: [], fechaApertura: '', fechaCierre: '' },
  })

  const preguntaIds = form.watch('preguntaIds')

  function togglePregunta(id: string) {
    const actuales = form.getValues('preguntaIds')
    form.setValue('preguntaIds', actuales.includes(id) ? actuales.filter((p) => p !== id) : [...actuales, id])
  }

  async function onSubmit(values: FormValues) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('encuestas')
      .insert({
        tenant_id: tenantId,
        empresa_id: empresaId,
        creada_por: actorId,
        titulo: values.titulo,
        descripcion: values.descripcion || null,
        pregunta_ids: values.preguntaIds,
        fecha_apertura: values.fechaApertura || null,
        fecha_cierre: values.fechaCierre || null,
      })
      .select()
      .single()

    if (error || !data) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'encuestas',
      entidadId: data.id,
      accion: 'crear',
      datosAntes: null,
      datosDespues: values,
    })

    onSaved(mapEncuestaRow(data))
    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>Nueva encuesta</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nueva encuesta</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" {...form.register('titulo')} />
            {form.formState.errors.titulo ? (
              <p className="text-sm text-destructive">{form.formState.errors.titulo.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Input id="descripcion" {...form.register('descripcion')} />
          </div>
          <div className="space-y-2">
            <Label>Preguntas</Label>
            <div className="space-y-2">
              {CATALOGO_PREGUNTAS.map((pregunta) => (
                <label key={pregunta.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={preguntaIds.includes(pregunta.id)}
                    onChange={() => togglePregunta(pregunta.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {pregunta.texto}
                </label>
              ))}
            </div>
            {form.formState.errors.preguntaIds ? (
              <p className="text-sm text-destructive">{form.formState.errors.preguntaIds.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fechaApertura">Fecha de apertura</Label>
              <Input id="fechaApertura" type="date" {...form.register('fechaApertura')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaCierre">Fecha de cierre</Label>
              <Input id="fechaCierre" type="date" {...form.register('fechaCierre')} />
            </div>
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
