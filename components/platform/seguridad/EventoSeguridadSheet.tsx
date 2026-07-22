'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapEventoSeguridadRow, type EventoSeguridad } from '@/lib/seguridad/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const schema = z.strictObject({
  tipo: z.enum(['accidente', 'incidente', 'cuasi_accidente', 'condicion_insegura']),
  descripcion: z.string().min(1, 'Requerido'),
  gravedad: z.enum(['leve', 'moderada', 'grave']),
  fecha: z.string().min(1, 'Requerido'),
  sucursalId: z.string().nullable(),
  unidadId: z.string().nullable(),
  cargoId: z.string().nullable(),
  turnoId: z.string().nullable(),
})

type FormValues = z.infer<typeof schema>

const TIPO_LABELS: Record<FormValues['tipo'], string> = {
  accidente: 'Accidente',
  incidente: 'Incidente',
  cuasi_accidente: 'Cuasi accidente',
  condicion_insegura: 'Condición insegura',
}

const GRAVEDAD_LABELS: Record<FormValues['gravedad'], string> = {
  leve: 'Leve',
  moderada: 'Moderada',
  grave: 'Grave',
}

export function EventoSeguridadSheet({
  tenantId,
  empresaId,
  actorId,
  sucursales,
  unidades,
  cargos,
  turnos,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  sucursales: Array<{ id: string; nombre: string }>
  unidades: Array<{ id: string; nombre: string; sucursalId: string }>
  cargos: Array<{ id: string; nombre: string }>
  turnos: Array<{ id: string; nombre: string }>
  onSaved: (evento: EventoSeguridad) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: 'incidente',
      descripcion: '',
      gravedad: 'leve',
      fecha: new Date().toISOString().slice(0, 10),
      sucursalId: null,
      unidadId: null,
      cargoId: null,
      turnoId: null,
    },
  })

  const sucursalId = form.watch('sucursalId')
  const unidadesDisponibles = sucursalId ? unidades.filter((u) => u.sucursalId === sucursalId) : unidades

  async function onSubmit(values: FormValues) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('eventos_seguridad')
      .insert({
        tenant_id: tenantId,
        empresa_id: empresaId,
        creada_por: actorId,
        tipo: values.tipo,
        descripcion: values.descripcion,
        gravedad: values.gravedad,
        fecha: values.fecha,
        sucursal_id: values.sucursalId,
        unidad_id: values.unidadId,
        cargo_id: values.cargoId,
        turno_id: values.turnoId,
      })
      .select()
      .single()

    if (error || !data) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'eventos_seguridad',
      entidadId: data.id,
      accion: 'crear',
      datosAntes: null,
      datosDespues: values,
    })

    onSaved(mapEventoSeguridadRow(data))
    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>Nuevo evento</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nuevo evento de seguridad</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={form.watch('tipo')} onValueChange={(v) => form.setValue('tipo', v as FormValues['tipo'])}>
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue>{(valor: FormValues['tipo']) => TIPO_LABELS[valor]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABELS) as FormValues['tipo'][]).map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {TIPO_LABELS[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Input id="descripcion" {...form.register('descripcion')} />
            {form.formState.errors.descripcion ? (
              <p className="text-sm text-destructive">{form.formState.errors.descripcion.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="gravedad">Gravedad</Label>
              <Select
                value={form.watch('gravedad')}
                onValueChange={(v) => form.setValue('gravedad', v as FormValues['gravedad'])}
              >
                <SelectTrigger id="gravedad" className="w-full">
                  <SelectValue>{(valor: FormValues['gravedad']) => GRAVEDAD_LABELS[valor]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leve">{GRAVEDAD_LABELS.leve}</SelectItem>
                  <SelectItem value="moderada">{GRAVEDAD_LABELS.moderada}</SelectItem>
                  <SelectItem value="grave">{GRAVEDAD_LABELS.grave}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" type="date" {...form.register('fecha')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="evento-sucursal">Sucursal</Label>
              <Select
                value={form.watch('sucursalId') ?? '__todas__'}
                onValueChange={(v) => {
                  form.setValue('sucursalId', v === '__todas__' ? null : v)
                  form.setValue('unidadId', null)
                }}
              >
                <SelectTrigger id="evento-sucursal" className="w-full">
                  <SelectValue>
                    {(valor: string) =>
                      valor === '__todas__' ? 'Sin especificar' : (sucursales.find((s) => s.id === valor)?.nombre ?? valor)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todas__">Sin especificar</SelectItem>
                  {sucursales.map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="evento-unidad">Unidad</Label>
              <Select
                value={form.watch('unidadId') ?? '__todas__'}
                onValueChange={(v) => form.setValue('unidadId', v === '__todas__' ? null : v)}
              >
                <SelectTrigger id="evento-unidad" className="w-full">
                  <SelectValue>
                    {(valor: string) =>
                      valor === '__todas__'
                        ? 'Sin especificar'
                        : (unidadesDisponibles.find((u) => u.id === valor)?.nombre ?? valor)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todas__">Sin especificar</SelectItem>
                  {unidadesDisponibles.map((unidad) => (
                    <SelectItem key={unidad.id} value={unidad.id}>
                      {unidad.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="evento-cargo">Cargo</Label>
              <Select
                value={form.watch('cargoId') ?? '__todos__'}
                onValueChange={(v) => form.setValue('cargoId', v === '__todos__' ? null : v)}
              >
                <SelectTrigger id="evento-cargo" className="w-full">
                  <SelectValue>
                    {(valor: string) =>
                      valor === '__todos__' ? 'Sin especificar' : (cargos.find((c) => c.id === valor)?.nombre ?? valor)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Sin especificar</SelectItem>
                  {cargos.map((cargo) => (
                    <SelectItem key={cargo.id} value={cargo.id}>
                      {cargo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="evento-turno">Turno</Label>
              <Select
                value={form.watch('turnoId') ?? '__todos__'}
                onValueChange={(v) => form.setValue('turnoId', v === '__todos__' ? null : v)}
              >
                <SelectTrigger id="evento-turno" className="w-full">
                  <SelectValue>
                    {(valor: string) =>
                      valor === '__todos__' ? 'Sin especificar' : (turnos.find((t) => t.id === valor)?.nombre ?? valor)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Sin especificar</SelectItem>
                  {turnos.map((turno) => (
                    <SelectItem key={turno.id} value={turno.id}>
                      {turno.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
