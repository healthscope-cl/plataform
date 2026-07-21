# Encuestas Anónimas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create a survey from a fixed catalog of preventive-wellness questions,
share it as a public no-login link, and see aggregated (never individual) results — per
`docs/superpowers/specs/2026-07-21-encuestas-design.md`.

**Architecture:** Same stack as the rest of the platform — Next.js 16 (App Router) + Supabase,
no separate backend. The public response flow reuses the exact mechanism the home page's demo
request form already proved out: an unauthenticated `anon`-role insert, gated entirely by RLS,
no Route Handler. Aggregation is a pure function, same family as `computeIndicadores`/
`evaluarReglas`, reusing `MIN_GROUP_SIZE` from `lib/indicators/formulas.ts` for small-group
suppression — no new privacy mechanism invented, the existing one is reused.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui
(`base-nova` style, on `@base-ui/react`) + `react-hook-form` + `zod` + `@supabase/ssr` + Vitest.

## Global Constraints

- **No AI/ML.** Aggregation is arithmetic (an average and a count) — same hard requirement as
  the rest of this project.
- **The question catalog is fixed, in code** (`lib/encuestas/catalogo.ts`), not a database
  table. Adding/editing a catalog question is a reviewed code change, not a data operation.
- **`encuesta_respuestas` never stores any respondent identifier** — no `persona_id`, no
  `rut_hash`, nothing that could be joined back to a specific person. This is why small-group
  suppression is even meaningful here: it is structurally impossible to de-anonymize a stored
  response, on top of the `MIN_GROUP_SIZE` aggregate suppression.
- **No edit of `pregunta_ids` after a survey is created**, and no delete of a submitted
  response by anyone (not even an admin) — matches the spec's "sin borrar, sin editar" stance,
  same principle already applied to `auditoria` and `reglas_alerta`.
- **Public survey response reuses the `demo_requests` RLS pattern exactly**: an `insert`-only
  policy scoped to the `anon` role (and `authenticated`, so a logged-in tester isn't blocked),
  plus the matching `grant` in the same migration block — see `supabase/schema.sql`'s
  `demo_requests` table for the working precedent, copy it, don't reinvent it.
- **`/encuestas/[id]` (the public response page) must NOT be placed under `/plataforma`** —
  `proxy.ts`'s auth matcher is `['/plataforma/:path*']` (verified directly in the current file),
  so a route outside that prefix is already unauthenticated by default. Do not modify
  `proxy.ts` in this plan — it needs no change.
- Every table query filters by `empresa_id` (or, for the public response path where no session
  exists, is gated entirely by RLS using `encuesta_id`, not a session-derived tenant) — same
  tenant-isolation convention as every existing query in this project, adapted for the one
  genuinely public write path.
- `@base-ui/react` quirks already discovered (still apply): `SheetTrigger` takes
  `render={<Button .../>}`, never `asChild`. This project has no shadcn `Checkbox` primitive
  yet (checked `components/ui/`) — Task 3's question picklist uses a plain styled
  `<input type="checkbox">`, not an invented dependency.
- WCAG 2.2 AA: every form control has a label or accessible name; the public 1-5 scale buttons
  use `aria-pressed` to expose selection state.
- Every step that changes code shows the code. No "similar to Task N", no TODOs.
- This machine OOMs `tsc`/`vitest` at default heap size — run every verification as
  `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` /
  `... vitest run <path>` (small heap, local binary, not npx).

## File Structure

```
supabase/
  schema.sql                              (MODIFY — append encuestas + encuesta_respuestas)
lib/
  encuestas/
    catalogo.ts                           (CREATE — fixed 8-question catalog)
    types.ts                              (CREATE — Encuesta/EncuestaRespuesta + mappers)
    agregar.ts                            (CREATE — agregarRespuestas pure function)
    agregar.test.ts                       (CREATE)
components/
  platform/
    encuestas/
      EncuestaSheet.tsx                   (CREATE — create form, no edit mode)
      EncuestasTable.tsx                  (CREATE — list + estado control + copy link)
    Sidebar.tsx                           (MODIFY — add nav item)
  encuestas/
    EncuestaResponderForm.tsx             (CREATE — public response form, client component)
app/
  plataforma/
    encuestas/
      page.tsx                           (CREATE — admin list)
      [id]/
        page.tsx                         (CREATE — aggregated results, admin-auth required)
  encuestas/
    [id]/
      page.tsx                           (CREATE — public response page, no auth)
```

---

### Task 1: Schema, catalog, and types

**Files:**
- Modify: `supabase/schema.sql` (append)
- Create: `lib/encuestas/catalogo.ts`
- Create: `lib/encuestas/types.ts`

**Interfaces:**
- Produces: SQL tables `encuestas` and `encuesta_respuestas`; `CATALOGO_PREGUNTAS` (the fixed
  question list); `Encuesta`, `EstadoEncuesta`, `EncuestaRespuesta` types plus
  `mapEncuestaRow()`/`mapEncuestaRespuestaRow()`, following the same camelCase/snake_case
  convention as `lib/alertas/types.ts`.

- [ ] **Step 1: Append the schema to `supabase/schema.sql`**

```sql
-- ============================================================
-- SURVEYS: encuestas, encuesta_respuestas
-- ============================================================

create table encuestas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  titulo text not null,
  descripcion text,
  pregunta_ids text[] not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'activa', 'cerrada')),
  fecha_apertura date,
  fecha_cierre date
);

alter table encuestas enable row level security;

create policy "encuestas_select_same_tenant" on encuestas
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "encuestas_select_public_activa" on encuestas
  for select to anon, authenticated using (estado = 'activa');

create policy "encuestas_insert_admin" on encuestas
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "encuestas_update_admin" on encuestas
  for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update on encuestas to authenticated;
grant select on encuestas to anon;
grant all on encuestas to service_role;

create table encuesta_respuestas (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references encuestas(id) on delete cascade,
  created_at timestamptz not null default now(),
  respuestas jsonb not null
);

alter table encuesta_respuestas enable row level security;

create policy "encuesta_respuestas_insert_activa" on encuesta_respuestas
  for insert to anon, authenticated
  with check (encuesta_id in (select id from encuestas where estado = 'activa'));

create policy "encuesta_respuestas_select_same_tenant" on encuesta_respuestas
  for select to authenticated
  using (encuesta_id in (select id from encuestas where tenant_id = auth_tenant_id()));

grant insert on encuesta_respuestas to anon;
grant insert, select on encuesta_respuestas to authenticated;
grant all on encuesta_respuestas to service_role;
```

No update/delete policy or grant on either table for `authenticated` beyond what's listed —
`encuestas` allows `update` only for the admin-gated state transitions (Task 3), and
`encuesta_respuestas` allows no update/delete for anyone except `service_role` (Global
Constraints: a submitted response is never editable or deletable).

The `encuestas_select_public_activa` policy uses `anon, authenticated` (not `anon` alone) so
that a logged-in user (e.g. an admin previewing the link, or someone logged into an unrelated
tenant) can still see an active survey's public metadata — that data (título/descripción/
preguntas) carries no personal information, so there's no reason to restrict it by tenant.

- [ ] **Step 2: Create `lib/encuestas/catalogo.ts`**

```typescript
export type PreguntaCatalogo = { id: string; texto: string }

export const CATALOGO_PREGUNTAS: PreguntaCatalogo[] = [
  { id: 'estres', texto: 'Nivel de estrés percibido esta semana' },
  { id: 'fatiga', texto: 'Nivel de fatiga percibida esta semana' },
  { id: 'sueno', texto: 'Calidad del sueño esta semana' },
  { id: 'carga', texto: 'Percepción de carga de trabajo' },
  { id: 'dolor_musculoesqueletico', texto: 'Molestias musculoesqueléticas (espalda, cuello, muñecas)' },
  { id: 'liderazgo', texto: 'Percepción de apoyo de la jefatura directa' },
  { id: 'conciliacion', texto: 'Equilibrio entre trabajo y vida personal' },
  { id: 'pausas_activas', texto: 'Cumplimiento de pausas activas durante la jornada' },
]
```

- [ ] **Step 3: Create `lib/encuestas/types.ts`**

```typescript
export type EstadoEncuesta = 'borrador' | 'activa' | 'cerrada'

export type Encuesta = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  titulo: string
  descripcion: string | null
  preguntaIds: string[]
  estado: EstadoEncuesta
  fechaApertura: string | null
  fechaCierre: string | null
}

export function mapEncuestaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  titulo: string
  descripcion: string | null
  pregunta_ids: string[]
  estado: string
  fecha_apertura: string | null
  fecha_cierre: string | null
}): Encuesta {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    titulo: row.titulo,
    descripcion: row.descripcion,
    preguntaIds: row.pregunta_ids,
    estado: row.estado as EstadoEncuesta,
    fechaApertura: row.fecha_apertura,
    fechaCierre: row.fecha_cierre,
  }
}

export type EncuestaRespuesta = {
  id: string
  encuestaId: string
  createdAt: string
  respuestas: Record<string, number>
}

export function mapEncuestaRespuestaRow(row: {
  id: string
  encuesta_id: string
  created_at: string
  respuestas: Record<string, number>
}): EncuestaRespuesta {
  return {
    id: row.id,
    encuestaId: row.encuesta_id,
    createdAt: row.created_at,
    respuestas: row.respuestas,
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql lib/encuestas/catalogo.ts lib/encuestas/types.ts
git commit -m "feat: add encuestas schema, fixed question catalog, and types"
```

---

### Task 2: Aggregation engine

**Files:**
- Create: `lib/encuestas/agregar.ts`
- Test: `lib/encuestas/agregar.test.ts`

**Interfaces:**
- Consumes: `MIN_GROUP_SIZE` from `lib/indicators/formulas.ts` (existing, reused — relative
  import, matching this codebase's `lib/`-internal convention).
- Produces: `ResultadoPregunta` type (`{ promedio: number; cantidad: number } | { suprimido:
  true }`) and `agregarRespuestas()`. Task 4's results page is the only consumer.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/encuestas/agregar.test.ts
import { describe, expect, it } from 'vitest'
import { agregarRespuestas } from './agregar'

describe('agregarRespuestas', () => {
  it('calcula el promedio correcto por pregunta cuando hay suficientes respuestas', () => {
    const respuestas = Array.from({ length: 5 }, (_, i) => ({ estres: i + 1 }))
    const resultado = agregarRespuestas({ preguntaIds: ['estres'], respuestas })
    expect(resultado.estres).toEqual({ promedio: 3, cantidad: 5 })
  })

  it('suprime una pregunta con menos de MIN_GROUP_SIZE respuestas', () => {
    const respuestas = [{ estres: 5 }, { estres: 4 }]
    const resultado = agregarRespuestas({ preguntaIds: ['estres'], respuestas })
    expect(resultado.estres).toEqual({ suprimido: true })
  })

  it('maneja una encuesta sin respuestas todavia', () => {
    const resultado = agregarRespuestas({ preguntaIds: ['estres', 'fatiga'], respuestas: [] })
    expect(resultado.estres).toEqual({ suprimido: true })
    expect(resultado.fatiga).toEqual({ suprimido: true })
  })

  it('solo incluye preguntas listadas en preguntaIds, ignorando otras claves presentes en las respuestas', () => {
    const respuestas = Array.from({ length: 5 }, () => ({ estres: 3, fatiga: 4, otraPregunta: 1 }))
    const resultado = agregarRespuestas({ preguntaIds: ['estres'], respuestas })
    expect(Object.keys(resultado)).toEqual(['estres'])
  })

  it('ignora respuestas parciales que no incluyen una pregunta especifica al calcular su promedio', () => {
    const respuestas = [
      ...Array.from({ length: 5 }, () => ({ estres: 5 })),
      { fatiga: 1 },
    ]
    const resultado = agregarRespuestas({ preguntaIds: ['estres'], respuestas })
    expect(resultado.estres).toEqual({ promedio: 5, cantidad: 5 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/encuestas/agregar.test.ts`
Expected: FAIL with "Cannot find module './agregar'"

- [ ] **Step 3: Write `lib/encuestas/agregar.ts`**

```typescript
import { MIN_GROUP_SIZE } from '../indicators/formulas'

export type ResultadoPregunta = { promedio: number; cantidad: number } | { suprimido: true }

export function agregarRespuestas(input: {
  preguntaIds: string[]
  respuestas: Array<Record<string, number>>
}): Record<string, ResultadoPregunta> {
  const resultado: Record<string, ResultadoPregunta> = {}

  for (const preguntaId of input.preguntaIds) {
    const valores = input.respuestas
      .map((r) => r[preguntaId])
      .filter((v): v is number => typeof v === 'number')

    if (valores.length < MIN_GROUP_SIZE) {
      resultado[preguntaId] = { suprimido: true }
      continue
    }

    const suma = valores.reduce((acc, v) => acc + v, 0)
    resultado[preguntaId] = { promedio: suma / valores.length, cantidad: valores.length }
  }

  return resultado
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/encuestas/agregar.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add lib/encuestas/agregar.ts lib/encuestas/agregar.test.ts
git commit -m "feat: add pure survey response aggregation with small-group suppression"
```

---

### Task 3: Admin survey list and creation

**Files:**
- Create: `components/platform/encuestas/EncuestaSheet.tsx`
- Create: `components/platform/encuestas/EncuestasTable.tsx`
- Create: `app/plataforma/encuestas/page.tsx`
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: `CATALOGO_PREGUNTAS`, `Encuesta`, `EstadoEncuesta`, `mapEncuestaRow` (Task 1);
  `isAdminRole` (`lib/platform/roles.ts`, existing); `logAudit` (`lib/platform/audit.ts`,
  existing).
- Produces: the admin-facing half of the feature. Task 4 links to
  `/plataforma/encuestas/[id]` from this table; Task 5's public page is reached via the "Copiar
  link" action here, not a code dependency.

- [ ] **Step 1: Create `components/platform/encuestas/EncuestaSheet.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `components/platform/encuestas/EncuestasTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { isAdminRole } from '@/lib/platform/roles'
import type { Encuesta, EstadoEncuesta } from '@/lib/encuestas/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EncuestaSheet } from './EncuestaSheet'

const SIGUIENTE_ESTADO: Record<EstadoEncuesta, EstadoEncuesta | null> = {
  borrador: 'activa',
  activa: 'cerrada',
  cerrada: null,
}

const ACCION_LABEL: Record<EstadoEncuesta, string> = {
  borrador: 'Activar',
  activa: 'Cerrar',
  cerrada: '',
}

const ESTADO_LABEL: Record<EstadoEncuesta, string> = {
  borrador: 'Borrador',
  activa: 'Activa',
  cerrada: 'Cerrada',
}

export function EncuestasTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialEncuestas,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialEncuestas: Encuesta[]
}) {
  const [encuestas, setEncuestas] = useState(initialEncuestas)
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(encuesta: Encuesta) {
    setEncuestas((prev) => [encuesta, ...prev])
  }

  async function handleAvanzarEstado(encuesta: Encuesta) {
    const siguiente = SIGUIENTE_ESTADO[encuesta.estado]
    if (!siguiente) return

    const supabase = createClient()
    const { error } = await supabase.from('encuestas').update({ estado: siguiente }).eq('id', encuesta.id)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'encuestas',
      entidadId: encuesta.id,
      accion: 'actualizar',
      datosAntes: { estado: encuesta.estado },
      datosDespues: { estado: siguiente },
    })

    setEncuestas((prev) => prev.map((e) => (e.id === encuesta.id ? { ...e, estado: siguiente } : e)))
  }

  function copiarLink(id: string) {
    const url = `${window.location.origin}/encuestas/${id}`
    navigator.clipboard.writeText(url)
    setLinkCopiado(id)
    setTimeout(() => setLinkCopiado((actual) => (actual === id ? null : actual)), 2000)
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <EncuestaSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {encuestas.map((encuesta) => (
            <TableRow key={encuesta.id}>
              <TableCell>{encuesta.titulo}</TableCell>
              <TableCell>
                <Badge variant="outline">{ESTADO_LABEL[encuesta.estado]}</Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Link href={`/plataforma/encuestas/${encuesta.id}`}>
                  <Button type="button" variant="outline" size="sm">
                    Ver resultados
                  </Button>
                </Link>
                {encuesta.estado === 'activa' ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => copiarLink(encuesta.id)}>
                    {linkCopiado === encuesta.id ? 'Copiado' : 'Copiar link'}
                  </Button>
                ) : null}
                {canEdit && SIGUIENTE_ESTADO[encuesta.estado] ? (
                  <Button type="button" size="sm" onClick={() => handleAvanzarEstado(encuesta)}>
                    {ACCION_LABEL[encuesta.estado]}
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
          {encuestas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-4 text-center text-muted-foreground">
                No hay encuestas creadas.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/plataforma/encuestas/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapEncuestaRow } from '@/lib/encuestas/types'
import { EncuestasTable } from '@/components/platform/encuestas/EncuestasTable'

export default async function EncuestasPage() {
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

  const { data: encuestaRows } = await supabase
    .from('encuestas')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const encuestas = (encuestaRows ?? []).map(mapEncuestaRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Encuestas</h1>
      <EncuestasTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialEncuestas={encuestas}
      />
    </div>
  )
}
```

- [ ] **Step 4: Modify `components/platform/Sidebar.tsx`**

Add one entry to `NAV_ITEMS`, right after the `Alertas` entry (or after `Resumen` if this task
runs before the alertas plan's nav entry exists — check the current file and place it
immediately after whichever of `Resumen`/`Alertas` is last before `Organización`):

```typescript
  { href: '/plataforma/encuestas', label: 'Encuestas', adminOnly: true },
```

- [ ] **Step 5: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add components/platform/encuestas/EncuestaSheet.tsx components/platform/encuestas/EncuestasTable.tsx app/plataforma/encuestas/page.tsx components/platform/Sidebar.tsx
git commit -m "feat: add survey creation and management page"
```

---

### Task 4: Aggregated results page

**Files:**
- Create: `app/plataforma/encuestas/[id]/page.tsx`

**Interfaces:**
- Consumes: `agregarRespuestas`, `ResultadoPregunta` (Task 2); `CATALOGO_PREGUNTAS` (Task 1);
  `mapEncuestaRow`, `mapEncuestaRespuestaRow` (Task 1).
- Produces: the results view. No later task depends on this one.

- [ ] **Step 1: Create `app/plataforma/encuestas/[id]/page.tsx`**

```tsx
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEncuestaRow, mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { agregarRespuestas } from '@/lib/encuestas/agregar'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'

export default async function ResultadosEncuestaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: encuestaRow } = await supabase.from('encuestas').select('*').eq('id', id).maybeSingle()
  if (!encuestaRow) notFound()
  const encuesta = mapEncuestaRow(encuestaRow)

  const { data: respuestaRows } = await supabase.from('encuesta_respuestas').select('*').eq('encuesta_id', id)
  const respuestas = (respuestaRows ?? []).map(mapEncuestaRespuestaRow)

  const resultados = agregarRespuestas({
    preguntaIds: encuesta.preguntaIds,
    respuestas: respuestas.map((r) => r.respuestas),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{encuesta.titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{respuestas.length} respuestas recibidas.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {encuesta.preguntaIds.map((preguntaId) => {
          const pregunta = CATALOGO_PREGUNTAS.find((p) => p.id === preguntaId)
          const resultado = resultados[preguntaId]
          return (
            <div key={preguntaId} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">{pregunta?.texto ?? preguntaId}</p>
              {resultado && 'suprimido' in resultado ? (
                <p className="mt-2 text-sm text-muted-foreground">Grupo insuficiente para mostrar</p>
              ) : resultado ? (
                <>
                  <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
                    {resultado.promedio.toFixed(1)} / 5
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Basado en {resultado.cantidad} respuestas</p>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

`params` is a `Promise` — Next.js 16's App Router convention for dynamic segments in a Server
Component; `await` it before use, as shown.

- [ ] **Step 2: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/plataforma/encuestas/[id]/page.tsx
git commit -m "feat: add aggregated survey results page"
```

---

### Task 5: Public response page

**Files:**
- Create: `components/encuestas/EncuestaResponderForm.tsx`
- Create: `app/encuestas/[id]/page.tsx`

**Interfaces:**
- Consumes: `CATALOGO_PREGUNTAS`, `mapEncuestaRow` (Task 1). Does not consume anything from
  Tasks 2-4 — this is the fully independent public half of the feature.
- Produces: the finished feature. No later task in this plan depends on this one.

- [ ] **Step 1: Create `components/encuestas/EncuestaResponderForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
import { Button } from '@/components/ui/button'

const ESCALA = [1, 2, 3, 4, 5]

export function EncuestaResponderForm({
  encuestaId,
  preguntaIds,
}: {
  encuestaId: string
  preguntaIds: string[]
}) {
  const [respuestas, setRespuestas] = useState<Record<string, number>>({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const preguntas = preguntaIds
    .map((id) => CATALOGO_PREGUNTAS.find((p) => p.id === id))
    .filter((p): p is (typeof CATALOGO_PREGUNTAS)[number] => Boolean(p))

  const completo = preguntas.every((p) => respuestas[p.id] !== undefined)

  async function handleSubmit() {
    setEnviando(true)
    const supabase = createClient()
    const { error } = await supabase.from('encuesta_respuestas').insert({ encuesta_id: encuestaId, respuestas })
    setEnviando(false)
    if (error) return
    setEnviado(true)
  }

  if (enviado) {
    return <p className="text-sm text-foreground">Gracias por tu respuesta.</p>
  }

  return (
    <div className="space-y-6">
      {preguntas.map((pregunta) => (
        <div key={pregunta.id} className="space-y-2">
          <p className="text-sm text-foreground">{pregunta.texto}</p>
          <div className="flex gap-2">
            {ESCALA.map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setRespuestas((prev) => ({ ...prev, [pregunta.id]: valor }))}
                className={
                  'h-10 w-10 rounded-full border text-sm font-medium ' +
                  (respuestas[pregunta.id] === valor
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-foreground hover:bg-muted')
                }
                aria-pressed={respuestas[pregunta.id] === valor}
              >
                {valor}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button type="button" disabled={!completo || enviando} onClick={handleSubmit}>
        {enviando ? 'Enviando…' : 'Enviar respuesta'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/encuestas/[id]/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { mapEncuestaRow } from '@/lib/encuestas/types'
import { EncuestaResponderForm } from '@/components/encuestas/EncuestaResponderForm'

export default async function EncuestaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: encuestaRow } = await supabase
    .from('encuestas')
    .select('*')
    .eq('id', id)
    .eq('estado', 'activa')
    .maybeSingle()

  if (!encuestaRow) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="font-heading text-xl font-semibold text-foreground">Esta encuesta ya no está disponible</h1>
        <p className="text-sm text-muted-foreground">Puede que haya cerrado o que el link ya no sea válido.</p>
      </div>
    )
  }

  const encuesta = mapEncuestaRow(encuestaRow)

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <div>
        <h1 className="font-heading text-xl font-semibold text-foreground">{encuesta.titulo}</h1>
        {encuesta.descripcion ? <p className="mt-2 text-sm text-muted-foreground">{encuesta.descripcion}</p> : null}
      </div>
      <EncuestaResponderForm encuestaId={encuesta.id} preguntaIds={encuesta.preguntaIds} />
    </div>
  )
}
```

This route lives at `app/encuestas/[id]/page.tsx` — **outside** `app/plataforma/`, so
`proxy.ts`'s `['/plataforma/:path*']` matcher does not apply to it and no unauthenticated
visitor is redirected to `/login`. Do not add this path to `proxy.ts`.

`createClient()` (server) here runs with no session (the visitor never logged in), so Supabase
treats every query as the `anon` role automatically — the `encuestas_select_public_activa`
policy (Task 1) is what makes the `.select('*').eq('estado', 'activa')` call succeed without
any authentication.

- [ ] **Step 3: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 4: Run full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run`
Expected: all test files pass, including Task 2's `lib/encuestas/agregar.test.ts`

- [ ] **Step 5: Commit**

```bash
git add components/encuestas/EncuestaResponderForm.tsx app/encuestas/[id]/page.tsx
git commit -m "feat: add public anonymous survey response page"
```

---

### Task 6: Manual verification (controller-only)

This step cannot be delegated to an implementer subagent — it requires applying the schema to
the live Supabase project and a real browser walkthrough, same constraint as prior plans.

- [ ] **Step 1: Full check suite**

```bash
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run
npm run build
```

Expected: all three pass clean, and the build output lists both `/plataforma/encuestas` (and
its `[id]` child) and the public `/encuestas/[id]` route.

- [ ] **Step 2: Apply the schema to the live Supabase project**

Via the SQL Editor, run the `encuestas` + `encuesta_respuestas` block (Task 1), then verify
with the same `information_schema.role_table_grants` query used in prior plans that the grants
landed alongside the RLS policies (expect `anon` to have only `select` on `encuestas` and only
`insert` on `encuesta_respuestas` — no `anon` write access to `encuestas` at all, and no `anon`
read access to `encuesta_respuestas`).

- [ ] **Step 3: Browser walkthrough**

As an admin: create a survey with 2-3 questions, activate it, copy the link. Open the link in
a private/incognito window (no session) and confirm the form renders and can be submitted.
Submit at least 5 responses (varying the browser/incognito session each time, since the form's
one-submission-per-session guard is client-side only) so the small-group suppression threshold
is cleared, then confirm `/plataforma/encuestas/[id]` shows real averages instead of "Grupo
insuficiente para mostrar". Close the survey and confirm the public link now shows "ya no está
disponible" instead of the form.

- [ ] **Step 4: Record the outcome**

Append a `Progress Ledger` entry for this plan to `.superpowers/sdd/progress.md`.
