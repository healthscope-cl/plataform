'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapCampanaRow, type Campana } from '@/lib/campanas/types'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const TIPOS = [
  'bienestar',
  'salud_mental',
  'ergonomia',
  'vacunacion',
  'pausas_activas',
  'prevencion',
  'sueno',
  'alimentacion',
  'liderazgo',
] as const

const TIPO_LABELS: Record<(typeof TIPOS)[number], string> = {
  bienestar: 'Bienestar',
  salud_mental: 'Salud mental',
  ergonomia: 'Ergonomía',
  vacunacion: 'Vacunación',
  pausas_activas: 'Pausas activas',
  prevencion: 'Prevención',
  sueno: 'Sueño',
  alimentacion: 'Alimentación',
  liderazgo: 'Liderazgo',
}

const schema = z.strictObject({
  tipo: z.enum(TIPOS),
  nombre: z.string().min(1, 'Requerido'),
  fechaInicio: z.string().min(1, 'Requerido'),
  fechaFin: z.string(),
  responsable: z.string().min(1, 'Requerido'),
  proveedor: z.string(),
  costo: z.string(),
  participantes: z.string(),
  preguntaSeguimientoId: z.string(),
})

type FormValues = z.infer<typeof schema>

export function CampanaSheet({
  tenantId,
  empresaId,
  actorId,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  onSaved: (campana: Campana) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: 'bienestar',
      nombre: '',
      fechaInicio: new Date().toISOString().slice(0, 10),
      fechaFin: '',
      responsable: '',
      proveedor: '',
      costo: '',
      participantes: '',
      preguntaSeguimientoId: '',
    },
  })

  async function onSubmit(values: FormValues) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('campanas')
      .insert({
        tenant_id: tenantId,
        empresa_id: empresaId,
        creada_por: actorId,
        tipo: values.tipo,
        nombre: values.nombre,
        fecha_inicio: values.fechaInicio,
        fecha_fin: values.fechaFin.trim() ? values.fechaFin : null,
        responsable: values.responsable,
        proveedor: values.proveedor.trim() ? values.proveedor : null,
        costo: values.costo.trim() ? Number(values.costo) : null,
        participantes: values.participantes.trim() ? Number(values.participantes) : null,
        pregunta_seguimiento_id: values.preguntaSeguimientoId.trim() ? values.preguntaSeguimientoId : null,
      })
      .select()
      .single()

    if (error || !data) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'campanas',
      entidadId: data.id,
      accion: 'crear',
      datosAntes: null,
      datosDespues: values,
    })

    onSaved(mapCampanaRow(data))
    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>Nueva campaña</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nueva campaña</SheetTitle>
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
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio">Fecha de inicio</Label>
              <Input id="fechaInicio" type="date" {...form.register('fechaInicio')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaFin">Fecha de fin (opcional)</Label>
              <Input id="fechaFin" type="date" {...form.register('fechaFin')} />
            </div>
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
              <Label htmlFor="proveedor">Proveedor (opcional)</Label>
              <Input id="proveedor" {...form.register('proveedor')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="costo">Costo (opcional)</Label>
              <Input id="costo" type="number" step="any" {...form.register('costo')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="participantes">Participantes (opcional)</Label>
              <Input id="participantes" type="number" step="1" {...form.register('participantes')} />
            </div>
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
