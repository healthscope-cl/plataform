'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapEvaluacionErgonomicaRow, type EvaluacionErgonomica } from '@/lib/ergonomia/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const schema = z.strictObject({
  cargoId: z.string().min(1, 'Requerido'),
  sucursalId: z.string().nullable(),
  fecha: z.string().min(1, 'Requerido'),
  nivelRiesgo: z.enum(['bajo', 'medio', 'alto']),
  hallazgos: z.string().min(1, 'Requerido'),
  recomendaciones: z.string(),
})

type FormValues = z.infer<typeof schema>

const NIVEL_RIESGO_LABELS: Record<FormValues['nivelRiesgo'], string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
}

export function EvaluacionErgonomicaSheet({
  tenantId,
  empresaId,
  actorId,
  cargos,
  sucursales,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  cargos: Array<{ id: string; nombre: string }>
  sucursales: Array<{ id: string; nombre: string }>
  onSaved: (evaluacion: EvaluacionErgonomica) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cargoId: cargos[0]?.id ?? '',
      sucursalId: null,
      fecha: new Date().toISOString().slice(0, 10),
      nivelRiesgo: 'bajo',
      hallazgos: '',
      recomendaciones: '',
    },
  })

  async function onSubmit(values: FormValues) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('evaluaciones_ergonomicas')
      .insert({
        tenant_id: tenantId,
        empresa_id: empresaId,
        creada_por: actorId,
        cargo_id: values.cargoId,
        sucursal_id: values.sucursalId,
        fecha: values.fecha,
        nivel_riesgo: values.nivelRiesgo,
        hallazgos: values.hallazgos,
        recomendaciones: values.recomendaciones || null,
      })
      .select()
      .single()

    if (error || !data) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'evaluaciones_ergonomicas',
      entidadId: data.id,
      accion: 'crear',
      datosAntes: null,
      datosDespues: values,
    })

    onSaved(mapEvaluacionErgonomicaRow(data))
    setOpen(false)
    form.reset()
  }

  if (cargos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Configura al menos un cargo en Organización antes de crear una evaluación.
      </p>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>Nueva evaluación</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nueva evaluación ergonómica</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="cargoId">Cargo</Label>
            <Select value={form.watch('cargoId')} onValueChange={(v) => form.setValue('cargoId', v as string)}>
              <SelectTrigger id="cargoId" className="w-full">
                <SelectValue>{(valor: string) => cargos.find((c) => c.id === valor)?.nombre ?? valor}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cargos.map((cargo) => (
                  <SelectItem key={cargo.id} value={cargo.id}>
                    {cargo.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="eval-sucursal">Sucursal</Label>
              <Select
                value={form.watch('sucursalId') ?? '__ninguna__'}
                onValueChange={(v) => form.setValue('sucursalId', v === '__ninguna__' ? null : v)}
              >
                <SelectTrigger id="eval-sucursal" className="w-full">
                  <SelectValue>
                    {(valor: string) =>
                      valor === '__ninguna__' ? 'Sin especificar' : (sucursales.find((s) => s.id === valor)?.nombre ?? valor)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ninguna__">Sin especificar</SelectItem>
                  {sucursales.map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eval-fecha">Fecha</Label>
              <Input id="eval-fecha" type="date" {...form.register('fecha')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nivelRiesgo">Nivel de riesgo</Label>
            <Select
              value={form.watch('nivelRiesgo')}
              onValueChange={(v) => form.setValue('nivelRiesgo', v as FormValues['nivelRiesgo'])}
            >
              <SelectTrigger id="nivelRiesgo" className="w-full">
                <SelectValue>{(valor: FormValues['nivelRiesgo']) => NIVEL_RIESGO_LABELS[valor]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bajo">{NIVEL_RIESGO_LABELS.bajo}</SelectItem>
                <SelectItem value="medio">{NIVEL_RIESGO_LABELS.medio}</SelectItem>
                <SelectItem value="alto">{NIVEL_RIESGO_LABELS.alto}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hallazgos">Hallazgos</Label>
            <textarea
              id="hallazgos"
              {...form.register('hallazgos')}
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {form.formState.errors.hallazgos ? (
              <p className="text-sm text-destructive">{form.formState.errors.hallazgos.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="recomendaciones">Recomendaciones (opcional)</Label>
            <textarea
              id="recomendaciones"
              {...form.register('recomendaciones')}
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
