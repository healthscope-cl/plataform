# Campañas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CRUD record of campaigns (`campanas`) with an admin-managed list at `/plataforma/campanas` — tipo (from a fixed 9-value catalog), nombre, fecha de inicio/fin, responsable, proveedor, costo, participantes (a count, not a list of people), resultado, and a forward-only estado. No public/anonymous path, no quantitative before/after indicator comparison.

**Architecture:** One new table `campanas`, admin-only read/write via RLS (no `anon` role anywhere, same shape as `intervenciones`/`evaluaciones_ergonomicas`). Admin UI follows the exact `intervenciones` pattern (Sheet forms + Table + page + Sidebar nav). This is the first module in this sequence to need a `Select` component (the `tipo` field) since the app-wide Select-label bug was fixed — the fix pattern (an explicit `children` render function on `SelectValue`, never bare `<SelectValue />`) must be used correctly from the start here.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr`), `react-hook-form` + `zod`, shadcn/ui on `@base-ui/react`, Tailwind v4.

## Global Constraints

- Admin write access uses `isAdminRole(rolClave)` (`superadmin`/`admin_cliente` only) — same as every other module.
- `lib/`-internal cross-file imports are **relative**, never the `@/` alias.
- Every table migration block is: `create table` → `alter table ... enable row level security` → `create policy` statements → `grant` statements, all together in one block in `supabase/schema.sql`.
- No delete policy anywhere on `campanas` — matches every other append-only table in this project.
- `estado` only moves forward: `planificada` → `activa` → `finalizada`. No skipping, no going back.
- **No `anon` role anywhere on this table** — no public path for this module.
- `tipo` is a closed `check` constraint with exactly these 9 values (from `referencia/instrucciones2.txt` módulo 9): `bienestar`, `salud_mental`, `ergonomia`, `vacunacion`, `pausas_activas`, `prevencion`, `sueno`, `alimentacion`, `liderazgo`. Do not add, remove, or rename any value.
- **Every `SelectValue` in this plan MUST have an explicit `children` render function** (e.g. `<SelectValue>{(v: X) => LABELS[v]}</SelectValue>`), never a bare `<SelectValue />`. This project's `@base-ui/react` `Select` does not auto-resolve labels — a prior app-wide bug fix (already shipped) established this pattern across every existing `Select` usage; this plan's new `tipo` field must follow it from the start, not reintroduce the bug.
- `costo` and `participantes` are optional numeric fields, following the same pattern already established for `presupuesto` in `intervenciones`: kept as plain `string` in the zod schema (not `valueAsNumber`), parsed manually in `onSubmit` via `values.field.trim() ? Number(values.field) : null` — this avoids an empty optional field silently becoming `0` or `NaN`.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required exact invocation on this machine (default heap OOMs).

---

## File Structure

```
supabase/schema.sql                                     (MODIFY — append campanas)
lib/campanas/types.ts                                    (CREATE)
components/platform/campanas/CampanaSheet.tsx             (CREATE — admin create form)
components/platform/campanas/GestionarCampanaSheet.tsx    (CREATE — advance estado + resultado)
components/platform/campanas/CampanasTable.tsx             (CREATE — list, wires both sheets)
app/plataforma/campanas/page.tsx                           (CREATE — admin page)
components/platform/Sidebar.tsx                            (MODIFY — nav entry)
```

---

### Task 1: Schema + types

**Files:**
- Modify: `supabase/schema.sql` (append at end of file)
- Create: `lib/campanas/types.ts`

**Interfaces:**
- Produces: `TipoCampana` type, `EstadoCampana` type, `Campana` type, `mapCampanaRow(row)` function — all consumed by later tasks.

- [ ] **Step 1: Append the table + RLS to `supabase/schema.sql`**

Append this exact block at the end of the file:

```sql

-- ============================================================
-- CAMPAIGNS: campanas
-- ============================================================

create table campanas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  tipo text not null check (tipo in (
    'bienestar', 'salud_mental', 'ergonomia', 'vacunacion', 'pausas_activas',
    'prevencion', 'sueno', 'alimentacion', 'liderazgo'
  )),
  nombre text not null,
  fecha_inicio date not null,
  fecha_fin date,
  responsable text not null,
  proveedor text,
  costo numeric,
  participantes integer,
  resultado text,
  estado text not null default 'planificada' check (estado in ('planificada', 'activa', 'finalizada'))
);

alter table campanas enable row level security;

create policy "campanas_select_same_tenant" on campanas
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "campanas_insert_admin" on campanas
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "campanas_update_admin" on campanas
  for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update on campanas to authenticated;
grant all on campanas to service_role;
```

Note: no `insert_publico` policy, no `grant ... to anon` — matches `intervenciones` and `evaluaciones_ergonomicas`.

- [ ] **Step 2: Create `lib/campanas/types.ts`**

```typescript
export type TipoCampana =
  | 'bienestar'
  | 'salud_mental'
  | 'ergonomia'
  | 'vacunacion'
  | 'pausas_activas'
  | 'prevencion'
  | 'sueno'
  | 'alimentacion'
  | 'liderazgo'

export type EstadoCampana = 'planificada' | 'activa' | 'finalizada'

export type Campana = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  tipo: TipoCampana
  nombre: string
  fechaInicio: string
  fechaFin: string | null
  responsable: string
  proveedor: string | null
  costo: number | null
  participantes: number | null
  resultado: string | null
  estado: EstadoCampana
}

export function mapCampanaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  tipo: string
  nombre: string
  fecha_inicio: string
  fecha_fin: string | null
  responsable: string
  proveedor: string | null
  costo: number | null
  participantes: number | null
  resultado: string | null
  estado: string
}): Campana {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    tipo: row.tipo as TipoCampana,
    nombre: row.nombre,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    responsable: row.responsable,
    proveedor: row.proveedor,
    costo: row.costo,
    participantes: row.participantes,
    resultado: row.resultado,
    estado: row.estado as EstadoCampana,
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql lib/campanas/types.ts
git commit -m "feat: add campanas schema and types"
```

---

### Task 2: Admin Sheet forms

**Files:**
- Create: `components/platform/campanas/CampanaSheet.tsx`
- Create: `components/platform/campanas/GestionarCampanaSheet.tsx`

**Interfaces:**
- Consumes: `Campana`, `EstadoCampana`, `mapCampanaRow` from `@/lib/campanas/types`. `createClient` from `@/lib/supabase/client`, `logAudit` from `@/lib/platform/audit`.
- Produces: `CampanaSheet` (props: `tenantId`, `empresaId`, `actorId`, `onSaved: (campana: Campana) => void`) and `GestionarCampanaSheet` (props: `tenantId`, `actorId`, `campana: Campana`, `onSaved: (campana: Campana) => void`) — both consumed by Task 3's `CampanasTable`.

- [ ] **Step 1: Create `components/platform/campanas/CampanaSheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapCampanaRow, type Campana } from '@/lib/campanas/types'
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
```

Notes:
- `fechaFin`, `proveedor`, `costo`, `participantes` all stay plain `string` fields in the zod schema (not `z.number()`/`valueAsNumber`) and are parsed/normalized manually in `onSubmit` — an empty string becomes `null`, never `0`/`NaN`/an empty-string DB value. Do not change this.
- `SelectValue` has an explicit `children` function (`{(valor: FormValues['tipo']) => TIPO_LABELS[valor]}`) — do not simplify this to bare `<SelectValue />`, that would reintroduce the app-wide label bug that was already fixed in this project.

- [ ] **Step 2: Create `components/platform/campanas/GestionarCampanaSheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import type { Campana, EstadoCampana } from '@/lib/campanas/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const SIGUIENTE_ESTADO: Record<EstadoCampana, EstadoCampana | null> = {
  planificada: 'activa',
  activa: 'finalizada',
  finalizada: null,
}

const ESTADO_LABEL: Record<EstadoCampana, string> = {
  planificada: 'Planificada',
  activa: 'Activa',
  finalizada: 'Finalizada',
}

export function GestionarCampanaSheet({
  tenantId,
  actorId,
  campana,
  onSaved,
}: {
  tenantId: string
  actorId: string
  campana: Campana
  onSaved: (campana: Campana) => void
}) {
  const [open, setOpen] = useState(false)
  const [resultado, setResultado] = useState(campana.resultado ?? '')
  const [guardando, setGuardando] = useState(false)
  const siguiente = SIGUIENTE_ESTADO[campana.estado]

  async function handleAvanzar() {
    if (!siguiente) return
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('campanas')
      .update({ estado: siguiente, resultado: resultado || null })
      .eq('id', campana.id)
    setGuardando(false)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'campanas',
      entidadId: campana.id,
      accion: 'actualizar',
      datosAntes: { estado: campana.estado, resultado: campana.resultado },
      datosDespues: { estado: siguiente, resultado },
    })

    onSaved({ ...campana, estado: siguiente, resultado: resultado || null })
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>Gestionar</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{campana.nombre}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">Estado actual: {ESTADO_LABEL[campana.estado]}</p>
          <div className="space-y-2">
            <Label htmlFor="gestion-resultado">Resultado</Label>
            <textarea
              id="gestion-resultado"
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              disabled={!siguiente}
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {siguiente ? (
            <Button type="button" disabled={guardando} onClick={handleAvanzar}>
              {guardando ? 'Guardando…' : `Avanzar a "${ESTADO_LABEL[siguiente]}"`}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Esta campaña ya está finalizada.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors in the two new files (not yet imported anywhere, so no wiring errors expected either).

- [ ] **Step 4: Commit**

```bash
git add components/platform/campanas/CampanaSheet.tsx components/platform/campanas/GestionarCampanaSheet.tsx
git commit -m "feat: add campanas admin forms"
```

---

### Task 3: Admin table + page + nav

**Files:**
- Create: `components/platform/campanas/CampanasTable.tsx`
- Create: `app/plataforma/campanas/page.tsx`
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: `CampanaSheet` and `GestionarCampanaSheet` from Task 2 (exact prop shapes above), `Campana`/`mapCampanaRow` from Task 1, `isAdminRole` from `lib/platform/roles.ts`, `mapUsuarioRow`/`mapRolRow` from `lib/platform/types.ts`.
- Produces: the `/plataforma/campanas` route, reachable from the sidebar.

- [ ] **Step 1: Create `components/platform/campanas/CampanasTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { isAdminRole } from '@/lib/platform/roles'
import type { Campana } from '@/lib/campanas/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CampanaSheet } from './CampanaSheet'
import { GestionarCampanaSheet } from './GestionarCampanaSheet'

const TIPO_LABELS: Record<Campana['tipo'], string> = {
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

const ESTADO_LABEL: Record<Campana['estado'], string> = {
  planificada: 'Planificada',
  activa: 'Activa',
  finalizada: 'Finalizada',
}

export function CampanasTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialCampanas,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialCampanas: Campana[]
}) {
  const [campanas, setCampanas] = useState(initialCampanas)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(campana: Campana) {
    setCampanas((prev) => {
      const existe = prev.some((c) => c.id === campana.id)
      return existe ? prev.map((c) => (c.id === campana.id ? campana : c)) : [campana, ...prev]
    })
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <CampanaSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Fecha de inicio</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {campanas.map((campana) => (
            <TableRow key={campana.id}>
              <TableCell>{TIPO_LABELS[campana.tipo]}</TableCell>
              <TableCell>{campana.nombre}</TableCell>
              <TableCell>{campana.fechaInicio}</TableCell>
              <TableCell>
                <Badge variant="outline">{ESTADO_LABEL[campana.estado]}</Badge>
              </TableCell>
              {canEdit ? (
                <TableCell className="text-right">
                  <GestionarCampanaSheet
                    tenantId={tenantId}
                    actorId={actorId}
                    campana={campana}
                    onSaved={handleSaved}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {campanas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 5 : 4} className="py-4 text-center text-muted-foreground">
                No hay campañas registradas.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/plataforma/campanas/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapCampanaRow } from '@/lib/campanas/types'
import { CampanasTable } from '@/components/platform/campanas/CampanasTable'

export default async function CampanasPage() {
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

  const { data: campanaRows } = await supabase
    .from('campanas')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const campanas = (campanaRows ?? []).map(mapCampanaRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Campañas</h1>
      <CampanasTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialCampanas={campanas}
      />
    </div>
  )
}
```

- [ ] **Step 3: Add Sidebar nav entry**

In `components/platform/Sidebar.tsx`, find the `NAV_ITEMS` array. Add a new entry immediately after the `intervenciones` entry (`{ href: '/plataforma/intervenciones', label: 'Intervenciones', adminOnly: true }`):

```typescript
  { href: '/plataforma/campanas', label: 'Campañas', adminOnly: true },
```

So the array reads (in this order): `resumen`, `alertas`, `encuestas`, `seguridad`, `ergonomia`, `intervenciones`, `campanas`, `organizacion`, ... (unchanged rest).

- [ ] **Step 4: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run`
Expected: all existing tests still pass (no new tests in this plan — this module has no pure function).

- [ ] **Step 6: Manual smoke check (dev server)**

Run: `npm run dev` (or confirm it's already running), then navigate to `/plataforma/campanas` while logged in as an admin.
Expected: page loads, shows "No hay campañas registradas." and a "Nueva campaña" button; opening "Nueva campaña" shows the tipo dropdown displaying human-readable labels ("Bienestar", "Salud mental", etc.), not raw enum values; "Campañas" appears in the sidebar between "Intervenciones" and "Organización".

- [ ] **Step 7: Commit**

```bash
git add components/platform/campanas/CampanasTable.tsx app/plataforma/campanas/page.tsx components/platform/Sidebar.tsx
git commit -m "feat: add campanas admin page"
```

---

### Task 4: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user) to run against the deployed/production environment after Tasks 1-3 are merged and the schema is applied to production Supabase.

- [ ] **Step 1: Apply the Task 1 SQL block to production Supabase**

Via the Supabase SQL Editor (browser automation, only on an already-authenticated session — never enter credentials), run the `campanas` table + RLS + grants block from Task 1, Step 1, against the production project (`jjnrrkwydpsetugxtgea`).

- [ ] **Step 2: Verify no `anon` data-access grant exists**

In the SQL Editor: `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'campanas' order by grantee, privilege_type;` — expected: `authenticated` has `select`/`insert`/`update`, `service_role` has everything. `anon` may appear with `REFERENCES`/`TRIGGER`/`TRUNCATE` (a confirmed Postgres/Supabase-wide baseline, not a data-access risk) — but `anon` must **not** have `select`, `insert`, `update`, or `delete`.

- [ ] **Step 3: Verify the tipo dropdown shows correct labels, and estado only advances forward**

Log in to production as an admin. Go to `/plataforma/campanas`, open "Nueva campaña", confirm the "Tipo" dropdown trigger and its opened list both show human-readable Spanish labels (e.g. "Salud mental"), never raw values like "salud_mental". Create a test campaign leaving "Fecha de fin", "Proveedor", "Costo", and "Participantes" all empty, confirm it saves without error. Open "Gestionar", confirm it offers only "Avanzar a activa" (not a jump straight to "finalizada"). Advance it, add a `resultado` value, confirm the button now offers "Avanzar a finalizada". Advance again, confirm the sheet shows "Esta campaña ya está finalizada." with no further action available.

- [ ] **Step 4: Verify the optional numeric/date fields round-trip correctly when filled**

Create a second test campaign, this time filling "Fecha de fin", "Proveedor", "Costo" (e.g. `250000`), and "Participantes" (e.g. `40`). Confirm via the SQL Editor that all four values are stored correctly (not `null`, not `0`, not mangled) — `select nombre, fecha_fin, proveedor, costo, participantes from campanas where nombre = '<test name>';`.

- [ ] **Step 5: Clean up test data**

Delete both test campaigns directly via the SQL Editor (`delete from campanas where nombre = '<test name>'`) — there is no delete UI, by design.

- [ ] **Step 6: Report results to the user**

Summarize: schema applied ✅/❌, no `anon` data-access grant confirmed ✅/❌, tipo dropdown shows correct labels ✅/❌, forward-only estado confirmed in UI ✅/❌, optional fields (empty and filled) confirmed working ✅/❌. If everything passes, ask the user which module from `referencia/instrucciones2.txt` to tackle next.

---

## Self-Review Notes

- **Spec coverage:** schema with `tipo` (closed 9-value catalog), `nombre`, `fecha_inicio`/`fecha_fin`, `responsable`, `proveedor`, `costo`, `participantes`, `resultado`, plus `estado` (Task 1) ✅, admin create form with correct `Select` label handling (Task 2) ✅, `estado`/`resultado` management (Task 2) ✅, admin list page + nav (Task 3) ✅, no anonymous/public path anywhere (Task 1's SQL, confirmed in Task 4) ✅. Explicitly-out-of-scope items (quantitative before/after indicator comparison, recommendation engine, participant lists, cross-links to other modules, dashboard integration) are not implemented anywhere in this plan, matching the spec.
- **Placeholder scan:** no TBD/TODO; every step has complete code.
- **Type consistency:** `Campana`/`EstadoCampana`/`TipoCampana` (Task 1) are used with identical names and shapes across Tasks 2-3. `mapCampanaRow` signature is consistent everywhere it's called. `TIPO_LABELS` is defined identically (same 9 keys, same Spanish labels) in both `CampanaSheet.tsx` and `CampanasTable.tsx` — verified no drift between the two copies.
