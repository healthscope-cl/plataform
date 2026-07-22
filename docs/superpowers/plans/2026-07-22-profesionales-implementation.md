# Profesionales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a directory of external/internal professionals (`profesionales`) with an admin-managed list at `/plataforma/profesionales` — tipo (from a fixed 8-value catalog), nombre, email, telefono, notas, and an `activo`/`inactivo` toggle. No public/anonymous path, no link to other modules.

**Architecture:** One new table `profesionales`, admin-only read/write via RLS (no `anon` role anywhere). Unlike the last four modules (`eventos_seguridad`, `evaluaciones_ergonomicas`, `intervenciones`, `campanas`), this module has no forward-only estado machine — it's a roster with a simple boolean toggle, so it follows the earlier `reglas_alerta` pattern instead: one dual-mode Sheet component that handles both create and edit, plus a toggle button on the table (not a separate "Gestionar" Sheet).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr`), `react-hook-form` + `zod`, shadcn/ui on `@base-ui/react`, Tailwind v4.

## Global Constraints

- Admin write access uses `isAdminRole(rolClave)` (`superadmin`/`admin_cliente` only) — same as every other module.
- `lib/`-internal cross-file imports are **relative**, never the `@/` alias.
- Every table migration block is: `create table` → `alter table ... enable row level security` → `create policy` statements → `grant` statements, all together in one block in `supabase/schema.sql`.
- No delete policy anywhere on `profesionales` — matches every other append-only table in this project. A professional who stops working with the company is marked `activo = false`, never deleted.
- **No `anon` role anywhere on this table** — no public path for this module.
- `tipo` is a closed `check` constraint with exactly these 8 values (from `referencia/instrucciones2.txt` módulo 10): `psicologo`, `kinesiologo`, `ergonomo`, `terapeuta_ocupacional`, `nutricionista`, `medico_laboral`, `prevencionista`, `podologo`. Do not add, remove, or rename any value.
- **This module does NOT reuse or replace** the free-text `responsable` field in `intervenciones` or `proveedor` field in `campanas` — those stay untouched. Do not modify either of those two already-shipped modules in this plan.
- **Every `SelectValue` MUST have an explicit `children` render function**, never a bare `<SelectValue />` — this project's `@base-ui/react` `Select` does not auto-resolve labels (an app-wide bug fix already established this pattern; the `campanas` module already followed it correctly for its `tipo` field, this plan's `tipo` field must too).
- `email`, `telefono`, `notas` are all optional plain-`string` fields in the zod schema (not validated with `z.string().email()` — deliberately kept simple, an `<input type="email">` gives basic browser-level hinting only), parsed manually in `onSubmit` via `.trim() ? value : null`.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required exact invocation on this machine (default heap OOMs).

---

## File Structure

```
supabase/schema.sql                                       (MODIFY — append profesionales)
lib/profesionales/types.ts                                 (CREATE)
components/platform/profesionales/ProfesionalSheet.tsx     (CREATE — dual create/edit form)
components/platform/profesionales/ProfesionalesTable.tsx   (CREATE — list, toggle activo, wires the sheet)
app/plataforma/profesionales/page.tsx                       (CREATE — admin page)
components/platform/Sidebar.tsx                             (MODIFY — nav entry)
```

---

### Task 1: Schema + types

**Files:**
- Modify: `supabase/schema.sql` (append at end of file)
- Create: `lib/profesionales/types.ts`

**Interfaces:**
- Produces: `TipoProfesional` type, `Profesional` type, `mapProfesionalRow(row)` function — all consumed by later tasks.

- [ ] **Step 1: Append the table + RLS to `supabase/schema.sql`**

Append this exact block at the end of the file:

```sql

-- ============================================================
-- PROFESSIONALS: profesionales
-- ============================================================

create table profesionales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  tipo text not null check (tipo in (
    'psicologo', 'kinesiologo', 'ergonomo', 'terapeuta_ocupacional',
    'nutricionista', 'medico_laboral', 'prevencionista', 'podologo'
  )),
  nombre text not null,
  email text,
  telefono text,
  notas text,
  activo boolean not null default true
);

alter table profesionales enable row level security;

create policy "profesionales_select_same_tenant" on profesionales
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "profesionales_insert_admin" on profesionales
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "profesionales_update_admin" on profesionales
  for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update on profesionales to authenticated;
grant all on profesionales to service_role;
```

Note: no `insert_publico` policy, no `grant ... to anon` — matches every module built since `eventos_seguridad`.

- [ ] **Step 2: Create `lib/profesionales/types.ts`**

```typescript
export type TipoProfesional =
  | 'psicologo'
  | 'kinesiologo'
  | 'ergonomo'
  | 'terapeuta_ocupacional'
  | 'nutricionista'
  | 'medico_laboral'
  | 'prevencionista'
  | 'podologo'

export type Profesional = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  tipo: TipoProfesional
  nombre: string
  email: string | null
  telefono: string | null
  notas: string | null
  activo: boolean
}

export function mapProfesionalRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  tipo: string
  nombre: string
  email: string | null
  telefono: string | null
  notas: string | null
  activo: boolean
}): Profesional {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    tipo: row.tipo as TipoProfesional,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono,
    notas: row.notas,
    activo: row.activo,
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql lib/profesionales/types.ts
git commit -m "feat: add profesionales schema and types"
```

---

### Task 2: Admin Sheet form (dual create/edit)

**Files:**
- Create: `components/platform/profesionales/ProfesionalSheet.tsx`

**Interfaces:**
- Consumes: `Profesional`, `mapProfesionalRow` from `@/lib/profesionales/types`. `createClient` from `@/lib/supabase/client`, `logAudit` from `@/lib/platform/audit`.
- Produces: `ProfesionalSheet` (props: `tenantId`, `empresaId`, `actorId`, `profesional?: Profesional` (optional — omitted means create mode, provided means edit mode), `onSaved: (profesional: Profesional) => void`) — consumed by Task 3's `ProfesionalesTable`.

- [ ] **Step 1: Create `components/platform/profesionales/ProfesionalSheet.tsx`**

```tsx
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
```

Notes:
- This is a **dual-mode** component (mirrors `ReglaAlertaSheet.tsx`, not the create-only Sheets used in the last four modules): when `profesional` prop is omitted, it creates; when provided, it edits that record and calls `.update()` instead of `.insert()`.
- `email`/`telefono`/`notas` stay plain `string` fields in the zod schema, parsed manually — an empty field becomes `null`, never an empty string in the database.
- `SelectValue` has an explicit `children` function — do not simplify to bare `<SelectValue />`.

- [ ] **Step 2: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors in the new file (not yet imported anywhere, so no wiring errors expected either).

- [ ] **Step 3: Commit**

```bash
git add components/platform/profesionales/ProfesionalSheet.tsx
git commit -m "feat: add profesionales admin form"
```

---

### Task 3: Admin table (with activo toggle) + page + nav

**Files:**
- Create: `components/platform/profesionales/ProfesionalesTable.tsx`
- Create: `app/plataforma/profesionales/page.tsx`
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: `ProfesionalSheet` from Task 2 (exact prop shape above), `Profesional`/`mapProfesionalRow` from Task 1, `isAdminRole` from `lib/platform/roles.ts`, `mapUsuarioRow`/`mapRolRow` from `lib/platform/types.ts`.
- Produces: the `/plataforma/profesionales` route, reachable from the sidebar.

- [ ] **Step 1: Create `components/platform/profesionales/ProfesionalesTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { isAdminRole } from '@/lib/platform/roles'
import type { Profesional } from '@/lib/profesionales/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProfesionalSheet } from './ProfesionalSheet'

const TIPO_LABELS: Record<Profesional['tipo'], string> = {
  psicologo: 'Psicólogo',
  kinesiologo: 'Kinesiólogo',
  ergonomo: 'Ergónomo',
  terapeuta_ocupacional: 'Terapeuta ocupacional',
  nutricionista: 'Nutricionista',
  medico_laboral: 'Médico laboral',
  prevencionista: 'Prevencionista',
  podologo: 'Podólogo',
}

export function ProfesionalesTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialProfesionales,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialProfesionales: Profesional[]
}) {
  const [profesionales, setProfesionales] = useState(initialProfesionales)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(profesional: Profesional) {
    setProfesionales((prev) => {
      const existe = prev.some((p) => p.id === profesional.id)
      return existe ? prev.map((p) => (p.id === profesional.id ? profesional : p)) : [...prev, profesional]
    })
  }

  async function handleToggleActivo(profesional: Profesional) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('profesionales')
      .update({ activo: !profesional.activo })
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
      datosDespues: { activo: !profesional.activo },
    })

    setProfesionales((prev) => prev.map((p) => (p.id === profesional.id ? { ...p, activo: !profesional.activo } : p)))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <ProfesionalSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {profesionales.map((profesional) => (
            <TableRow key={profesional.id}>
              <TableCell>{TIPO_LABELS[profesional.tipo]}</TableCell>
              <TableCell>{profesional.nombre}</TableCell>
              <TableCell>{profesional.email ?? '—'}</TableCell>
              <TableCell>{profesional.telefono ?? '—'}</TableCell>
              <TableCell>
                <Badge
                  variant={profesional.activo ? 'default' : 'outline'}
                  className={profesional.activo ? 'bg-success/10 text-success' : undefined}
                >
                  {profesional.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <ProfesionalSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    profesional={profesional}
                    onSaved={handleSaved}
                  />
                  <Button variant="outline" size="sm" onClick={() => handleToggleActivo(profesional)}>
                    {profesional.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {profesionales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 6 : 5} className="py-4 text-center text-muted-foreground">
                No hay profesionales registrados.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
```

Note: the "Activo" badge uses `bg-success/10 text-success` — this exact class combination already exists and is used identically in `ReglasAlertaTable.tsx` for its "Activa" badge, backed by the `--success`/`--color-success` token added to `app/globals.css` earlier in this project. Do not invent a different color.

- [ ] **Step 2: Create `app/plataforma/profesionales/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapProfesionalRow } from '@/lib/profesionales/types'
import { ProfesionalesTable } from '@/components/platform/profesionales/ProfesionalesTable'

export default async function ProfesionalesPage() {
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

  const { data: profesionalRows } = await supabase
    .from('profesionales')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nombre', { ascending: true })
  const profesionales = (profesionalRows ?? []).map(mapProfesionalRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Profesionales</h1>
      <ProfesionalesTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialProfesionales={profesionales}
      />
    </div>
  )
}
```

Note: ordered by `nombre` ascending (alphabetical), not `created_at` descending like the log-style modules — a directory of professionals reads better sorted by name than by insertion order. This is a deliberate difference from `intervenciones`/`campanas`, not an error.

- [ ] **Step 3: Add Sidebar nav entry**

In `components/platform/Sidebar.tsx`, find the `NAV_ITEMS` array. Add a new entry immediately after the `campanas` entry (`{ href: '/plataforma/campanas', label: 'Campañas', adminOnly: true }`):

```typescript
  { href: '/plataforma/profesionales', label: 'Profesionales', adminOnly: true },
```

So the array reads (in this order): `resumen`, `alertas`, `encuestas`, `seguridad`, `ergonomia`, `intervenciones`, `campanas`, `profesionales`, `organizacion`, ... (unchanged rest).

- [ ] **Step 4: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run`
Expected: all existing tests still pass (no new tests in this plan — this module has no pure function).

- [ ] **Step 6: Manual smoke check (dev server)**

Run: `npm run dev` (or confirm it's already running), then navigate to `/plataforma/profesionales` while logged in as an admin.
Expected: page loads, shows "No hay profesionales registrados." and a "Nuevo profesional" button; opening it shows the tipo dropdown with human-readable labels ("Psicólogo", "Kinesiólogo", etc.), not raw enum values; "Profesionales" appears in the sidebar between "Campañas" and "Organización".

- [ ] **Step 7: Commit**

```bash
git add components/platform/profesionales/ProfesionalesTable.tsx app/plataforma/profesionales/page.tsx components/platform/Sidebar.tsx
git commit -m "feat: add profesionales admin page"
```

---

### Task 4: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user) to run against the deployed/production environment after Tasks 1-3 are merged and the schema is applied to production Supabase.

- [ ] **Step 1: Apply the Task 1 SQL block to production Supabase**

Via the Supabase SQL Editor (browser automation, only on an already-authenticated session — never enter credentials), run the `profesionales` table + RLS + grants block from Task 1, Step 1, against the production project (`jjnrrkwydpsetugxtgea`).

- [ ] **Step 2: Verify no `anon` data-access grant exists**

In the SQL Editor: `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'profesionales' order by grantee, privilege_type;` — expected: `authenticated` has `select`/`insert`/`update`, `service_role` has everything. `anon` may appear with `REFERENCES`/`TRIGGER`/`TRUNCATE` (a confirmed Postgres/Supabase-wide baseline, not a data-access risk) — but `anon` must **not** have `select`, `insert`, `update`, or `delete`.

- [ ] **Step 3: Verify the tipo dropdown labels, create, and edit flow**

Log in to production as an admin. Go to `/plataforma/profesionales`, open "Nuevo profesional", confirm the "Tipo" dropdown trigger and its opened list both show human-readable Spanish labels (e.g. "Terapeuta ocupacional"), never raw values. Create a test professional leaving email/telefono/notas empty, confirm it saves without error and shows "—" for the empty email/telefono columns. Click "Editar" on that same row, confirm the Sheet opens pre-filled with the existing values (tipo, nombre), fill in an email and telefono this time, save, and confirm the table row updates in place (not duplicated).

- [ ] **Step 4: Verify the activo/inactivo toggle**

Click "Desactivar" on the test professional, confirm the badge switches to "Inactivo" and the button now reads "Activar". Click "Activar", confirm it switches back to "Activo".

- [ ] **Step 5: Clean up test data**

Delete the test professional directly via the SQL Editor (`delete from profesionales where nombre = '<test name>'`) — there is no delete UI, by design.

- [ ] **Step 6: Report results to the user**

Summarize: schema applied ✅/❌, no `anon` data-access grant confirmed ✅/❌, tipo dropdown shows correct labels ✅/❌, create+edit flow confirmed ✅/❌, activo/inactivo toggle confirmed ✅/❌. If everything passes, ask the user which module from `referencia/instrucciones2.txt` to tackle next.

---

## Self-Review Notes

- **Spec coverage:** schema with `tipo` (closed 8-value catalog), `nombre`, `email`, `telefono`, `notas`, `activo` (Task 1) ✅, dual create/edit form (Task 2) ✅, list page with activo toggle + nav (Task 3) ✅, no anonymous/public path anywhere (Task 1's SQL, confirmed in Task 4) ✅, no modification to `intervenciones` or `campanas` (confirmed — this plan's File Structure lists no changes to either module's files) ✅. Explicitly-out-of-scope items (linking to other modules, provider benchmarking, external integrations, scheduling) are not implemented anywhere in this plan, matching the spec.
- **Placeholder scan:** no TBD/TODO; every step has complete code.
- **Type consistency:** `Profesional`/`TipoProfesional` (Task 1) are used with identical names and shapes across Tasks 2-3. `mapProfesionalRow` signature is consistent everywhere it's called. `TIPO_LABELS` is defined identically (same 8 keys, same Spanish labels) in both `ProfesionalSheet.tsx` and `ProfesionalesTable.tsx` — verified no drift between the two copies.
