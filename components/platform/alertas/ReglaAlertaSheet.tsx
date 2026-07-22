'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapReglaAlertaRow, type ReglaAlerta } from '@/lib/alertas/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const INDICADORES = [
  { value: 'tasaAusentismo', label: 'Tasa de ausentismo' },
  { value: 'frecuencia', label: 'Frecuencia' },
  { value: 'severidad', label: 'Severidad' },
  { value: 'duracionPromedio', label: 'Duración promedio' },
  { value: 'reincidencia', label: 'Reincidencia' },
  { value: 'costoEstimado', label: 'Costo estimado' },
] as const

const OPERADOR_LABELS = {
  mayor_que: 'Mayor que',
  mayor_o_igual: 'Mayor o igual a',
} as const

const schema = z.strictObject({
  nombre: z.string().min(1, 'Requerido'),
  indicador: z.enum([
    'tasaAusentismo',
    'frecuencia',
    'severidad',
    'duracionPromedio',
    'reincidencia',
    'costoEstimado',
  ]),
  operador: z.enum(['mayor_que', 'mayor_o_igual']),
  umbral: z.number(),
  sucursalId: z.string().nullable(),
  unidadId: z.string().nullable(),
  cargoId: z.string().nullable(),
  turnoId: z.string().nullable(),
})

export function ReglaAlertaSheet({
  tenantId,
  empresaId,
  actorId,
  regla,
  sucursales,
  unidades,
  cargos,
  turnos,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  regla?: ReglaAlerta
  sucursales: Array<{ id: string; nombre: string }>
  unidades: Array<{ id: string; nombre: string; sucursalId: string }>
  cargos: Array<{ id: string; nombre: string }>
  turnos: Array<{ id: string; nombre: string }>
  onSaved: (regla: ReglaAlerta) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: regla?.nombre ?? '',
      indicador: regla?.indicador ?? 'tasaAusentismo',
      operador: regla?.operador ?? 'mayor_que',
      umbral: regla?.umbral ?? 0,
      sucursalId: regla?.sucursalId ?? null,
      unidadId: regla?.unidadId ?? null,
      cargoId: regla?.cargoId ?? null,
      turnoId: regla?.turnoId ?? null,
    },
  })

  const sucursalId = form.watch('sucursalId')
  const unidadesDisponibles = sucursalId ? unidades.filter((u) => u.sucursalId === sucursalId) : unidades

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()
    const payload = {
      nombre: values.nombre,
      indicador: values.indicador,
      operador: values.operador,
      umbral: values.umbral,
      sucursal_id: values.sucursalId,
      unidad_id: values.unidadId,
      cargo_id: values.cargoId,
      turno_id: values.turnoId,
    }

    if (regla) {
      const { data, error } = await supabase
        .from('reglas_alerta')
        .update(payload)
        .eq('id', regla.id)
        .select()
        .single()

      if (error || !data) return

      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'reglas_alerta',
        entidadId: regla.id,
        accion: 'actualizar',
        datosAntes: regla,
        datosDespues: payload,
      })

      onSaved(mapReglaAlertaRow(data))
    } else {
      const { data, error } = await supabase
        .from('reglas_alerta')
        .insert({ ...payload, tenant_id: tenantId, empresa_id: empresaId, creada_por: actorId })
        .select()
        .single()

      if (error || !data) return

      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'reglas_alerta',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: payload,
      })

      onSaved(mapReglaAlertaRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant={regla ? 'outline' : 'default'} size="sm" />}>
        {regla ? 'Editar' : 'Nueva regla'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{regla ? 'Editar regla de alerta' : 'Nueva regla de alerta'}</SheetTitle>
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
            <Label htmlFor="indicador">Indicador</Label>
            <Select
              value={form.watch('indicador')}
              onValueChange={(valor) => form.setValue('indicador', valor as z.infer<typeof schema>['indicador'])}
            >
              <SelectTrigger id="indicador" className="w-full">
                <SelectValue>
                  {(valor: z.infer<typeof schema>['indicador']) =>
                    INDICADORES.find((item) => item.value === valor)?.label ?? valor
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {INDICADORES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="operador">Condición</Label>
              <Select
                value={form.watch('operador')}
                onValueChange={(valor) => form.setValue('operador', valor as z.infer<typeof schema>['operador'])}
              >
                <SelectTrigger id="operador" className="w-full">
                  <SelectValue>
                    {(valor: z.infer<typeof schema>['operador']) => OPERADOR_LABELS[valor]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mayor_que">{OPERADOR_LABELS.mayor_que}</SelectItem>
                  <SelectItem value="mayor_o_igual">{OPERADOR_LABELS.mayor_o_igual}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="umbral">Umbral</Label>
              <Input
                id="umbral"
                type="number"
                step="any"
                {...form.register('umbral', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="regla-sucursal">Sucursal</Label>
              <Select
                value={form.watch('sucursalId') ?? '__todas__'}
                onValueChange={(valor) => {
                  form.setValue('sucursalId', valor === '__todas__' ? null : valor)
                  form.setValue('unidadId', null)
                }}
              >
                <SelectTrigger id="regla-sucursal" className="w-full">
                  <SelectValue>
                    {(valor: string) =>
                      valor === '__todas__' ? 'Toda la empresa' : (sucursales.find((s) => s.id === valor)?.nombre ?? valor)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todas__">Toda la empresa</SelectItem>
                  {sucursales.map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="regla-unidad">Unidad</Label>
              <Select
                value={form.watch('unidadId') ?? '__todas__'}
                onValueChange={(valor) => form.setValue('unidadId', valor === '__todas__' ? null : valor)}
              >
                <SelectTrigger id="regla-unidad" className="w-full">
                  <SelectValue>
                    {(valor: string) =>
                      valor === '__todas__' ? 'Todas' : (unidadesDisponibles.find((u) => u.id === valor)?.nombre ?? valor)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todas__">Todas</SelectItem>
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
              <Label htmlFor="regla-cargo">Cargo</Label>
              <Select
                value={form.watch('cargoId') ?? '__todos__'}
                onValueChange={(valor) => form.setValue('cargoId', valor === '__todos__' ? null : valor)}
              >
                <SelectTrigger id="regla-cargo" className="w-full">
                  <SelectValue>
                    {(valor: string) =>
                      valor === '__todos__' ? 'Todos' : (cargos.find((c) => c.id === valor)?.nombre ?? valor)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  {cargos.map((cargo) => (
                    <SelectItem key={cargo.id} value={cargo.id}>
                      {cargo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="regla-turno">Turno</Label>
              <Select
                value={form.watch('turnoId') ?? '__todos__'}
                onValueChange={(valor) => form.setValue('turnoId', valor === '__todos__' ? null : valor)}
              >
                <SelectTrigger id="regla-turno" className="w-full">
                  <SelectValue>
                    {(valor: string) =>
                      valor === '__todos__' ? 'Todos' : (turnos.find((t) => t.id === valor)?.nombre ?? valor)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
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
