# Intervenciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CRUD record of interventions (`intervenciones`) with an admin-managed list at `/plataforma/intervenciones` — problema, objetivo, responsable, presupuesto, fecha, indicadores, resultado, and a forward-only estado. No public/anonymous path, no link to `eventos_seguridad`/`evaluaciones_ergonomicas`, no computed/aggregation view.

**Architecture:** One new table `intervenciones`, admin-only read/write via RLS (no `anon` role anywhere, same shape as `evaluaciones_ergonomicas`). Admin UI follows the exact `evaluaciones_ergonomicas` pattern (Sheet forms + Table + page + Sidebar nav), simplified further — this module has no Select/dropdown fields at all (every field is free text, a number, or a date), and no pure aggregation function like `calcularPuestosCriticos`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr`), `react-hook-form` + `zod`, shadcn/ui on `@base-ui/react`, Tailwind v4.

## Global Constraints

- Admin write access uses `isAdminRole(rolClave)` (`superadmin`/`admin_cliente` only) — same as every other module.
- `lib/`-internal cross-file imports are **relative**, never the `@/` alias.
- Every table migration block is: `create table` → `alter table ... enable row level security` → `create policy` statements → `grant` statements, all together in one block in `supabase/schema.sql`.
- No delete policy anywhere on `intervenciones` — matches every other append-only table in this project.
- `estado` only moves forward: `planificada` → `en_ejecucion` → `completada`. No skipping, no going back.
- **No `anon` role anywhere on this table** — no public path for this module, same as `evaluaciones_ergonomicas`.
- **No foreign key to `eventos_seguridad` or `evaluaciones_ergonomicas`** — `intervenciones` is a fully independent table. Do not add a link between them in this plan.
- `indicadores` is a free-text field, **not** a reference to the 6 indicators in `lib/indicators/aggregate.ts` — do not constrain it to that enum.
- This module has no Select/dropdown UI at all — every form field is a text input, textarea, number input, or date input. Do not introduce a Select component where the brief doesn't have one.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required exact invocation on this machine (default heap OOMs).

---

## File Structure

```
supabase/schema.sql                                                (MODIFY — append intervenciones)
lib/intervenciones/types.ts                                        (CREATE)
components/platform/intervenciones/IntervencionSheet.tsx           (CREATE — admin create form)
components/platform/intervenciones/GestionarIntervencionSheet.tsx  (CREATE — advance estado + resultado)
components/platform/intervenciones/IntervencionesTable.tsx         (CREATE — list, wires both sheets)
app/plataforma/intervenciones/page.tsx                              (CREATE — admin page)
components/platform/Sidebar.tsx                                    (MODIFY — nav entry)
```

---

### Task 1: Schema + types

**Files:**
- Modify: `supabase/schema.sql` (append at end of file)
- Create: `lib/intervenciones/types.ts`

**Interfaces:**
- Produces: `EstadoIntervencion` type, `Intervencion` type, `mapIntervencionRow(row)` function — all consumed by later tasks.

- [ ] **Step 1: Append the table + RLS to `supabase/schema.sql`**

Append this exact block at the end of the file:

```sql

-- ============================================================
-- INTERVENTIONS: intervenciones
-- ============================================================

create table intervenciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  problema text not null,
  objetivo text not null,
  responsable text not null,
  presupuesto numeric,
  fecha date not null,
  indicadores text not null,
  resultado text,
  estado text not null default 'planificada' check (estado in ('planificada', 'en_ejecucion', 'completada'))
);

alter table intervenciones enable row level security;

create policy "intervenciones_select_same_tenant" on intervenciones
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "intervenciones_insert_admin" on intervenciones
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "intervenciones_update_admin" on intervenciones
  for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update on intervenciones to authenticated;
grant all on intervenciones to service_role;
```

Note: no `insert_publico` policy, no `grant ... to anon` — matches `evaluaciones_ergonomicas`, not `eventos_seguridad`.

- [ ] **Step 2: Create `lib/intervenciones/types.ts`**

```typescript
export type EstadoIntervencion = 'planificada' | 'en_ejecucion' | 'completada'

export type Intervencion = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  problema: string
  objetivo: string
  responsable: string
  presupuesto: number | null
  fecha: string
  indicadores: string
  resultado: string | null
  estado: EstadoIntervencion
}

export function mapIntervencionRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  problema: string
  objetivo: string
  responsable: string
  presupuesto: number | null
  fecha: string
  indicadores: string
  resultado: string | null
  estado: string
}): Intervencion {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    problema: row.problema,
    objetivo: row.objetivo,
    responsable: row.responsable,
    presupuesto: row.presupuesto,
    fecha: row.fecha,
    indicadores: row.indicadores,
    resultado: row.resultado,
    estado: row.estado as EstadoIntervencion,
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql lib/intervenciones/types.ts
git commit -m "feat: add intervenciones schema and types"
```

---

### Task 2: Admin Sheet forms

**Files:**
- Create: `components/platform/intervenciones/IntervencionSheet.tsx`
- Create: `components/platform/intervenciones/GestionarIntervencionSheet.tsx`

**Interfaces:**
- Consumes: `Intervencion`, `EstadoIntervencion`, `mapIntervencionRow` from `@/lib/intervenciones/types`. `createClient` from `@/lib/supabase/client`, `logAudit` from `@/lib/platform/audit`.
- Produces: `IntervencionSheet` (props: `tenantId`, `empresaId`, `actorId`, `onSaved: (intervencion: Intervencion) => void`) and `GestionarIntervencionSheet` (props: `tenantId`, `actorId`, `intervencion: Intervencion`, `onSaved: (intervencion: Intervencion) => void`) — both consumed by Task 3's `IntervencionesTable`.

- [ ] **Step 1: Create `components/platform/intervenciones/IntervencionSheet.tsx`**

```tsx
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

const schema = z.strictObject({
  problema: z.string().min(1, 'Requerido'),
  objetivo: z.string().min(1, 'Requerido'),
  responsable: z.string().min(1, 'Requerido'),
  presupuesto: z.string(),
  fecha: z.string().min(1, 'Requerido'),
  indicadores: z.string().min(1, 'Requerido'),
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
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

Note on `presupuesto`: it stays a plain `string` field in the zod schema (not `valueAsNumber`) so an empty input doesn't become `NaN` — it's parsed manually in `onSubmit` (`values.presupuesto.trim() ? Number(values.presupuesto) : null`). Do not change this to `{...form.register('presupuesto', { valueAsNumber: true })}` — that would break the optional case.

- [ ] **Step 2: Create `components/platform/intervenciones/GestionarIntervencionSheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import type { Intervencion, EstadoIntervencion } from '@/lib/intervenciones/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const SIGUIENTE_ESTADO: Record<EstadoIntervencion, EstadoIntervencion | null> = {
  planificada: 'en_ejecucion',
  en_ejecucion: 'completada',
  completada: null,
}

const ESTADO_LABEL: Record<EstadoIntervencion, string> = {
  planificada: 'Planificada',
  en_ejecucion: 'En ejecución',
  completada: 'Completada',
}

export function GestionarIntervencionSheet({
  tenantId,
  actorId,
  intervencion,
  onSaved,
}: {
  tenantId: string
  actorId: string
  intervencion: Intervencion
  onSaved: (intervencion: Intervencion) => void
}) {
  const [open, setOpen] = useState(false)
  const [resultado, setResultado] = useState(intervencion.resultado ?? '')
  const [guardando, setGuardando] = useState(false)
  const siguiente = SIGUIENTE_ESTADO[intervencion.estado]

  async function handleAvanzar() {
    if (!siguiente) return
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('intervenciones')
      .update({ estado: siguiente, resultado: resultado || null })
      .eq('id', intervencion.id)
    setGuardando(false)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'intervenciones',
      entidadId: intervencion.id,
      accion: 'actualizar',
      datosAntes: { estado: intervencion.estado, resultado: intervencion.resultado },
      datosDespues: { estado: siguiente, resultado },
    })

    onSaved({ ...intervencion, estado: siguiente, resultado: resultado || null })
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>Gestionar</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{intervencion.objetivo}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">Estado actual: {ESTADO_LABEL[intervencion.estado]}</p>
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
            <p className="text-sm text-muted-foreground">Esta intervención ya está completada.</p>
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
git add components/platform/intervenciones/IntervencionSheet.tsx components/platform/intervenciones/GestionarIntervencionSheet.tsx
git commit -m "feat: add intervenciones admin forms"
```

---

### Task 3: Admin table + page + nav

**Files:**
- Create: `components/platform/intervenciones/IntervencionesTable.tsx`
- Create: `app/plataforma/intervenciones/page.tsx`
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: `IntervencionSheet` and `GestionarIntervencionSheet` from Task 2 (exact prop shapes above), `Intervencion`/`mapIntervencionRow` from Task 1, `isAdminRole` from `lib/platform/roles.ts`, `mapUsuarioRow`/`mapRolRow` from `lib/platform/types.ts`.
- Produces: the `/plataforma/intervenciones` route, reachable from the sidebar.

- [ ] **Step 1: Create `components/platform/intervenciones/IntervencionesTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { isAdminRole } from '@/lib/platform/roles'
import type { Intervencion } from '@/lib/intervenciones/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { IntervencionSheet } from './IntervencionSheet'
import { GestionarIntervencionSheet } from './GestionarIntervencionSheet'

const ESTADO_LABEL: Record<Intervencion['estado'], string> = {
  planificada: 'Planificada',
  en_ejecucion: 'En ejecución',
  completada: 'Completada',
}

export function IntervencionesTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialIntervenciones,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialIntervenciones: Intervencion[]
}) {
  const [intervenciones, setIntervenciones] = useState(initialIntervenciones)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(intervencion: Intervencion) {
    setIntervenciones((prev) => {
      const existe = prev.some((i) => i.id === intervencion.id)
      return existe ? prev.map((i) => (i.id === intervencion.id ? intervencion : i)) : [intervencion, ...prev]
    })
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <IntervencionSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Problema</TableHead>
            <TableHead>Objetivo</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {intervenciones.map((intervencion) => (
            <TableRow key={intervencion.id}>
              <TableCell>{intervencion.problema}</TableCell>
              <TableCell>{intervencion.objetivo}</TableCell>
              <TableCell>{intervencion.responsable}</TableCell>
              <TableCell>{intervencion.fecha}</TableCell>
              <TableCell>
                <Badge variant="outline">{ESTADO_LABEL[intervencion.estado]}</Badge>
              </TableCell>
              {canEdit ? (
                <TableCell className="text-right">
                  <GestionarIntervencionSheet
                    tenantId={tenantId}
                    actorId={actorId}
                    intervencion={intervencion}
                    onSaved={handleSaved}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {intervenciones.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 6 : 5} className="py-4 text-center text-muted-foreground">
                No hay intervenciones registradas.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/plataforma/intervenciones/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapIntervencionRow } from '@/lib/intervenciones/types'
import { IntervencionesTable } from '@/components/platform/intervenciones/IntervencionesTable'

export default async function IntervencionesPage() {
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

  const { data: intervencionRows } = await supabase
    .from('intervenciones')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const intervenciones = (intervencionRows ?? []).map(mapIntervencionRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Intervenciones</h1>
      <IntervencionesTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialIntervenciones={intervenciones}
      />
    </div>
  )
}
```

- [ ] **Step 3: Add Sidebar nav entry**

In `components/platform/Sidebar.tsx`, find the `NAV_ITEMS` array. Add a new entry immediately after the `ergonomia` entry (`{ href: '/plataforma/ergonomia', label: 'Ergonomía', adminOnly: true }`):

```typescript
  { href: '/plataforma/intervenciones', label: 'Intervenciones', adminOnly: true },
```

So the array reads (in this order): `resumen`, `alertas`, `encuestas`, `seguridad`, `ergonomia`, `intervenciones`, `organizacion`, ... (unchanged rest).

- [ ] **Step 4: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run`
Expected: all existing tests still pass (no new tests in this plan — this module has no pure function).

- [ ] **Step 6: Manual smoke check (dev server)**

Run: `npm run dev` (or confirm it's already running), then navigate to `/plataforma/intervenciones` while logged in as an admin.
Expected: page loads, shows "No hay intervenciones registradas." and a "Nueva intervención" button; "Intervenciones" appears in the sidebar between "Ergonomía" and "Organización".

- [ ] **Step 7: Commit**

```bash
git add components/platform/intervenciones/IntervencionesTable.tsx app/plataforma/intervenciones/page.tsx components/platform/Sidebar.tsx
git commit -m "feat: add intervenciones admin page"
```

---

### Task 4: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user) to run against the deployed/production environment after Tasks 1-3 are merged and the schema is applied to production Supabase.

- [ ] **Step 1: Apply the Task 1 SQL block to production Supabase**

Via the Supabase SQL Editor (browser automation, only on an already-authenticated session — never enter credentials), run the `intervenciones` table + RLS + grants block from Task 1, Step 1, against the production project (`jjnrrkwydpsetugxtgea`).

- [ ] **Step 2: Verify no `anon` data-access grant exists**

In the SQL Editor: `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'intervenciones' order by grantee, privilege_type;` — expected: `authenticated` has `select`/`insert`/`update`, `service_role` has everything. `anon` may appear with `REFERENCES`/`TRIGGER`/`TRUNCATE` (confirmed in the ergonomía module's verification to be a Postgres/Supabase-wide baseline present even on tables with zero explicit anon grants, not a data-access risk) — but `anon` must **not** have `select`, `insert`, `update`, or `delete`. If it does, stop and investigate before proceeding.

- [ ] **Step 3: Verify estado only advances forward in the real UI, and the optional presupuesto field works both ways**

Log in to production as an admin. Go to `/plataforma/intervenciones`, create a test intervention leaving "Presupuesto" empty, confirm it saves without error and shows correctly (no crash from an empty numeric field). Open "Gestionar", confirm it offers only "Avanzar a en_ejecucion" (not a jump straight to "completada"). Advance it, add a `resultado` value, confirm the button now offers "Avanzar a completada". Advance again, confirm the sheet shows "Esta intervención ya está completada." with no further action available. Then create a second test intervention WITH a presupuesto value (e.g. `500000`), confirm it saves and the value round-trips correctly on reload.

- [ ] **Step 4: Clean up test data**

Delete both test interventions directly via the SQL Editor (`delete from intervenciones where problema = '<test description>'`) — there is no delete UI, by design.

- [ ] **Step 5: Report results to the user**

Summarize: schema applied ✅/❌, no `anon` data-access grant confirmed ✅/❌, forward-only estado confirmed in UI ✅/❌, optional presupuesto (empty and filled) confirmed working ✅/❌. If everything passes, ask the user which module from `referencia/instrucciones2.txt` to tackle next.

---

## Self-Review Notes

- **Spec coverage:** schema with all 7 documented fields (problema, objetivo, responsable, presupuesto, fecha, indicadores, resultado) plus the added `estado` (Task 1) ✅, admin create form (Task 2) ✅, `estado`/`resultado` management (Task 2) ✅, admin list page + nav (Task 3) ✅, no anonymous/public path anywhere (Task 1's SQL, confirmed in Task 4) ✅, no FK to `eventos_seguridad`/`evaluaciones_ergonomicas` anywhere (Task 1's SQL has no such column) ✅. Explicitly-out-of-scope items (campaign-linked before/after measurement, recommendation engine, structured intervention catalog, dashboard integration) are not implemented anywhere in this plan, matching the spec.
- **Placeholder scan:** no TBD/TODO; every step has complete code.
- **Type consistency:** `Intervencion`/`EstadoIntervencion` (Task 1) are used with identical names and shapes across Tasks 2-3. `mapIntervencionRow` signature is consistent everywhere it's called.
