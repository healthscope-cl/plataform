# Ergonomía Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ergonomic risk assessments per cargo (`evaluaciones_ergonomicas`) with an admin-managed list at `/plataforma/ergonomia`, including a computed "puestos críticos" view. No public/anonymous path — every assessment is entered by an admin/professional.

**Architecture:** One new table `evaluaciones_ergonomicas`, admin-only read/write via RLS (no `anon` role anywhere on this table). A pure function `calcularPuestosCriticos` derives which cargos are currently flagged critical from the most recent unresolved high-risk assessment per cargo. Admin UI follows the exact `eventos_seguridad` pattern (Sheet forms + Table + page + Sidebar nav), simplified since there's no public-reporting task this time.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr`), `react-hook-form` + `zod`, shadcn/ui on `@base-ui/react`, Tailwind v4, Vitest.

## Global Constraints

- Admin write access uses `isAdminRole(rolClave)` (`superadmin`/`admin_cliente` only) — same as every other module.
- `lib/`-internal cross-file imports are **relative**, never the `@/` alias.
- Every table migration block is: `create table` → `alter table ... enable row level security` → `create policy` statements → `grant` statements, all together in one block in `supabase/schema.sql`.
- No delete policy anywhere on `evaluaciones_ergonomicas` — matches every other append-only table in this project.
- `estado` only moves forward: `pendiente` → `en_progreso` → `resuelto`. No skipping, no going back.
- **No `anon` role anywhere on this table** — unlike `eventos_seguridad`, there is no public reporting path for this module. Do not add one.
- "Puestos críticos" is computed **only** from `evaluaciones_ergonomicas` — it does NOT cross-reference the `dolor_musculoesqueletico` survey question. That cross-reference is technically impossible without capturing `cargo_id` on anonymous survey responses, which would break the anonymity guarantee established in the encuestas spec. Do not add that cross-reference in this plan.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` / `... vitest run <path>` — required exact invocation on this machine (default heap OOMs).

---

## File Structure

```
supabase/schema.sql                                              (MODIFY — append evaluaciones_ergonomicas)
lib/ergonomia/types.ts                                            (CREATE)
lib/ergonomia/puestosCriticos.ts                                  (CREATE)
lib/ergonomia/puestosCriticos.test.ts                             (CREATE)
components/platform/ergonomia/EvaluacionErgonomicaSheet.tsx       (CREATE — admin create form)
components/platform/ergonomia/GestionarEvaluacionSheet.tsx        (CREATE — advance estado + recomendaciones)
components/platform/ergonomia/EvaluacionesErgonomicasTable.tsx    (CREATE — puestos críticos + list, wires both sheets)
app/plataforma/ergonomia/page.tsx                                 (CREATE — admin page)
components/platform/Sidebar.tsx                                   (MODIFY — nav entry)
```

---

### Task 1: Schema + types + puestosCriticos (with tests)

**Files:**
- Modify: `supabase/schema.sql` (append at end of file)
- Create: `lib/ergonomia/types.ts`
- Create: `lib/ergonomia/puestosCriticos.ts`
- Test: `lib/ergonomia/puestosCriticos.test.ts`

**Interfaces:**
- Produces: `NivelRiesgo`, `EstadoEvaluacion`, `EvaluacionErgonomica` type, `mapEvaluacionErgonomicaRow(row)`, `PuestoCritico` type, `calcularPuestosCriticos(evaluaciones)` — all consumed by Tasks 2 and 3.

- [ ] **Step 1: Append the table + RLS to `supabase/schema.sql`**

Append this exact block at the end of the file:

```sql

-- ============================================================
-- ERGONOMICS: evaluaciones_ergonomicas
-- ============================================================

create table evaluaciones_ergonomicas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  cargo_id uuid not null references cargos(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  fecha date not null,
  nivel_riesgo text not null check (nivel_riesgo in ('bajo', 'medio', 'alto')),
  hallazgos text not null,
  recomendaciones text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_progreso', 'resuelto'))
);

alter table evaluaciones_ergonomicas enable row level security;

create policy "evaluaciones_ergonomicas_select_same_tenant" on evaluaciones_ergonomicas
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "evaluaciones_ergonomicas_insert_admin" on evaluaciones_ergonomicas
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "evaluaciones_ergonomicas_update_admin" on evaluaciones_ergonomicas
  for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update on evaluaciones_ergonomicas to authenticated;
grant all on evaluaciones_ergonomicas to service_role;
```

Note: unlike `eventos_seguridad`, there is no `insert_publico` policy and no `grant ... to anon` — this table has no anonymous path at all.

- [ ] **Step 2: Create `lib/ergonomia/types.ts`**

```typescript
export type NivelRiesgo = 'bajo' | 'medio' | 'alto'
export type EstadoEvaluacion = 'pendiente' | 'en_progreso' | 'resuelto'

export type EvaluacionErgonomica = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  cargoId: string
  sucursalId: string | null
  fecha: string
  nivelRiesgo: NivelRiesgo
  hallazgos: string
  recomendaciones: string | null
  estado: EstadoEvaluacion
}

export function mapEvaluacionErgonomicaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  cargo_id: string
  sucursal_id: string | null
  fecha: string
  nivel_riesgo: string
  hallazgos: string
  recomendaciones: string | null
  estado: string
}): EvaluacionErgonomica {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    cargoId: row.cargo_id,
    sucursalId: row.sucursal_id,
    fecha: row.fecha,
    nivelRiesgo: row.nivel_riesgo as NivelRiesgo,
    hallazgos: row.hallazgos,
    recomendaciones: row.recomendaciones,
    estado: row.estado as EstadoEvaluacion,
  }
}
```

- [ ] **Step 3: Write the failing test for `calcularPuestosCriticos` — `lib/ergonomia/puestosCriticos.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { calcularPuestosCriticos } from './puestosCriticos'
import type { EvaluacionErgonomica } from './types'

function crearEvaluacion(overrides: Partial<EvaluacionErgonomica>): EvaluacionErgonomica {
  return {
    id: 'eval-1',
    tenantId: 'tenant-1',
    empresaId: 'empresa-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    creadaPor: 'usuario-1',
    cargoId: 'cargo-1',
    sucursalId: null,
    fecha: '2026-01-01',
    nivelRiesgo: 'bajo',
    hallazgos: 'Sin hallazgos relevantes',
    recomendaciones: null,
    estado: 'pendiente',
    ...overrides,
  }
}

describe('calcularPuestosCriticos', () => {
  it('marca como critico un cargo con evaluacion de riesgo alto sin resolver', () => {
    const evaluaciones = [crearEvaluacion({ cargoId: 'cargo-1', nivelRiesgo: 'alto', estado: 'pendiente' })]
    const resultado = calcularPuestosCriticos(evaluaciones)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].cargoId).toBe('cargo-1')
  })

  it('no marca como critico un cargo con evaluacion de riesgo alto ya resuelta', () => {
    const evaluaciones = [crearEvaluacion({ cargoId: 'cargo-1', nivelRiesgo: 'alto', estado: 'resuelto' })]
    const resultado = calcularPuestosCriticos(evaluaciones)
    expect(resultado).toHaveLength(0)
  })

  it('no marca como critico un cargo con solo evaluaciones de riesgo bajo o medio', () => {
    const evaluaciones = [
      crearEvaluacion({ id: 'eval-1', cargoId: 'cargo-1', fecha: '2026-01-01', nivelRiesgo: 'bajo' }),
      crearEvaluacion({ id: 'eval-2', cargoId: 'cargo-1', fecha: '2026-01-02', nivelRiesgo: 'medio' }),
    ]
    const resultado = calcularPuestosCriticos(evaluaciones)
    expect(resultado).toHaveLength(0)
  })

  it('usa la evaluacion mas reciente por fecha, no la de mayor riesgo historico', () => {
    const evaluaciones = [
      crearEvaluacion({
        id: 'eval-1',
        cargoId: 'cargo-1',
        fecha: '2026-01-01',
        nivelRiesgo: 'alto',
        estado: 'pendiente',
      }),
      crearEvaluacion({
        id: 'eval-2',
        cargoId: 'cargo-1',
        fecha: '2026-02-01',
        nivelRiesgo: 'bajo',
        estado: 'pendiente',
      }),
    ]
    const resultado = calcularPuestosCriticos(evaluaciones)
    expect(resultado).toHaveLength(0)
  })

  it('devuelve lista vacia cuando no hay evaluaciones', () => {
    const resultado = calcularPuestosCriticos([])
    expect(resultado).toEqual([])
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ergonomia/puestosCriticos.test.ts`
Expected: FAIL — `Cannot find module './puestosCriticos'` (file doesn't exist yet).

- [ ] **Step 5: Create `lib/ergonomia/puestosCriticos.ts`**

```typescript
import type { EvaluacionErgonomica } from './types'

export type PuestoCritico = {
  cargoId: string
  evaluacionId: string
  fecha: string
  hallazgos: string
}

export function calcularPuestosCriticos(evaluaciones: EvaluacionErgonomica[]): PuestoCritico[] {
  const masRecientePorCargo = new Map<string, EvaluacionErgonomica>()

  for (const evaluacion of evaluaciones) {
    const actual = masRecientePorCargo.get(evaluacion.cargoId)
    if (!actual) {
      masRecientePorCargo.set(evaluacion.cargoId, evaluacion)
      continue
    }
    const esMasReciente =
      evaluacion.fecha > actual.fecha || (evaluacion.fecha === actual.fecha && evaluacion.createdAt > actual.createdAt)
    if (esMasReciente) {
      masRecientePorCargo.set(evaluacion.cargoId, evaluacion)
    }
  }

  const criticos: PuestoCritico[] = []
  for (const evaluacion of masRecientePorCargo.values()) {
    if (evaluacion.nivelRiesgo === 'alto' && evaluacion.estado !== 'resuelto') {
      criticos.push({
        cargoId: evaluacion.cargoId,
        evaluacionId: evaluacion.id,
        fecha: evaluacion.fecha,
        hallazgos: evaluacion.hallazgos,
      })
    }
  }

  return criticos
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ergonomia/puestosCriticos.test.ts`
Expected: PASS — 5/5 tests.

- [ ] **Step 7: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/schema.sql lib/ergonomia/types.ts lib/ergonomia/puestosCriticos.ts lib/ergonomia/puestosCriticos.test.ts
git commit -m "feat: add evaluaciones_ergonomicas schema, types, and puestos criticos"
```

---

### Task 2: Admin Sheet forms

**Files:**
- Create: `components/platform/ergonomia/EvaluacionErgonomicaSheet.tsx`
- Create: `components/platform/ergonomia/GestionarEvaluacionSheet.tsx`

**Interfaces:**
- Consumes: `EvaluacionErgonomica`, `EstadoEvaluacion`, `mapEvaluacionErgonomicaRow` from `@/lib/ergonomia/types` (this is a `components/` file, so the `@/` alias is correct here — only `lib/`-internal imports must be relative). `createClient` from `@/lib/supabase/client`, `logAudit` from `@/lib/platform/audit`.
- Produces: `EvaluacionErgonomicaSheet` (props: `tenantId`, `empresaId`, `actorId`, `cargos`, `sucursales`, `onSaved: (evaluacion: EvaluacionErgonomica) => void`) and `GestionarEvaluacionSheet` (props: `tenantId`, `actorId`, `evaluacion: EvaluacionErgonomica`, `onSaved: (evaluacion: EvaluacionErgonomica) => void`) — both consumed by Task 3's `EvaluacionesErgonomicasTable`.

- [ ] **Step 1: Create `components/platform/ergonomia/EvaluacionErgonomicaSheet.tsx`**

```tsx
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
            <Select value={form.watch('cargoId')} onValueChange={(v) => form.setValue('cargoId', v)}>
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
```

- [ ] **Step 2: Create `components/platform/ergonomia/GestionarEvaluacionSheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import type { EvaluacionErgonomica, EstadoEvaluacion } from '@/lib/ergonomia/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const SIGUIENTE_ESTADO: Record<EstadoEvaluacion, EstadoEvaluacion | null> = {
  pendiente: 'en_progreso',
  en_progreso: 'resuelto',
  resuelto: null,
}

const ESTADO_LABEL: Record<EstadoEvaluacion, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
}

export function GestionarEvaluacionSheet({
  tenantId,
  actorId,
  evaluacion,
  onSaved,
}: {
  tenantId: string
  actorId: string
  evaluacion: EvaluacionErgonomica
  onSaved: (evaluacion: EvaluacionErgonomica) => void
}) {
  const [open, setOpen] = useState(false)
  const [recomendaciones, setRecomendaciones] = useState(evaluacion.recomendaciones ?? '')
  const [guardando, setGuardando] = useState(false)
  const siguiente = SIGUIENTE_ESTADO[evaluacion.estado]

  async function handleAvanzar() {
    if (!siguiente) return
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('evaluaciones_ergonomicas')
      .update({ estado: siguiente, recomendaciones: recomendaciones || null })
      .eq('id', evaluacion.id)
    setGuardando(false)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'evaluaciones_ergonomicas',
      entidadId: evaluacion.id,
      accion: 'actualizar',
      datosAntes: { estado: evaluacion.estado, recomendaciones: evaluacion.recomendaciones },
      datosDespues: { estado: siguiente, recomendaciones },
    })

    onSaved({ ...evaluacion, estado: siguiente, recomendaciones: recomendaciones || null })
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>Gestionar</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{evaluacion.hallazgos}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">Estado actual: {ESTADO_LABEL[evaluacion.estado]}</p>
          <div className="space-y-2">
            <Label htmlFor="gestion-recomendaciones">Recomendaciones</Label>
            <textarea
              id="gestion-recomendaciones"
              value={recomendaciones}
              onChange={(e) => setRecomendaciones(e.target.value)}
              disabled={!siguiente}
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {siguiente ? (
            <Button type="button" disabled={guardando} onClick={handleAvanzar}>
              {guardando ? 'Guardando…' : `Avanzar a "${ESTADO_LABEL[siguiente]}"`}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Esta evaluación ya está resuelta.</p>
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
git add components/platform/ergonomia/EvaluacionErgonomicaSheet.tsx components/platform/ergonomia/GestionarEvaluacionSheet.tsx
git commit -m "feat: add ergonomia admin forms"
```

---

### Task 3: Admin table (with puestos críticos) + page + nav

**Files:**
- Create: `components/platform/ergonomia/EvaluacionesErgonomicasTable.tsx`
- Create: `app/plataforma/ergonomia/page.tsx`
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: `EvaluacionErgonomicaSheet` and `GestionarEvaluacionSheet` from Task 2 (exact prop shapes above), `EvaluacionErgonomica`/`mapEvaluacionErgonomicaRow` and `calcularPuestosCriticos`/`PuestoCritico` from Task 1, `isAdminRole` from `lib/platform/roles.ts`, `mapUsuarioRow`/`mapRolRow` from `lib/platform/types.ts`.
- Produces: the `/plataforma/ergonomia` route, reachable from the sidebar.

- [ ] **Step 1: Create `components/platform/ergonomia/EvaluacionesErgonomicasTable.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { isAdminRole } from '@/lib/platform/roles'
import { calcularPuestosCriticos } from '@/lib/ergonomia/puestosCriticos'
import type { EvaluacionErgonomica } from '@/lib/ergonomia/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EvaluacionErgonomicaSheet } from './EvaluacionErgonomicaSheet'
import { GestionarEvaluacionSheet } from './GestionarEvaluacionSheet'

const NIVEL_RIESGO_LABELS: Record<EvaluacionErgonomica['nivelRiesgo'], string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
}

const ESTADO_LABEL: Record<EvaluacionErgonomica['estado'], string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
}

export function EvaluacionesErgonomicasTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialEvaluaciones,
  cargos,
  sucursales,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialEvaluaciones: EvaluacionErgonomica[]
  cargos: Array<{ id: string; nombre: string }>
  sucursales: Array<{ id: string; nombre: string }>
}) {
  const [evaluaciones, setEvaluaciones] = useState(initialEvaluaciones)
  const canEdit = isAdminRole(rolClave)

  const puestosCriticos = useMemo(() => calcularPuestosCriticos(evaluaciones), [evaluaciones])

  function handleSaved(evaluacion: EvaluacionErgonomica) {
    setEvaluaciones((prev) => {
      const existe = prev.some((e) => e.id === evaluacion.id)
      return existe ? prev.map((e) => (e.id === evaluacion.id ? evaluacion : e)) : [evaluacion, ...prev]
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-foreground">Puestos críticos</h2>
        {puestosCriticos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin puestos críticos detectados.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {puestosCriticos.map((critico) => (
              <div key={critico.evaluacionId} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-foreground">
                  {cargos.find((c) => c.id === critico.cargoId)?.nombre ?? critico.cargoId}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{critico.fecha}</p>
                <p className="mt-1 text-sm text-foreground">{critico.hallazgos}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {canEdit ? (
          <div className="flex justify-end">
            <EvaluacionErgonomicaSheet
              tenantId={tenantId}
              empresaId={empresaId}
              actorId={actorId}
              cargos={cargos}
              sucursales={sucursales}
              onSaved={handleSaved}
            />
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cargo</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Riesgo</TableHead>
              <TableHead>Estado</TableHead>
              {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {evaluaciones.map((evaluacion) => (
              <TableRow key={evaluacion.id}>
                <TableCell>{cargos.find((c) => c.id === evaluacion.cargoId)?.nombre ?? '—'}</TableCell>
                <TableCell>
                  {evaluacion.sucursalId ? (sucursales.find((s) => s.id === evaluacion.sucursalId)?.nombre ?? '—') : '—'}
                </TableCell>
                <TableCell>{evaluacion.fecha}</TableCell>
                <TableCell>
                  <Badge variant={evaluacion.nivelRiesgo === 'alto' ? 'destructive' : 'outline'}>
                    {NIVEL_RIESGO_LABELS[evaluacion.nivelRiesgo]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ESTADO_LABEL[evaluacion.estado]}</Badge>
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
                    <GestionarEvaluacionSheet
                      tenantId={tenantId}
                      actorId={actorId}
                      evaluacion={evaluacion}
                      onSaved={handleSaved}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            {evaluaciones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="py-4 text-center text-muted-foreground">
                  No hay evaluaciones registradas.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/plataforma/ergonomia/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapEvaluacionErgonomicaRow } from '@/lib/ergonomia/types'
import { EvaluacionesErgonomicasTable } from '@/components/platform/ergonomia/EvaluacionesErgonomicasTable'

export default async function ErgonomiaPage() {
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

  const { data: evaluacionRows } = await supabase
    .from('evaluaciones_ergonomicas')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const evaluaciones = (evaluacionRows ?? []).map(mapEvaluacionErgonomicaRow)

  const { data: cargoRows } = await supabase.from('cargos').select('id, nombre').eq('empresa_id', empresaId)
  const cargos = (cargoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: sucursalRows } = await supabase.from('sucursales').select('id, nombre').eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Ergonomía</h1>
      <EvaluacionesErgonomicasTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialEvaluaciones={evaluaciones}
        cargos={cargos}
        sucursales={sucursales}
      />
    </div>
  )
}
```

- [ ] **Step 3: Add Sidebar nav entry**

In `components/platform/Sidebar.tsx`, find the `NAV_ITEMS` array. Add a new entry immediately after the `seguridad` entry (which was added by the previous module and reads `{ href: '/plataforma/seguridad', label: 'Seguridad laboral', adminOnly: true }`):

```typescript
  { href: '/plataforma/ergonomia', label: 'Ergonomía', adminOnly: true },
```

So the array reads (in this order): `resumen`, `alertas`, `encuestas`, `seguridad`, `ergonomia`, `organizacion`, ... (unchanged rest).

- [ ] **Step 4: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run`
Expected: all tests pass, including the 5 from Task 1.

- [ ] **Step 6: Manual smoke check (dev server)**

Run: `npm run dev` (or confirm it's already running), then navigate to `/plataforma/ergonomia` while logged in as an admin.
Expected: page loads, shows "Puestos críticos" with "Sin puestos críticos detectados.", then "No hay evaluaciones registradas." and a "Nueva evaluación" button; "Ergonomía" appears in the sidebar between "Seguridad laboral" and "Organización".

- [ ] **Step 7: Commit**

```bash
git add components/platform/ergonomia/EvaluacionesErgonomicasTable.tsx app/plataforma/ergonomia/page.tsx components/platform/Sidebar.tsx
git commit -m "feat: add ergonomia admin page with puestos criticos"
```

---

### Task 4: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user) to run against the deployed/production environment after Tasks 1-3 are merged and the schema is applied to production Supabase.

- [ ] **Step 1: Apply the Task 1 SQL block to production Supabase**

Via the Supabase SQL Editor (browser automation, only on an already-authenticated session — never enter credentials), run the `evaluaciones_ergonomicas` table + RLS + grants block from Task 1, Step 1, against the production project (`jjnrrkwydpsetugxtgea`).

- [ ] **Step 2: Verify a non-admin authenticated user cannot insert or update, but can read**

In the SQL Editor, confirm the RLS shape directly — this table has no `anon` grant at all, so the meaningful check is that a non-admin `authenticated` role is blocked from writing. Since there is no built-in way to assume a specific non-admin user's session from the SQL Editor, instead verify by inspection: `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'evaluaciones_ergonomicas' order by grantee, privilege_type;` — expected rows: `authenticated` has `select`/`insert`/`update` (gated further by the role-checking policies), `service_role` has everything, and **no row for `anon`** at all. If a row for `anon` appears, something is wrong — stop and investigate before proceeding.

- [ ] **Step 3: Verify estado only advances forward in the real UI**

Log in to production as an admin. Go to `/plataforma/ergonomia`, create a test evaluation with `nivel_riesgo = 'alto'`, confirm it immediately appears under "Puestos críticos". Open "Gestionar", confirm it offers only "Avanzar a en_progreso" (not a jump straight to "resuelto" or backward). Advance it, confirm the button now offers "Avanzar a resuelto", and confirm the evaluation **still appears** under "Puestos críticos" (only `resuelto` should remove it). Advance to `resuelto`, confirm it now disappears from "Puestos críticos" and the "Gestionar" sheet shows "Esta evaluación ya está resuelta." with no further action available.

- [ ] **Step 4: Clean up test data**

Delete the test evaluation directly via the SQL Editor (`delete from evaluaciones_ergonomicas where hallazgos = '<test description>'`) — there is no delete UI, by design.

- [ ] **Step 5: Report results to the user**

Summarize: schema applied ✅/❌, no `anon` grant confirmed ✅/❌, forward-only estado confirmed in UI ✅/❌, puestos críticos correctly appears/disappears with the estado transition ✅/❌. If everything passes, ask the user which module from `referencia/instrucciones2.txt` to tackle next.

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1) ✅, `puestosCriticos` pure function with the exact test cases described in the spec's Testing section (Task 1) ✅, admin create form (Task 2) ✅, `estado`/`recomendaciones` management (Task 2) ✅, admin list page with puestos críticos section + nav (Task 3) ✅, no anonymous/public path anywhere (confirmed absent in Task 1's SQL and in Task 4's verification) ✅. Explicitly-out-of-scope items (crossing with survey data, person-level evaluations, Intervenciones module, attachments, linking to reglas_alerta) are not implemented anywhere in this plan, matching the spec.
- **Placeholder scan:** no TBD/TODO; every step has complete code.
- **Type consistency:** `EvaluacionErgonomica`/`EstadoEvaluacion`/`NivelRiesgo`/`PuestoCritico` (Task 1) are used with identical names and shapes across Tasks 2-3. `mapEvaluacionErgonomicaRow` and `calcularPuestosCriticos` signatures are consistent everywhere they're called.
