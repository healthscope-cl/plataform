# Alertas por Umbral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin define threshold rules over the six existing indicators (optionally
scoped to a sucursal/unidad/cargo/turno) and show a banner on `/plataforma/resumen` when a
rule's condition is currently met, per `docs/superpowers/specs/2026-07-20-alertas-umbral-design.md`.

**Architecture:** Same stack as the rest of the platform — Next.js 16 (App Router) + Supabase,
no separate backend, no new external services. Alert rules are rows in a new table; evaluation
is a pure function reusing the existing `computeIndicadores`/`filtrarPersonas` over data the
dashboard already fetches — no scheduled job, no email, no persisted firing history (see the
spec's "Explícitamente fuera de alcance").

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui
(`base-nova` style, on `@base-ui/react`) + `react-hook-form` + `zod` + `@supabase/ssr` + Vitest.

## Global Constraints

- **No AI/ML, no scheduled evaluation, no email/push.** A rule is evaluated live, in the
  browser, only when `/plataforma/resumen` renders — the spec is explicit that scheduled
  evaluation and notification delivery are later phases, not this one.
- **A rule's scope reuses `FiltroGrupo` exactly** (`lib/indicators/filtroPersonas.ts`, already
  merged) — `sucursalId`/`unidadId`/`cargoId`/`turnoId`, all nullable, no separate
  "scope type" column.
- **A suppressed indicator (`{ suprimido: true }`, small-group protection) never fires a rule.**
  There is no number to compare against a threshold, and firing an alert about a value hidden
  for reidentification risk would contradict the reason it's hidden.
- **No delete for rules — only create/edit/toggle `activa`.** Matches the spec's "activar/
  desactivar sin borrar"; there is no delete RLS policy or UI action for this table.
- **`reglas_alerta` is readable by every authenticated tenant member, writable only by
  `superadmin`/`admin_cliente`.** The banner on the dashboard is visible to all roles (same
  tier as the six indicator cards); only the management page's write actions are admin-gated —
  matching the existing precedent in this codebase where Organización's page itself has no
  server-side admin redirect, only RLS + client-side `isAdminRole()` gating of edit controls
  (see `app/plataforma/organizacion/page.tsx`, `components/platform/SucursalesTable.tsx`).
- Every table query filters by `empresa_id` (and, where relevant, `tenant_id`) — same
  tenant-isolation convention as every existing query in this project.
- `@base-ui/react` quirks already discovered (still apply): `Select` uses plain
  `value`/`onValueChange`. `SheetTrigger` takes a `render={<Button .../>}` prop, not
  `asChild` — see `components/platform/SucursalSheet.tsx` for the exact working pattern; copy
  it, don't reinvent it.
- WCAG 2.2 AA: every `Select` gets a paired `<Label htmlFor>`; the banner's alert list uses
  `role="alert"` semantics appropriate to unprompted important information.
- Every step that changes code shows the code. No "similar to Task N", no TODOs.
- This machine OOMs `tsc`/`vitest` at default heap size — run every verification as
  `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` /
  `... vitest run <path>` (small heap, local binary, not npx).

## File Structure

```
supabase/
  schema.sql                              (MODIFY — append reglas_alerta table)
lib/
  alertas/
    types.ts                              (CREATE — ReglaAlerta type + mapReglaAlertaRow)
    evaluar.ts                            (CREATE — evaluarReglas pure function)
    evaluar.test.ts                       (CREATE)
components/
  platform/
    alertas/
      ReglaAlertaSheet.tsx                (CREATE — create/edit form)
      ReglasAlertaTable.tsx               (CREATE — list + toggle activa)
    dashboard/
      AlertasBanner.tsx                   (CREATE)
    Sidebar.tsx                           (MODIFY — add nav item)
app/
  plataforma/
    alertas/
      page.tsx                           (CREATE)
    resumen/
      page.tsx                           (MODIFY — fetch reglas_alerta, evaluate, render banner)
```

---

### Task 1: Schema — reglas_alerta

**Files:**
- Modify: `supabase/schema.sql` (append)
- Create: `lib/alertas/types.ts`

**Interfaces:**
- Produces: SQL table `reglas_alerta`. TS type `ReglaAlerta`, `Indicador`, `Operador`, and
  `mapReglaAlertaRow()` in `lib/alertas/types.ts`, following the same camelCase/snake_case
  mapping convention as `lib/indicators/types.ts` and `lib/platform/types.ts`.

- [ ] **Step 1: Append the schema to `supabase/schema.sql`**

```sql
-- ============================================================
-- ALERTS: reglas_alerta
-- ============================================================

create table reglas_alerta (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  nombre text not null,
  indicador text not null check (indicador in (
    'tasaAusentismo', 'frecuencia', 'severidad', 'duracionPromedio', 'reincidencia', 'costoEstimado'
  )),
  operador text not null check (operador in ('mayor_que', 'mayor_o_igual')),
  umbral numeric not null,
  sucursal_id uuid references sucursales(id) on delete set null,
  unidad_id uuid references unidades(id) on delete set null,
  cargo_id uuid references cargos(id) on delete set null,
  turno_id uuid references turnos(id) on delete set null,
  activa boolean not null default true
);

alter table reglas_alerta enable row level security;

create policy "reglas_alerta_select_same_tenant" on reglas_alerta
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "reglas_alerta_insert_admin" on reglas_alerta
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "reglas_alerta_update_admin" on reglas_alerta
  for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update on reglas_alerta to authenticated;
grant all on reglas_alerta to service_role;
```

No delete policy and no delete grant — deactivating a rule is done by updating `activa` to
`false`, never by removing the row (Global Constraints).

- [ ] **Step 2: Create `lib/alertas/types.ts`**

```typescript
export type Indicador =
  | 'tasaAusentismo'
  | 'frecuencia'
  | 'severidad'
  | 'duracionPromedio'
  | 'reincidencia'
  | 'costoEstimado'

export type Operador = 'mayor_que' | 'mayor_o_igual'

export type ReglaAlerta = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  nombre: string
  indicador: Indicador
  operador: Operador
  umbral: number
  sucursalId: string | null
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
  activa: boolean
}

export function mapReglaAlertaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  nombre: string
  indicador: string
  operador: string
  umbral: number
  sucursal_id: string | null
  unidad_id: string | null
  cargo_id: string | null
  turno_id: string | null
  activa: boolean
}): ReglaAlerta {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    nombre: row.nombre,
    indicador: row.indicador as Indicador,
    operador: row.operador as Operador,
    umbral: row.umbral,
    sucursalId: row.sucursal_id,
    unidadId: row.unidad_id,
    cargoId: row.cargo_id,
    turnoId: row.turno_id,
    activa: row.activa,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql lib/alertas/types.ts
git commit -m "feat: add reglas_alerta schema for threshold-based alerts"
```

---

### Task 2: Evaluation engine

**Files:**
- Create: `lib/alertas/evaluar.ts`
- Test: `lib/alertas/evaluar.test.ts`

**Interfaces:**
- Consumes: `filtrarPersonas`, `FiltroGrupo` (`lib/indicators/filtroPersonas.ts`, merged);
  `computeIndicadores`, `IndicadorResultados` (`lib/indicators/aggregate.ts`, existing);
  `ReglaAlerta` (Task 1).
- Produces: `AlertaDisparada` type and `evaluarReglas()`. Task 5's dashboard page calls this
  with the same `personas`/`episodios`/`unidades`/`costos` it already fetches for the
  indicator cards.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/alertas/evaluar.test.ts
import { describe, expect, it } from 'vitest'
import { evaluarReglas } from './evaluar'
import type { ReglaAlerta } from './types'

const COSTOS = { costoPromedioDiario: 40000, horasExtra: 0, reemplazos: 0, costosAdministrativos: 0 }

function reglaBase(overrides: Partial<ReglaAlerta>): ReglaAlerta {
  return {
    id: 'r1',
    tenantId: 't1',
    empresaId: 'e1',
    createdAt: '2026-01-01',
    creadaPor: 'u1',
    nombre: 'Regla de prueba',
    indicador: 'tasaAusentismo',
    operador: 'mayor_que',
    umbral: 5,
    sucursalId: null,
    unidadId: null,
    cargoId: null,
    turnoId: null,
    activa: true,
    ...overrides,
  }
}

describe('evaluarReglas', () => {
  const personas = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    contratoDias: 100,
    unidadId: i < 5 ? 'u1' : 'u2',
    cargoId: null,
    turnoId: null,
  }))
  const unidades = [
    { id: 'u1', sucursalId: 's1' },
    { id: 'u2', sucursalId: 's1' },
  ]

  it('dispara una regla sin ámbito cuando el indicador de toda la empresa supera el umbral', () => {
    const episodios = [{ personaId: 'p0', dias: 60, estado: 'cerrado' as const }]
    const reglas = [reglaBase({ umbral: 5 })]

    const resultado = evaluarReglas({ reglas, personas, unidades, episodios, costos: COSTOS })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].valorActual).toBeCloseTo(6)
  })

  it('no dispara cuando el indicador no supera el umbral', () => {
    const episodios = [{ personaId: 'p0', dias: 10, estado: 'cerrado' as const }]
    const reglas = [reglaBase({ umbral: 5 })]

    const resultado = evaluarReglas({ reglas, personas, unidades, episodios, costos: COSTOS })

    expect(resultado).toHaveLength(0)
  })

  it('evalúa una regla con ámbito solo sobre el subconjunto filtrado, no toda la empresa', () => {
    const episodios = [
      { personaId: 'p5', dias: 60, estado: 'cerrado' as const },
      { personaId: 'p6', dias: 60, estado: 'cerrado' as const },
    ]
    const reglaEnU1 = reglaBase({ umbral: 5, unidadId: 'u1' })
    const reglaEnU2 = reglaBase({ umbral: 5, unidadId: 'u2' })

    const resultado = evaluarReglas({ reglas: [reglaEnU1, reglaEnU2], personas, unidades, episodios, costos: COSTOS })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].regla.unidadId).toBe('u2')
  })

  it('nunca dispara una regla cuyo indicador quedó suprimido por grupo pequeño', () => {
    const personasChicas = personas.slice(0, 2)
    const episodios = [{ personaId: 'p0', dias: 60, estado: 'cerrado' as const }]
    const reglas = [reglaBase({ umbral: 5 })]

    const resultado = evaluarReglas({ reglas, personas: personasChicas, unidades, episodios, costos: COSTOS })

    expect(resultado).toHaveLength(0)
  })

  it('distingue mayor_que de mayor_o_igual exactamente en el valor límite', () => {
    const episodios = [{ personaId: 'p0', dias: 50, estado: 'cerrado' as const }]
    const reglaMayorQue = reglaBase({ umbral: 5, operador: 'mayor_que' })
    const reglaMayorOIgual = reglaBase({ umbral: 5, operador: 'mayor_o_igual' })

    const resultado = evaluarReglas({
      reglas: [reglaMayorQue, reglaMayorOIgual],
      personas,
      unidades,
      episodios,
      costos: COSTOS,
    })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].regla.operador).toBe('mayor_o_igual')
  })

  it('ignora reglas inactivas', () => {
    const episodios = [{ personaId: 'p0', dias: 60, estado: 'cerrado' as const }]
    const reglas = [reglaBase({ umbral: 5, activa: false })]

    const resultado = evaluarReglas({ reglas, personas, unidades, episodios, costos: COSTOS })

    expect(resultado).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/alertas/evaluar.test.ts`
Expected: FAIL with "Cannot find module './evaluar'"

- [ ] **Step 3: Write `lib/alertas/evaluar.ts`**

Use relative imports for the sibling `lib/indicators/` modules, not the `@/` alias — every
existing cross-file import within `lib/` in this project uses relative paths (e.g.
`lib/ingestion/groupMatching.ts` imports from `./columnMapping`); only `app/`/`components/`
files use `@/`. (Corrected during execution — commit `2be86c9`: the first draft of this task
used `@/lib/indicators/...` and needed a new `vitest.config.ts` alias to resolve it, which was
unnecessary scope once the import matched the established convention.)

```typescript
import { filtrarPersonas, type FiltroGrupo } from '../indicators/filtroPersonas'
import { computeIndicadores, type IndicadorResultados } from '../indicators/aggregate'
import type { ReglaAlerta } from './types'

export type AlertaDisparada = {
  regla: ReglaAlerta
  valorActual: number
}

export function evaluarReglas(input: {
  reglas: ReglaAlerta[]
  personas: Array<{
    id: string
    contratoDias: number
    unidadId: string | null
    cargoId: string | null
    turnoId: string | null
  }>
  unidades: Array<{ id: string; sucursalId: string }>
  episodios: Array<{ personaId: string; dias: number; estado: 'abierto' | 'cerrado' }>
  costos: { costoPromedioDiario: number; horasExtra: number; reemplazos: number; costosAdministrativos: number }
}): AlertaDisparada[] {
  const disparadas: AlertaDisparada[] = []

  for (const regla of input.reglas) {
    if (!regla.activa) continue

    const filtro: FiltroGrupo = {
      sucursalId: regla.sucursalId,
      unidadId: regla.unidadId,
      cargoId: regla.cargoId,
      turnoId: regla.turnoId,
    }
    const personasDelAmbito = filtrarPersonas(input.personas, filtro, input.unidades)
    const idsDelAmbito = new Set(personasDelAmbito.map((p) => p.id))
    const episodiosDelAmbito = input.episodios.filter((episodio) => idsDelAmbito.has(episodio.personaId))

    const resultados = computeIndicadores({
      personas: personasDelAmbito,
      episodios: episodiosDelAmbito,
      costos: input.costos,
    })
    const resultado = resultados[regla.indicador as keyof IndicadorResultados]

    if ('suprimido' in resultado) continue

    const disparada =
      regla.operador === 'mayor_que' ? resultado.valor > regla.umbral : resultado.valor >= regla.umbral

    if (disparada) {
      disparadas.push({ regla, valorActual: resultado.valor })
    }
  }

  return disparadas
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/alertas/evaluar.test.ts`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add lib/alertas/evaluar.ts lib/alertas/evaluar.test.ts
git commit -m "feat: add pure threshold-rule evaluation engine for alerts"
```

---

### Task 3: Alert rule form

**Files:**
- Create: `components/platform/alertas/ReglaAlertaSheet.tsx`

**Interfaces:**
- Consumes: `ReglaAlerta`, `mapReglaAlertaRow`, `Indicador`, `Operador` (Task 1); `logAudit`
  (`lib/platform/audit.ts`, existing); `createClient` (browser, existing).
- Produces: `ReglaAlertaSheet`, a create/edit form. Task 4's `ReglasAlertaTable` renders one
  instance per row (edit) plus one standalone instance (create).

- [ ] **Step 1: Create `components/platform/alertas/ReglaAlertaSheet.tsx`**

```tsx
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

const INDICADORES: Array<{ value: string; label: string }> = [
  { value: 'tasaAusentismo', label: 'Tasa de ausentismo' },
  { value: 'frecuencia', label: 'Frecuencia' },
  { value: 'severidad', label: 'Severidad' },
  { value: 'duracionPromedio', label: 'Duración promedio' },
  { value: 'reincidencia', label: 'Reincidencia' },
  { value: 'costoEstimado', label: 'Costo estimado' },
]

const schema = z.object({
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
  umbral: z.coerce.number(),
  sucursalId: z.string().nullable(),
  unidadId: z.string().nullable(),
  cargoId: z.string().nullable(),
  turnoId: z.string().nullable(),
})

type FormValues = z.infer<typeof schema>

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
  const form = useForm<FormValues>({
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

  async function onSubmit(values: FormValues) {
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
              onValueChange={(valor) => form.setValue('indicador', valor as FormValues['indicador'])}
            >
              <SelectTrigger id="indicador" className="w-full">
                <SelectValue />
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
                onValueChange={(valor) => form.setValue('operador', valor as FormValues['operador'])}
              >
                <SelectTrigger id="operador" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mayor_que">Mayor que</SelectItem>
                  <SelectItem value="mayor_o_igual">Mayor o igual a</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="umbral">Umbral</Label>
              <Input id="umbral" type="number" step="any" {...form.register('umbral')} />
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
                  <SelectValue />
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
                  <SelectValue />
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
                  <SelectValue />
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
                  <SelectValue />
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
```

- [ ] **Step 2: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/platform/alertas/ReglaAlertaSheet.tsx
git commit -m "feat: add create/edit form for alert rules"
```

---

### Task 4: Alert rules management page

**Files:**
- Create: `components/platform/alertas/ReglasAlertaTable.tsx`
- Create: `app/plataforma/alertas/page.tsx`
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: `ReglaAlertaSheet` (Task 3); `ReglaAlerta`, `mapReglaAlertaRow` (Task 1);
  `isAdminRole` (`lib/platform/roles.ts`, existing); `logAudit` (existing); `mapUsuarioRow`,
  `mapRolRow`, `mapSucursalRow`, `mapUnidadRow`, `mapCargoRow`, `mapTurnoRow`
  (`lib/platform/types.ts`, existing).
- Produces: the `/plataforma/alertas` page. No later task in this plan depends on new exports
  from this task.

- [ ] **Step 1: Create `components/platform/alertas/ReglasAlertaTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { isAdminRole } from '@/lib/platform/roles'
import type { ReglaAlerta } from '@/lib/alertas/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReglaAlertaSheet } from './ReglaAlertaSheet'

const INDICADOR_LABELS: Record<ReglaAlerta['indicador'], string> = {
  tasaAusentismo: 'Tasa de ausentismo',
  frecuencia: 'Frecuencia',
  severidad: 'Severidad',
  duracionPromedio: 'Duración promedio',
  reincidencia: 'Reincidencia',
  costoEstimado: 'Costo estimado',
}

const OPERADOR_LABELS: Record<ReglaAlerta['operador'], string> = {
  mayor_que: '>',
  mayor_o_igual: '≥',
}

function describirAmbito(
  regla: ReglaAlerta,
  catalogos: {
    sucursales: Array<{ id: string; nombre: string }>
    unidades: Array<{ id: string; nombre: string }>
    cargos: Array<{ id: string; nombre: string }>
    turnos: Array<{ id: string; nombre: string }>
  }
): string {
  const partes: string[] = []
  if (regla.sucursalId) partes.push(catalogos.sucursales.find((s) => s.id === regla.sucursalId)?.nombre ?? '—')
  if (regla.unidadId) partes.push(catalogos.unidades.find((u) => u.id === regla.unidadId)?.nombre ?? '—')
  if (regla.cargoId) partes.push(catalogos.cargos.find((c) => c.id === regla.cargoId)?.nombre ?? '—')
  if (regla.turnoId) partes.push(catalogos.turnos.find((t) => t.id === regla.turnoId)?.nombre ?? '—')
  return partes.length > 0 ? partes.join(' · ') : 'Toda la empresa'
}

export function ReglasAlertaTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialReglas,
  sucursales,
  unidades,
  cargos,
  turnos,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialReglas: ReglaAlerta[]
  sucursales: Array<{ id: string; nombre: string }>
  unidades: Array<{ id: string; nombre: string; sucursalId: string }>
  cargos: Array<{ id: string; nombre: string }>
  turnos: Array<{ id: string; nombre: string }>
}) {
  const [reglas, setReglas] = useState(initialReglas)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(regla: ReglaAlerta) {
    setReglas((prev) => {
      const existe = prev.some((r) => r.id === regla.id)
      return existe ? prev.map((r) => (r.id === regla.id ? regla : r)) : [...prev, regla]
    })
  }

  async function handleToggleActiva(regla: ReglaAlerta) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('reglas_alerta')
      .update({ activa: !regla.activa })
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
      datosDespues: { activa: !regla.activa },
    })

    setReglas((prev) => prev.map((r) => (r.id === regla.id ? { ...r, activa: !regla.activa } : r)))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <ReglaAlertaSheet
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
            <TableHead>Nombre</TableHead>
            <TableHead>Condición</TableHead>
            <TableHead>Ámbito</TableHead>
            <TableHead>Estado</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reglas.map((regla) => (
            <TableRow key={regla.id}>
              <TableCell>{regla.nombre}</TableCell>
              <TableCell>
                {INDICADOR_LABELS[regla.indicador]} {OPERADOR_LABELS[regla.operador]} {regla.umbral}
              </TableCell>
              <TableCell>{describirAmbito(regla, { sucursales, unidades, cargos, turnos })}</TableCell>
              <TableCell>
                <Badge
                  variant={regla.activa ? 'default' : 'outline'}
                  className={regla.activa ? 'bg-success/10 text-success' : undefined}
                >
                  {regla.activa ? 'Activa' : 'Inactiva'}
                </Badge>
              </TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <ReglaAlertaSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    regla={regla}
                    sucursales={sucursales}
                    unidades={unidades}
                    cargos={cargos}
                    turnos={turnos}
                    onSaved={handleSaved}
                  />
                  <Button variant="outline" size="sm" onClick={() => handleToggleActiva(regla)}>
                    {regla.activa ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {reglas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 5 : 4} className="py-4 text-center text-muted-foreground">
                No hay reglas de alerta configuradas.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/plataforma/alertas/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapReglaAlertaRow } from '@/lib/alertas/types'
import { ReglasAlertaTable } from '@/components/platform/alertas/ReglasAlertaTable'

export default async function AlertasPage() {
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

  const { data: reglaRows } = await supabase
    .from('reglas_alerta')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  const reglas = (reglaRows ?? []).map(mapReglaAlertaRow)

  const { data: sucursalRows } = await supabase.from('sucursales').select('id, nombre').eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))
  const sucursalIds = sucursales.map((s) => s.id)

  const { data: unidadRows } =
    sucursalIds.length > 0
      ? await supabase.from('unidades').select('id, nombre, sucursal_id').in('sucursal_id', sucursalIds)
      : { data: [] }
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
      <h1 className="font-heading text-2xl font-semibold text-foreground">Alertas</h1>
      <ReglasAlertaTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialReglas={reglas}
        sucursales={sucursales}
        unidades={unidades}
        cargos={cargos}
        turnos={turnos}
      />
    </div>
  )
}
```

- [ ] **Step 3: Modify `components/platform/Sidebar.tsx`**

Add one entry to the existing `NAV_ITEMS` array, right after the `Resumen` entry:

```typescript
const NAV_ITEMS = [
  { href: '/plataforma/resumen', label: 'Resumen', adminOnly: false },
  { href: '/plataforma/alertas', label: 'Alertas', adminOnly: true },
  { href: '/plataforma/organizacion', label: 'Organización', adminOnly: true },
  { href: '/plataforma/importar', label: 'Importar datos', adminOnly: true },
  { href: '/plataforma/importar/historial', label: 'Historial de importaciones', adminOnly: true },
  { href: '/plataforma/usuarios', label: 'Usuarios y permisos', adminOnly: true },
  { href: '/plataforma/auditoria', label: 'Auditoría', adminOnly: true },
] as const
```

`adminOnly: true` here only hides the nav link from non-admins — the page itself has no
server-side admin redirect, matching the existing Organización/Usuarios precedent (RLS plus
client-side `isAdminRole()` gating of the write controls is the real boundary).

- [ ] **Step 4: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/platform/alertas/ReglasAlertaTable.tsx app/plataforma/alertas/page.tsx components/platform/Sidebar.tsx
git commit -m "feat: add alert rules management page"
```

---

### Task 5: Dashboard banner

**Files:**
- Create: `components/platform/dashboard/AlertasBanner.tsx`
- Modify: `app/plataforma/resumen/page.tsx`

**Interfaces:**
- Consumes: `evaluarReglas`, `AlertaDisparada` (Task 2); `mapReglaAlertaRow` (Task 1).
- Produces: the finished feature — a banner on `/plataforma/resumen` when any rule is
  triggered. No later task in this plan depends on this one.

- [ ] **Step 1: Create `components/platform/dashboard/AlertasBanner.tsx`**

```tsx
import type { AlertaDisparada } from '@/lib/alertas/evaluar'

const INDICADOR_LABELS: Record<string, string> = {
  tasaAusentismo: 'Tasa de ausentismo',
  frecuencia: 'Frecuencia',
  severidad: 'Severidad',
  duracionPromedio: 'Duración promedio',
  reincidencia: 'Reincidencia',
  costoEstimado: 'Costo estimado',
}

function describirAmbito(alerta: AlertaDisparada): string | null {
  const { regla } = alerta
  if (!regla.sucursalId && !regla.unidadId && !regla.cargoId && !regla.turnoId) return null
  return 'ámbito acotado'
}

function formatValor(valor: number, indicador: string) {
  if (indicador === 'costoEstimado') return `$${valor.toLocaleString('es-CL')}`
  return `${valor.toFixed(1)}`
}

export function AlertasBanner({ alertas }: { alertas: AlertaDisparada[] }) {
  if (alertas.length === 0) return null

  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-destructive">
        {alertas.length === 1 ? '1 alerta activa' : `${alertas.length} alertas activas`}
      </p>
      <ul className="mt-2 space-y-1">
        {alertas.map((alerta) => (
          <li key={alerta.regla.id} className="text-sm text-foreground">
            <span className="font-medium">{alerta.regla.nombre}</span> —{' '}
            {INDICADOR_LABELS[alerta.regla.indicador]}
            {describirAmbito(alerta) ? ` (${describirAmbito(alerta)})` : ''}:{' '}
            {formatValor(alerta.valorActual, alerta.regla.indicador)} supera el umbral de {alerta.regla.umbral}.
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Note: `describirAmbito` here deliberately does not resolve catalog names to keep this
component free of the sucursal/unidad/cargo/turno catalog props (the page already shows the
same information in the rules management page, where the full catalogs are already fetched) —
say "ámbito acotado" rather than fetching and threading four more catalogs into a component
whose job is just to say something was triggered. If per-alert catalog names in the banner
turn out to matter in practice, that is a small follow-up, not a reason to block this task.

- [ ] **Step 2: Modify `app/plataforma/resumen/page.tsx`**

Add two imports, right after the existing `import { mapLineaBaseRow } ...` line:

```typescript
import { mapReglaAlertaRow } from '@/lib/alertas/types'
import { evaluarReglas } from '@/lib/alertas/evaluar'
import { AlertasBanner } from '@/components/platform/dashboard/AlertasBanner'
```

Right after the block that builds `unidades` (the `const { data: unidadRows } = ...` /
`const unidades = ...` pair already in this file), add the rules fetch and evaluation:

```typescript
  const { data: reglaRows } = await supabase
    .from('reglas_alerta')
    .select('*')
    .eq('empresa_id', empresaId)
  const reglas = (reglaRows ?? []).map(mapReglaAlertaRow)

  const alertasDisparadas = evaluarReglas({
    reglas,
    personas,
    unidades,
    episodios,
    costos: COSTOS_DEFAULT,
  })
```

In the JSX, add `<AlertasBanner alertas={alertasDisparadas} />` as the first child inside the
outer `<div className="space-y-6">`, before the `<div>` that currently holds the `<h1>Resumen</h1>`:

```tsx
  return (
    <div className="space-y-6">
      <AlertasBanner alertas={alertasDisparadas} />
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Resumen</h1>
```

(Everything else in the file — the rest of the JSX, the `ResumenInteractivo` call — stays
exactly as it is; this task only adds the fetch/evaluate block and the one banner line.)

- [ ] **Step 3: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 4: Run full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run`
Expected: all test files pass, including Task 2's `lib/alertas/evaluar.test.ts`

- [ ] **Step 5: Commit**

```bash
git add components/platform/dashboard/AlertasBanner.tsx app/plataforma/resumen/page.tsx
git commit -m "feat: show triggered threshold alerts on the indicators dashboard"
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

Expected: all three pass clean.

- [ ] **Step 2: Apply the schema to the live Supabase project**

Via the SQL Editor, run the `reglas_alerta` block (Task 1), then verify with the same
`information_schema.role_table_grants` query used in prior plans that the grants landed
alongside the RLS policies (expect `select`/`insert`/`update` for `authenticated`, full access
for `service_role`, no `delete` for either).

- [ ] **Step 3: Browser walkthrough**

As an admin: go to `/plataforma/alertas`, create a rule with no ámbito and a threshold low
enough that today's data would trigger it (check the current value on `/plataforma/resumen`
first, then set the umbral just below it), save, then confirm the banner appears on
`/plataforma/resumen`. Create a second rule scoped to a specific unidad and confirm it
evaluates independently. Deactivate a rule and confirm its banner line disappears without
reloading data from scratch (a page refresh is fine). Confirm a non-admin user sees the
banner but not the "Nueva regla"/"Editar"/"Desactivar" controls on `/plataforma/alertas`.

- [ ] **Step 4: Record the outcome**

Append a `Progress Ledger` entry for this plan to `.superpowers/sdd/progress.md`.
