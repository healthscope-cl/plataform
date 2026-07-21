# Seguridad Laboral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workplace safety event reporting (accidents, incidents, near-misses, unsafe conditions) with an admin-managed list at `/plataforma/seguridad` and a public anonymous reporting link at `/reportar/[empresaId]`.

**Architecture:** One new table `eventos_seguridad` with two insert paths gated by RLS (admin-only for any `tipo`, anonymous for `cuasi_accidente`/`condicion_insegura` only). Admin UI follows the exact `reglas_alerta`/`encuestas` pattern (Sheet forms + Table + page + Sidebar nav). The public page resolves `empresaId` → `tenant_id` server-side via the service-role client (mirroring the existing `encuestas` Task 4 precedent for elevated reads on a public route), then a client component inserts the report as `anon`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr` + `@supabase/supabase-js` admin client), `react-hook-form` + `zod`, shadcn/ui on `@base-ui/react`, Tailwind v4.

## Global Constraints

- Admin write access uses `isAdminRole(rolClave)` (`superadmin`/`admin_cliente` only) — never introduce a broader role tier. Source: `lib/platform/roles.ts`.
- `lib/`-internal cross-file imports are **relative**, never the `@/` alias. The `@/` alias is only for `app/`/`components/` files.
- Every table migration block is: `create table` → `alter table ... enable row level security` → `create policy` statements → `grant` statements, all together in one block in `supabase/schema.sql`.
- No delete policy anywhere on `eventos_seguridad` — closed events stay in history, matching `auditoria`/`reglas_alerta`/`encuesta_respuestas`.
- `estado` only moves forward: `abierto` → `en_seguimiento` → `cerrado`. No skipping, no going back.
- The public reporting page lives outside `app/plataforma/` (`app/reportar/[empresaId]/page.tsx`) so `proxy.ts`'s matcher (`['/plataforma/:path*']`) does not need to change.
- No pure aggregation function needed this phase (per spec's own Testing section) — `lib/seguridad/types.ts` only needs a row mapper, following the same unwritten-test precedent as `lib/alertas/types.ts`/`lib/encuestas/types.ts`.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` is the required invocation for typechecking on this machine (default heap OOMs).

---

## File Structure

```
supabase/schema.sql                                       (MODIFY — append eventos_seguridad)
lib/seguridad/types.ts                                     (CREATE)
components/platform/seguridad/EventoSeguridadSheet.tsx     (CREATE — admin create form)
components/platform/seguridad/GestionarEventoSheet.tsx     (CREATE — advance estado + accion_correctiva)
components/platform/seguridad/EventosSeguridadTable.tsx    (CREATE — list, wires both sheets)
app/plataforma/seguridad/page.tsx                          (CREATE — admin page)
components/platform/Sidebar.tsx                            (MODIFY — nav entry)
components/seguridad/ReportarForm.tsx                      (CREATE — public anonymous form)
app/reportar/[empresaId]/page.tsx                          (CREATE — public page)
```

---

### Task 1: Schema + types

**Files:**
- Modify: `supabase/schema.sql` (append at end of file)
- Create: `lib/seguridad/types.ts`

**Interfaces:**
- Produces: `TipoEventoSeguridad`, `GravedadEvento`, `EstadoEvento`, `EventoSeguridad` type, `mapEventoSeguridadRow(row)` function — all consumed by every later task.

- [ ] **Step 1: Append the table + RLS to `supabase/schema.sql`**

Append this exact block at the end of the file:

```sql

-- ============================================================
-- WORKPLACE SAFETY: eventos_seguridad
-- ============================================================

create table eventos_seguridad (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid references usuarios(id),
  tipo text not null check (tipo in ('accidente', 'incidente', 'cuasi_accidente', 'condicion_insegura')),
  descripcion text not null,
  gravedad text not null check (gravedad in ('leve', 'moderada', 'grave')),
  fecha date not null,
  sucursal_id uuid references sucursales(id) on delete set null,
  unidad_id uuid references unidades(id) on delete set null,
  cargo_id uuid references cargos(id) on delete set null,
  turno_id uuid references turnos(id) on delete set null,
  estado text not null default 'abierto' check (estado in ('abierto', 'en_seguimiento', 'cerrado')),
  accion_correctiva text
);

alter table eventos_seguridad enable row level security;

create policy "eventos_seguridad_select_same_tenant" on eventos_seguridad
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "eventos_seguridad_insert_admin" on eventos_seguridad
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "eventos_seguridad_insert_publico" on eventos_seguridad
  for insert to anon, authenticated
  with check (
    tipo in ('cuasi_accidente', 'condicion_insegura')
    and tenant_id = (select tenant_id from empresas where id = empresa_id)
  );

create policy "eventos_seguridad_update_admin" on eventos_seguridad
  for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update on eventos_seguridad to authenticated;
grant insert on eventos_seguridad to anon;
grant all on eventos_seguridad to service_role;
```

Note on `eventos_seguridad_insert_publico`: the `tenant_id = (select tenant_id from empresas where id = empresa_id)` clause is a data-integrity check, not an auth check — an anonymous visitor has no session to authorize against. It forces the submitted `tenant_id` to be the REAL tenant that owns the submitted `empresa_id`, so a tampered client can at most report against a real, already-public `empresaId` (the one in the URL) — it cannot forge an orphan or cross-tenant row.

- [ ] **Step 2: Create `lib/seguridad/types.ts`**

```typescript
export type TipoEventoSeguridad = 'accidente' | 'incidente' | 'cuasi_accidente' | 'condicion_insegura'
export type GravedadEvento = 'leve' | 'moderada' | 'grave'
export type EstadoEvento = 'abierto' | 'en_seguimiento' | 'cerrado'

export type EventoSeguridad = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string | null
  tipo: TipoEventoSeguridad
  descripcion: string
  gravedad: GravedadEvento
  fecha: string
  sucursalId: string | null
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
  estado: EstadoEvento
  accionCorrectiva: string | null
}

export function mapEventoSeguridadRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string | null
  tipo: string
  descripcion: string
  gravedad: string
  fecha: string
  sucursal_id: string | null
  unidad_id: string | null
  cargo_id: string | null
  turno_id: string | null
  estado: string
  accion_correctiva: string | null
}): EventoSeguridad {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    tipo: row.tipo as TipoEventoSeguridad,
    descripcion: row.descripcion,
    gravedad: row.gravedad as GravedadEvento,
    fecha: row.fecha,
    sucursalId: row.sucursal_id,
    unidadId: row.unidad_id,
    cargoId: row.cargo_id,
    turnoId: row.turno_id,
    estado: row.estado as EstadoEvento,
    accionCorrectiva: row.accion_correctiva,
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors related to `lib/seguridad/types.ts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql lib/seguridad/types.ts
git commit -m "feat: add eventos_seguridad schema and types"
```

---

### Task 2: Admin Sheet forms

**Files:**
- Create: `components/platform/seguridad/EventoSeguridadSheet.tsx`
- Create: `components/platform/seguridad/GestionarEventoSheet.tsx`

**Interfaces:**
- Consumes: `EventoSeguridad`, `EstadoEvento`, `mapEventoSeguridadRow` from `../../../lib/seguridad/types` (relative import — this is a `components/` file importing from `lib/`, so the `@/` alias is fine here per Global Constraints; only `lib/`-internal imports must be relative). `createClient` from `@/lib/supabase/client`, `logAudit` from `@/lib/platform/audit`.
- Produces: `EventoSeguridadSheet` (props: `tenantId`, `empresaId`, `actorId`, `sucursales`, `unidades`, `cargos`, `turnos`, `onSaved: (evento: EventoSeguridad) => void`) and `GestionarEventoSheet` (props: `tenantId`, `actorId`, `evento: EventoSeguridad`, `onSaved: (evento: EventoSeguridad) => void`) — both consumed by Task 3's `EventosSeguridadTable`.

- [ ] **Step 1: Create `components/platform/seguridad/EventoSeguridadSheet.tsx`**

```tsx
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
                <SelectValue />
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leve">Leve</SelectItem>
                  <SelectItem value="moderada">Moderada</SelectItem>
                  <SelectItem value="grave">Grave</SelectItem>
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
                  <SelectValue />
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
                  <SelectValue />
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
                  <SelectValue />
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
                  <SelectValue />
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
```

- [ ] **Step 2: Create `components/platform/seguridad/GestionarEventoSheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import type { EventoSeguridad, EstadoEvento } from '@/lib/seguridad/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const SIGUIENTE_ESTADO: Record<EstadoEvento, EstadoEvento | null> = {
  abierto: 'en_seguimiento',
  en_seguimiento: 'cerrado',
  cerrado: null,
}

const ESTADO_LABEL: Record<EstadoEvento, string> = {
  abierto: 'Abierto',
  en_seguimiento: 'En seguimiento',
  cerrado: 'Cerrado',
}

export function GestionarEventoSheet({
  tenantId,
  actorId,
  evento,
  onSaved,
}: {
  tenantId: string
  actorId: string
  evento: EventoSeguridad
  onSaved: (evento: EventoSeguridad) => void
}) {
  const [open, setOpen] = useState(false)
  const [accionCorrectiva, setAccionCorrectiva] = useState(evento.accionCorrectiva ?? '')
  const [guardando, setGuardando] = useState(false)
  const siguiente = SIGUIENTE_ESTADO[evento.estado]

  async function handleAvanzar() {
    if (!siguiente) return
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('eventos_seguridad')
      .update({ estado: siguiente, accion_correctiva: accionCorrectiva || null })
      .eq('id', evento.id)
    setGuardando(false)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'eventos_seguridad',
      entidadId: evento.id,
      accion: 'actualizar',
      datosAntes: { estado: evento.estado, accionCorrectiva: evento.accionCorrectiva },
      datosDespues: { estado: siguiente, accionCorrectiva },
    })

    onSaved({ ...evento, estado: siguiente, accionCorrectiva: accionCorrectiva || null })
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>Gestionar</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{evento.descripcion}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">Estado actual: {ESTADO_LABEL[evento.estado]}</p>
          <div className="space-y-2">
            <Label htmlFor="accionCorrectiva">Acción correctiva</Label>
            <textarea
              id="accionCorrectiva"
              value={accionCorrectiva}
              onChange={(e) => setAccionCorrectiva(e.target.value)}
              disabled={!siguiente}
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {siguiente ? (
            <Button type="button" disabled={guardando} onClick={handleAvanzar}>
              {guardando ? 'Guardando…' : `Avanzar a "${ESTADO_LABEL[siguiente]}"`}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Este evento ya está cerrado.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors in the two new files. (They are not yet imported anywhere, so no wiring errors expected either.)

- [ ] **Step 4: Commit**

```bash
git add components/platform/seguridad/EventoSeguridadSheet.tsx components/platform/seguridad/GestionarEventoSheet.tsx
git commit -m "feat: add seguridad laboral admin forms"
```

---

### Task 3: Admin table + page + nav

**Files:**
- Create: `components/platform/seguridad/EventosSeguridadTable.tsx`
- Create: `app/plataforma/seguridad/page.tsx`
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: `EventoSeguridadSheet` and `GestionarEventoSheet` from Task 2 (exact prop shapes above), `EventoSeguridad`/`mapEventoSeguridadRow` from Task 1, `isAdminRole` from `lib/platform/roles.ts`, `mapUsuarioRow`/`mapRolRow` from `lib/platform/types.ts`.
- Produces: the `/plataforma/seguridad` route, reachable from the sidebar.

- [ ] **Step 1: Create `components/platform/seguridad/EventosSeguridadTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { isAdminRole } from '@/lib/platform/roles'
import type { EventoSeguridad } from '@/lib/seguridad/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EventoSeguridadSheet } from './EventoSeguridadSheet'
import { GestionarEventoSheet } from './GestionarEventoSheet'

const TIPO_LABELS: Record<EventoSeguridad['tipo'], string> = {
  accidente: 'Accidente',
  incidente: 'Incidente',
  cuasi_accidente: 'Cuasi accidente',
  condicion_insegura: 'Condición insegura',
}

const ESTADO_LABEL: Record<EventoSeguridad['estado'], string> = {
  abierto: 'Abierto',
  en_seguimiento: 'En seguimiento',
  cerrado: 'Cerrado',
}

export function EventosSeguridadTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialEventos,
  sucursales,
  unidades,
  cargos,
  turnos,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialEventos: EventoSeguridad[]
  sucursales: Array<{ id: string; nombre: string }>
  unidades: Array<{ id: string; nombre: string; sucursalId: string }>
  cargos: Array<{ id: string; nombre: string }>
  turnos: Array<{ id: string; nombre: string }>
}) {
  const [eventos, setEventos] = useState(initialEventos)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(evento: EventoSeguridad) {
    setEventos((prev) => {
      const existe = prev.some((e) => e.id === evento.id)
      return existe ? prev.map((e) => (e.id === evento.id ? evento : e)) : [evento, ...prev]
    })
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <EventoSeguridadSheet
            tenantId={tenantId}
            empresaId={empresaId}
            actorId={actorId}
            sucursales={sucursales}
            unidades={unidades}
            cargos={cargos}
            turnos={turnos}
            onSaved={handleSaved}
          />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Gravedad</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {eventos.map((evento) => (
            <TableRow key={evento.id}>
              <TableCell>{TIPO_LABELS[evento.tipo]}</TableCell>
              <TableCell>{evento.descripcion}</TableCell>
              <TableCell>
                <Badge variant={evento.gravedad === 'grave' ? 'destructive' : 'outline'}>{evento.gravedad}</Badge>
              </TableCell>
              <TableCell>{evento.fecha}</TableCell>
              <TableCell>
                <Badge variant="outline">{ESTADO_LABEL[evento.estado]}</Badge>
              </TableCell>
              {canEdit ? (
                <TableCell className="text-right">
                  <GestionarEventoSheet tenantId={tenantId} actorId={actorId} evento={evento} onSaved={handleSaved} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {eventos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 6 : 5} className="py-4 text-center text-muted-foreground">
                No hay eventos registrados.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/plataforma/seguridad/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { EventosSeguridadTable } from '@/components/platform/seguridad/EventosSeguridadTable'

export default async function SeguridadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('*, roles(*)').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')
  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }

  const { data: eventoRows } = await supabase
    .from('eventos_seguridad')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)

  const { data: sucursalRows } = await supabase.from('sucursales').select('id, nombre').eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))
  const sucursalIds = sucursales.map((s) => s.id)

  const { data: unidadRows } =
    sucursalIds.length > 0
      ? await supabase.from('unidades').select('id, nombre, sucursal_id').in('sucursal_id', sucursalIds)
      : { data: [] as { id: string; nombre: string; sucursal_id: string }[] }
  const unidades = (unidadRows ?? []).map((row) => ({
    id: row.id as string,
    nombre: row.nombre as string,
    sucursalId: row.sucursal_id as string,
  }))

  const { data: cargoRows } = await supabase.from('cargos').select('id, nombre').eq('empresa_id', empresaId)
  const cargos = (cargoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: turnoRows } = await supabase.from('turnos').select('id, nombre').eq('empresa_id', empresaId)
  const turnos = (turnoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Seguridad laboral</h1>
      <EventosSeguridadTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialEventos={eventos}
        sucursales={sucursales}
        unidades={unidades}
        cargos={cargos}
        turnos={turnos}
      />
    </div>
  )
}
```

Before writing this file, read `app/plataforma/alertas/page.tsx` to confirm the exact column names/shape used for the `cargos`/`turnos` queries in this codebase (e.g. whether `cargos`/`turnos` are scoped by `empresa_id` directly or through another join) — copy that exact query, since it must match how `ReglaAlertaSheet`'s catalogs are currently fetched. If it differs from what's shown above, use the existing working query instead.

- [ ] **Step 3: Add Sidebar nav entry**

In `components/platform/Sidebar.tsx`, find the `NAV_ITEMS` array (currently starting with `{ href: '/plataforma/resumen', ... }`). Add a new entry immediately after the `encuestas` entry:

```typescript
  { href: '/plataforma/seguridad', label: 'Seguridad laboral', adminOnly: true },
```

So the array reads (in this order): `resumen`, `alertas`, `encuestas`, `seguridad`, `organizacion`, ... (unchanged rest).

- [ ] **Step 4: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Manual smoke check (dev server)**

Run: `npm run dev` (or confirm it's already running), then navigate to `/plataforma/seguridad` while logged in as an admin.
Expected: page loads, shows "No hay eventos registrados." and a "Nuevo evento" button; "Seguridad laboral" appears in the sidebar between "Encuestas" and "Organización".

- [ ] **Step 6: Commit**

```bash
git add components/platform/seguridad/EventosSeguridadTable.tsx app/plataforma/seguridad/page.tsx components/platform/Sidebar.tsx
git commit -m "feat: add seguridad laboral admin page"
```

---

### Task 4: Public reporting page

**Files:**
- Create: `components/seguridad/ReportarForm.tsx`
- Create: `app/reportar/[empresaId]/page.tsx`

**Interfaces:**
- Consumes: `createAdminClient` from `@/lib/supabase/admin`, `createClient` (browser) from `@/lib/supabase/client`.
- Produces: the public route `/reportar/[empresaId]`.

**Design note on `tenant_id` resolution:** `eventos_seguridad.tenant_id` is `not null`, but an anonymous visitor only has `empresaId` from the URL, and `anon` has no `SELECT` grant on `empresas` (confirmed: only `demo_requests`, `encuesta_respuestas` (insert), and `encuestas`/`eventos_seguridad` (this task's insert policy) grant anything to `anon` in `supabase/schema.sql`). The Server Component at `app/reportar/[empresaId]/page.tsx` resolves `empresaId → tenant_id` using `createAdminClient()` (service role, bypasses RLS) — the same elevated-read pattern already used in `app/plataforma/encuestas/[id]/page.tsx` for reading `encuesta_respuestas`. It passes both `empresaId` and the resolved `tenantId` as props into the client form, which performs the actual insert as `anon`. This keeps `tenant_id` `not null` consistent with every other table in the project without granting `anon` any new read access.

- [ ] **Step 1: Create `components/seguridad/ReportarForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIPOS_PUBLICOS = [
  { value: 'condicion_insegura', label: 'Condición insegura' },
  { value: 'cuasi_accidente', label: 'Cuasi accidente' },
] as const

type TipoPublico = (typeof TIPOS_PUBLICOS)[number]['value']

export function ReportarForm({
  tenantId,
  empresaId,
  sucursales,
}: {
  tenantId: string
  empresaId: string
  sucursales: Array<{ id: string; nombre: string }>
}) {
  const [tipo, setTipo] = useState<TipoPublico>('condicion_insegura')
  const [descripcion, setDescripcion] = useState('')
  const [sucursalId, setSucursalId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit() {
    if (!descripcion.trim()) return
    setEnviando(true)
    const supabase = createClient()
    const { error } = await supabase.from('eventos_seguridad').insert({
      tenant_id: tenantId,
      empresa_id: empresaId,
      tipo,
      descripcion,
      gravedad: 'leve',
      fecha: new Date().toISOString().slice(0, 10),
      sucursal_id: sucursalId,
    })
    setEnviando(false)
    if (error) return
    setEnviado(true)
  }

  if (enviado) {
    return <p className="text-sm text-foreground">Gracias por tu reporte.</p>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reportar-tipo">Tipo</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPublico)}>
          <SelectTrigger id="reportar-tipo" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_PUBLICOS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reportar-descripcion">¿Qué observaste?</Label>
        <textarea
          id="reportar-descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {sucursales.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="reportar-sucursal">Sucursal (opcional)</Label>
          <Select
            value={sucursalId ?? '__ninguna__'}
            onValueChange={(v) => setSucursalId(v === '__ninguna__' ? null : v)}
          >
            <SelectTrigger id="reportar-sucursal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ninguna__">Prefiero no decir</SelectItem>
              {sucursales.map((sucursal) => (
                <SelectItem key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <Button type="button" disabled={!descripcion.trim() || enviando} onClick={handleSubmit}>
        {enviando ? 'Enviando…' : 'Enviar reporte'}
      </Button>
    </div>
  )
}
```

Note: the public form always submits `gravedad: 'leve'` — an anonymous reporter of a near-miss or hazard isn't asked to self-rate severity; admin reassesses when reviewing via `GestionarEventoSheet`. This mirrors how the public survey form (`EncuestaResponderForm`) keeps the anonymous submitter's job minimal.

- [ ] **Step 2: Create `app/reportar/[empresaId]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReportarForm } from '@/components/seguridad/ReportarForm'

export default async function ReportarPage({ params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = await params
  const admin = createAdminClient()

  const { data: empresaRow } = await admin
    .from('empresas')
    .select('id, tenant_id')
    .eq('id', empresaId)
    .maybeSingle()

  if (!empresaRow) notFound()

  const { data: sucursalRows } = await admin.from('sucursales').select('id, nombre').eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <div>
        <h1 className="font-heading text-xl font-semibold text-foreground">Reportar una condición de seguridad</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este reporte es anónimo — no se registra quién lo envía.
        </p>
      </div>
      <ReportarForm tenantId={empresaRow.tenant_id as string} empresaId={empresaRow.id as string} sucursales={sucursales} />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Manual smoke check (dev server)**

Navigate to `/reportar/<a real empresaId from the dev database>` while logged out.
Expected: form renders with "Condición insegura"/"Cuasi accidente" as the only tipo options, no auth prompt. Submitting shows "Gracias por tu reporte."
Navigate to `/reportar/00000000-0000-0000-0000-000000000000` (a non-existent id).
Expected: Next.js not-found page.

- [ ] **Step 5: Commit**

```bash
git add components/seguridad/ReportarForm.tsx app/reportar/[empresaId]/page.tsx
git commit -m "feat: add public workplace safety reporting page"
```

---

### Task 5: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user) to run against the deployed/production environment after Tasks 1-4 are merged and the schema is applied to production Supabase.

- [ ] **Step 1: Apply the Task 1 SQL block to production Supabase**

Via the Supabase SQL Editor (browser automation, only on an already-authenticated session — never enter credentials), run the `eventos_seguridad` table + RLS + grants block from Task 1, Step 1, against the production project (`jjnrrkwydpsetugxtgea`).

- [ ] **Step 2: Verify the anonymous `accidente`/`incidente` block is enforced by the database, not just the UI**

In the SQL Editor, run as a check (this should FAIL with a policy violation):

```sql
set role anon;
insert into eventos_seguridad (tenant_id, empresa_id, tipo, descripcion, gravedad, fecha)
values (
  (select id from tenants limit 1),
  (select id from empresas limit 1),
  'accidente',
  'intento de prueba',
  'leve',
  current_date
);
reset role;
```

Expected: `ERROR: new row violates row-level security policy for table "eventos_seguridad"`.

Then run the same insert with `tipo = 'condicion_insegura'` — expected: succeeds. Delete that test row afterward (`delete from eventos_seguridad where descripcion = 'intento de prueba'` run as the table owner/service role, since there is no delete policy for `anon`/`authenticated`).

- [ ] **Step 3: Verify estado only advances forward in the real UI**

Log in to production as an admin. Go to `/plataforma/seguridad`, create a test event, open "Gestionar", confirm it offers only "Avanzar a en_seguimiento" (not a jump straight to "cerrado" or backward to "abierto"). Advance it, confirm the button now offers "Avanzar a cerrado". Advance again, confirm the sheet shows "Este evento ya está cerrado." with no further action available.

- [ ] **Step 4: Verify the public link end-to-end in production**

Visit `https://healthscope-murex.vercel.app/reportar/<real production empresaId>` logged out. Submit a "Cuasi accidente" report. Confirm it appears in `/plataforma/seguridad` for that tenant's admin. Delete the test row from `/plataforma/seguridad` is not possible (no delete UI, by design) — instead delete it directly via SQL Editor as a cleanup step, or leave it and tell the user it's test data they may want removed.

- [ ] **Step 5: Report results to the user**

Summarize: schema applied ✅/❌, RLS block confirmed by direct SQL ✅/❌, forward-only estado confirmed in UI ✅/❌, public link end-to-end confirmed ✅/❌. If everything passes, ask the user which module from `referencia/instrucciones2.txt` to tackle next.

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1) ✅, admin create form (Task 2) ✅, estado/accion_correctiva management (Task 2) ✅, admin list page + nav (Task 3) ✅, public reporting page with tipo restricted to the two anonymous-eligible values (Task 4) ✅, RLS forward-only estado and DB-level (not UI-level) rejection of anonymous `accidente`/`incidente` (Task 5) ✅. Explicitly-out-of-scope items (Intervenciones module, linking to reglas_alerta, file attachments, notifications) are not implemented anywhere in this plan, matching the spec.
- **Placeholder scan:** no TBD/TODO; every step has complete code.
- **Type consistency:** `EventoSeguridad`/`EstadoEvento`/`TipoEventoSeguridad`/`GravedadEvento` (Task 1) are used with identical names and shapes across Tasks 2-4. `mapEventoSeguridadRow` signature is consistent everywhere it's called.
