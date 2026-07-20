# HealthScope Indicators Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the platform's placeholder `/plataforma/resumen` page with a real indicators
dashboard — the fixed-formula (no AI/ML) analytics engine from
`docs/superpowers/specs/2026-07-17-data-platform-mvp.md` section 3, computed over the
`episodios`/`personas`/`contratos` data the data-ingestion-mvp plan produces. This is sub-plan
B of that spec (dashboard/indicators), the dependency root for the two follow-up plans: alerts
(reads indicator values to fire threshold rules) and PDF reports (renders this same dashboard
view to PDF).

**Architecture:** Same stack as the rest of the platform — Next.js 16 (App Router) + Supabase,
no separate backend. Every indicator is a pure arithmetic function over already-fetched rows
(no query logic inside the formulas themselves, so they're unit-testable without a database).
A thin server-component page fetches the tenant's `episodios`/`personas`/`contratos` for the
selected period via the existing RLS-scoped browser/server Supabase client (same pattern as
`organizacion/page.tsx`), then calls the pure functions to compute results — matching the
spec's "no black box" requirement (same input always produces the same output, explainable to
an auditor). "Línea base" (baseline) is a deliberate point-in-time snapshot the admin captures
with a button click, stored as one row per snapshot; "cambio" compares the current period
against the most recent snapshot.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui
(`base-nova` style) + `@supabase/ssr` + Vitest.

## Global Constraints

- This plan implements section 3 (indicators/formulas) and the "Línea base" entity from
  section 4 of `docs/superpowers/specs/2026-07-17-data-platform-mvp.md`. It does **not**
  implement alerts (reads these indicators but is a separate rule engine, next plan), PDF
  export (renders this dashboard, next plan after that), campaigns/participación/adherencia
  (depend on Campaña/Plan/Intervención entities not built yet), or filters/drill-down by
  sucursal/unidad/centro de costo/turno (out of scope for this MVP pass — whole-empresa level
  only; see "Explicitly deferred").
- **No AI/ML anywhere in this plan.** Every indicator is arithmetic over already-fetched rows —
  a `reduce`/`filter`/division, never a model call, never a statistical/ML library. This is a
  hard requirement from the spec's own rationale, not a style preference.
- **Always show the denominator.** Every indicator card in the UI must display both the
  computed value and the denominator it was computed from (e.g. "3.2% (18 días / 560 días
  programados)") — the spec explicitly requires this so numbers are never presented as bare,
  unauditable percentages.
- **Small-group suppression.** Per the spec: "ocultar/agrupar resultados de grupos demasiado
  pequeños (riesgo de reidentificación — el tamaño mínimo de grupo se define con asesoría
  legal, no un número arbitrario)." This plan uses a placeholder minimum of 5 people
  (`MIN_GROUP_SIZE` in `lib/indicators/formulas.ts`, exported and commented as
  controller-visible so it's easy to find and change), and any indicator computed over fewer
  than `MIN_GROUP_SIZE` people must return a `suprimido: true` result instead of a number — the
  UI shows "Grupo insuficiente para mostrar" instead of a value. This threshold is explicitly
  **not** a legal decision made by this plan; the comment must say so.
- Every table this plan creates has `tenant_id uuid not null references tenants(id)`, RLS
  enabled with policies **and** the matching base `grant` in the same migration step — two
  prior plans in this project shipped to production with RLS policies that were unreachable
  for weeks because the base grants were missing. Every step that creates a table does both in
  the same SQL block.
- `@base-ui/react` quirks already discovered (still apply): `Button` has no `asChild` — use
  `render={<a .../>}` plus `nativeButton={false}` when the host isn't a real `<button>`.
  `Select` uses plain `value`/`onValueChange`, not Radix's compound API.
- All new shadcn primitives are added via the CLI (`npx shadcn@latest add <name>`), never hand
  written.
- WCAG 2.2 AA: visible focus rings, labeled controls, keyboard-operable dashboard.
- Every step that changes code shows the code. No "similar to Task N", no TODOs.
- This machine OOMs `tsc`/`vitest` at default heap size — run every verification as
  `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` /
  `... vitest run <path>` (small heap, local binary, not npx).

## File Structure

```
supabase/
  schema.sql                        (MODIFY — append lineas_base table)
lib/
  indicators/
    types.ts                        (CREATE — LineaBase type + mapLineaBaseRow)
    formulas.ts                     (CREATE — pure formula functions + MIN_GROUP_SIZE + tests)
    aggregate.ts                    (CREATE — computeIndicadores() pure aggregator + tests)
app/
  plataforma/
    resumen/
      page.tsx                      (REWRITE — real dashboard, replacing the placeholder)
components/
  platform/
    dashboard/
      IndicadorCard.tsx              (CREATE)
      GuardarLineaBaseButton.tsx     (CREATE)
```

---

### Task 1: Schema — líneas de base

**Files:**
- Modify: `supabase/schema.sql` (append)
- Create: `lib/indicators/types.ts`

**Interfaces:**
- Produces: SQL table `lineas_base`. TS type `LineaBase` and `mapLineaBaseRow()` in
  `lib/indicators/types.ts`, following the same camelCase/snake_case mapping convention as
  `lib/platform/types.ts` and `lib/ingestion/types.ts`.

- [ ] **Step 1: Append the schema to `supabase/schema.sql`**

```sql
-- ============================================================
-- INDICATORS: lineas_base
-- ============================================================

create table lineas_base (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  periodo_inicio date not null,
  periodo_fin date not null,
  indicadores jsonb not null
);

alter table lineas_base enable row level security;

create policy "lineas_base_select_same_tenant" on lineas_base
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "lineas_base_insert_admin" on lineas_base
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert on lineas_base to authenticated;
grant all on lineas_base to service_role;
```

`indicadores jsonb` stores the full computed `IndicadorResultado` snapshot at capture time
(shape defined in Task 2) — a baseline is a point-in-time copy of the numbers, not a live
recomputation, so historical "cambio" comparisons stay stable even as classification rules or
formulas evolve later.

- [ ] **Step 2: Create `lib/indicators/types.ts`**

```typescript
export type LineaBase = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  creadaPor: string
  periodoInicio: string
  periodoFin: string
  indicadores: unknown
}

export function mapLineaBaseRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  creada_por: string
  periodo_inicio: string
  periodo_fin: string
  indicadores: unknown
}): LineaBase {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    creadaPor: row.creada_por,
    periodoInicio: row.periodo_inicio,
    periodoFin: row.periodo_fin,
    indicadores: row.indicadores,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql lib/indicators/types.ts
git commit -m "feat: add lineas_base schema for indicator baseline snapshots"
```

---

### Task 2: Formula engine

**Files:**
- Create: `lib/indicators/formulas.ts`
- Test: `lib/indicators/formulas.test.ts`

**Interfaces:**
- Produces: `MIN_GROUP_SIZE` (constant), `IndicadorValor` type
  (`{ valor: number; numerador: number; denominador: number } | { suprimido: true }`), and
  seven pure functions: `tasaAusentismo`, `frecuencia`, `severidad`, `duracionPromedio`,
  `reincidencia`, `costoEstimado`, `cambio`. Task 3's aggregator calls the first six per
  period; Task 4's page calls `cambio` to compare the current period against the last saved
  línea base.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/indicators/formulas.test.ts
import { describe, expect, it } from 'vitest'
import {
  MIN_GROUP_SIZE,
  tasaAusentismo,
  frecuencia,
  severidad,
  duracionPromedio,
  reincidencia,
  costoEstimado,
  cambio,
} from './formulas'

describe('tasaAusentismo', () => {
  it('computes (dias perdidos / dias programados) * 100 with numerador/denominador', () => {
    const result = tasaAusentismo({ diasPerdidos: 28, diasProgramados: 560, personasActivas: 10 })
    expect(result).toEqual({ valor: 5, numerador: 28, denominador: 560 })
  })

  it('suppresses the result when personasActivas is below MIN_GROUP_SIZE', () => {
    const result = tasaAusentismo({ diasPerdidos: 3, diasProgramados: 30, personasActivas: MIN_GROUP_SIZE - 1 })
    expect(result).toEqual({ suprimido: true })
  })

  it('returns valor 0 when diasProgramados is 0 (no active people, avoid division by zero)', () => {
    const result = tasaAusentismo({ diasPerdidos: 0, diasProgramados: 0, personasActivas: MIN_GROUP_SIZE })
    expect(result).toEqual({ valor: 0, numerador: 0, denominador: 0 })
  })
})

describe('frecuencia', () => {
  it('computes (episodios / dotacion promedio) * 100', () => {
    const result = frecuencia({ episodios: 12, dotacionPromedio: 40, personasActivas: MIN_GROUP_SIZE })
    expect(result).toEqual({ valor: 30, numerador: 12, denominador: 40 })
  })

  it('suppresses when personasActivas is below MIN_GROUP_SIZE', () => {
    expect(frecuencia({ episodios: 1, dotacionPromedio: 2, personasActivas: 1 })).toEqual({ suprimido: true })
  })
})

describe('severidad', () => {
  it('computes dias perdidos / episodios', () => {
    expect(severidad({ diasPerdidos: 90, episodios: 12, personasActivas: MIN_GROUP_SIZE })).toEqual({
      valor: 7.5,
      numerador: 90,
      denominador: 12,
    })
  })

  it('returns valor 0 when episodios is 0', () => {
    expect(severidad({ diasPerdidos: 0, episodios: 0, personasActivas: MIN_GROUP_SIZE })).toEqual({
      valor: 0,
      numerador: 0,
      denominador: 0,
    })
  })
})

describe('duracionPromedio', () => {
  it('computes dias perdidos / episodios cerrados', () => {
    expect(
      duracionPromedio({ diasPerdidos: 40, episodiosCerrados: 8, personasActivas: MIN_GROUP_SIZE })
    ).toEqual({ valor: 5, numerador: 40, denominador: 8 })
  })
})

describe('reincidencia', () => {
  it('computes personas con 2+ episodios / personas con 1+ episodio', () => {
    expect(
      reincidencia({ personasConDosOMasEpisodios: 6, personasConUnOMasEpisodios: 24, personasActivas: MIN_GROUP_SIZE })
    ).toEqual({ valor: 25, numerador: 6, denominador: 24 })
  })

  it('returns valor 0 when nobody has any episode', () => {
    expect(
      reincidencia({ personasConDosOMasEpisodios: 0, personasConUnOMasEpisodios: 0, personasActivas: MIN_GROUP_SIZE })
    ).toEqual({ valor: 0, numerador: 0, denominador: 0 })
  })
})

describe('cambio', () => {
  it('computes (valor actual - linea base) / linea base as a fraction', () => {
    expect(cambio({ valorActual: 4.5, valorLineaBase: 6 })).toEqual({ valor: (4.5 - 6) / 6, numerador: 4.5 - 6, denominador: 6 })
  })

  it('returns null when there is no baseline to compare against', () => {
    expect(cambio({ valorActual: 5, valorLineaBase: null })).toBeNull()
  })

  it('returns null when either side is suprimido (nothing to compare)', () => {
    expect(cambio({ valorActual: null, valorLineaBase: 5 })).toBeNull()
  })
})

describe('costoEstimado', () => {
  it('sums directos + reemplazos + horas extra + administrativos', () => {
    const result = costoEstimado({
      diasPerdidos: 20,
      costoPromedioDiario: 40000,
      horasExtra: 500000,
      reemplazos: 300000,
      costosAdministrativos: 100000,
      personasActivas: MIN_GROUP_SIZE,
    })
    expect(result).toEqual({ valor: 20 * 40000 + 500000 + 300000 + 100000, numerador: 20 * 40000 + 500000 + 300000 + 100000, denominador: 1 })
  })

  it('is not suppressed by small groups (a cost total, not a per-person rate)', () => {
    const result = costoEstimado({
      diasPerdidos: 1,
      costoPromedioDiario: 1000,
      horasExtra: 0,
      reemplazos: 0,
      costosAdministrativos: 0,
      personasActivas: 1,
    })
    expect(result).toEqual({ valor: 1000, numerador: 1000, denominador: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/indicators/formulas.test.ts`
Expected: FAIL with "Cannot find module './formulas'"

- [ ] **Step 3: Write `lib/indicators/formulas.ts`**

```typescript
// Placeholder minimum group size for small-group suppression — NOT a legal decision. The
// spec (docs/superpowers/specs/2026-07-17-data-platform-mvp.md, section 3) explicitly
// requires this threshold to be set with legal advice on reidentification risk, not an
// arbitrary engineering choice. Controller: replace this value once that advice exists.
export const MIN_GROUP_SIZE = 5

export type IndicadorValor = { valor: number; numerador: number; denominador: number } | { suprimido: true }

function ratio(numerador: number, denominador: number, multiplicador = 1): IndicadorValor {
  if (denominador === 0) {
    return { valor: 0, numerador: 0, denominador: 0 }
  }
  return { valor: (numerador / denominador) * multiplicador, numerador, denominador }
}

export function tasaAusentismo(input: {
  diasPerdidos: number
  diasProgramados: number
  personasActivas: number
}): IndicadorValor {
  if (input.personasActivas < MIN_GROUP_SIZE) return { suprimido: true }
  return ratio(input.diasPerdidos, input.diasProgramados, 100)
}

export function frecuencia(input: {
  episodios: number
  dotacionPromedio: number
  personasActivas: number
}): IndicadorValor {
  if (input.personasActivas < MIN_GROUP_SIZE) return { suprimido: true }
  return ratio(input.episodios, input.dotacionPromedio, 100)
}

export function severidad(input: {
  diasPerdidos: number
  episodios: number
  personasActivas: number
}): IndicadorValor {
  if (input.personasActivas < MIN_GROUP_SIZE) return { suprimido: true }
  return ratio(input.diasPerdidos, input.episodios)
}

export function duracionPromedio(input: {
  diasPerdidos: number
  episodiosCerrados: number
  personasActivas: number
}): IndicadorValor {
  if (input.personasActivas < MIN_GROUP_SIZE) return { suprimido: true }
  return ratio(input.diasPerdidos, input.episodiosCerrados)
}

export function reincidencia(input: {
  personasConDosOMasEpisodios: number
  personasConUnOMasEpisodios: number
  personasActivas: number
}): IndicadorValor {
  if (input.personasActivas < MIN_GROUP_SIZE) return { suprimido: true }
  return ratio(input.personasConDosOMasEpisodios, input.personasConUnOMasEpisodios, 100)
}

// Cost is a total, not a per-person rate — never suppressed by small groups (there's no
// reidentification risk in a currency total the way there is in a rate over few people).
export function costoEstimado(input: {
  diasPerdidos: number
  costoPromedioDiario: number
  horasExtra: number
  reemplazos: number
  costosAdministrativos: number
  personasActivas: number
}): IndicadorValor {
  const total =
    input.diasPerdidos * input.costoPromedioDiario +
    input.horasExtra +
    input.reemplazos +
    input.costosAdministrativos
  return { valor: total, numerador: total, denominador: 1 }
}

// Change vs. a saved baseline. Returns null (not a "0% change") when either side has no
// number to compare — a suppressed/missing value is not the same thing as "no change".
export function cambio(input: {
  valorActual: number | null
  valorLineaBase: number | null
}): IndicadorValor | null {
  if (input.valorActual === null || input.valorLineaBase === null || input.valorLineaBase === 0) {
    return null
  }
  return ratio(input.valorActual - input.valorLineaBase, input.valorLineaBase)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/indicators/formulas.test.ts`
Expected: 14 passed

- [ ] **Step 5: Commit**

```bash
git add lib/indicators/formulas.ts lib/indicators/formulas.test.ts
git commit -m "feat: add fixed-formula indicator engine with small-group suppression"
```

---

### Task 3: Aggregator — from raw rows to indicator results

**Files:**
- Create: `lib/indicators/aggregate.ts`
- Test: `lib/indicators/aggregate.test.ts`

**Interfaces:**
- Consumes: the six formula functions and `IndicadorValor`, `MIN_GROUP_SIZE` (Task 2).
- Produces: `computeIndicadores(input: ComputeIndicadoresInput): IndicadorResultados` — a pure
  function over already-fetched rows (no Supabase calls inside it), so it's fully unit
  testable. `app/plataforma/resumen/page.tsx` (Task 4) fetches rows server-side and calls this.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/indicators/aggregate.test.ts
import { describe, expect, it } from 'vitest'
import { computeIndicadores } from './aggregate'

const COSTOS = { costoPromedioDiario: 40000, horasExtra: 0, reemplazos: 0, costosAdministrativos: 0 }

describe('computeIndicadores', () => {
  it('computes all six indicators from raw episodio/persona rows for a period', () => {
    const personas = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, contratoDias: 90 }))
    const episodios = [
      { personaId: 'p0', dias: 3, estado: 'cerrado' as const },
      { personaId: 'p0', dias: 5, estado: 'cerrado' as const },
      { personaId: 'p1', dias: 10, estado: 'cerrado' as const },
      { personaId: 'p2', dias: 2, estado: 'abierto' as const },
    ]

    const result = computeIndicadores({ personas, episodios, costos: COSTOS })

    expect(result.tasaAusentismo).toEqual({ valor: 20 / 900 * 100, numerador: 20, denominador: 900 })
    expect(result.frecuencia).toEqual({ valor: 4 / 10 * 100, numerador: 4, denominador: 10 })
    expect(result.severidad).toEqual({ valor: 20 / 4, numerador: 20, denominador: 4 })
    expect(result.duracionPromedio).toEqual({ valor: 18 / 3, numerador: 18, denominador: 3 })
    expect(result.reincidencia).toEqual({ valor: 1 / 3 * 100, numerador: 1, denominador: 3 })
    expect(result.costoEstimado).toEqual({ valor: 20 * 40000, numerador: 20 * 40000, denominador: 1 })
  })

  it('suppresses rate indicators (not cost) when fewer than MIN_GROUP_SIZE personas are given', () => {
    const personas = [
      { id: 'p0', contratoDias: 30 },
      { id: 'p1', contratoDias: 30 },
    ]
    const episodios = [{ personaId: 'p0', dias: 2, estado: 'cerrado' as const }]

    const result = computeIndicadores({ personas, episodios, costos: COSTOS })

    expect(result.tasaAusentismo).toEqual({ suprimido: true })
    expect(result.frecuencia).toEqual({ suprimido: true })
    expect(result.severidad).toEqual({ suprimido: true })
    expect(result.reincidencia).toEqual({ suprimido: true })
    expect(result.costoEstimado).toEqual({ valor: 2 * 40000, numerador: 2 * 40000, denominador: 1 })
  })

  it('handles zero episodios without dividing by zero', () => {
    const personas = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, contratoDias: 30 }))
    const result = computeIndicadores({ personas, episodios: [], costos: COSTOS })

    expect(result.severidad).toEqual({ valor: 0, numerador: 0, denominador: 0 })
    expect(result.duracionPromedio).toEqual({ valor: 0, numerador: 0, denominador: 0 })
    expect(result.reincidencia).toEqual({ valor: 0, numerador: 0, denominador: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/indicators/aggregate.test.ts`
Expected: FAIL with "Cannot find module './aggregate'"

- [ ] **Step 3: Write `lib/indicators/aggregate.ts`**

```typescript
import {
  costoEstimado,
  duracionPromedio,
  frecuencia,
  reincidencia,
  severidad,
  tasaAusentismo,
  type IndicadorValor,
} from './formulas'

export type ComputeIndicadoresInput = {
  personas: Array<{ id: string; contratoDias: number }>
  episodios: Array<{ personaId: string; dias: number; estado: 'abierto' | 'cerrado' }>
  costos: {
    costoPromedioDiario: number
    horasExtra: number
    reemplazos: number
    costosAdministrativos: number
  }
}

export type IndicadorResultados = {
  tasaAusentismo: IndicadorValor
  frecuencia: IndicadorValor
  severidad: IndicadorValor
  duracionPromedio: IndicadorValor
  reincidencia: IndicadorValor
  costoEstimado: IndicadorValor
}

export function computeIndicadores(input: ComputeIndicadoresInput): IndicadorResultados {
  const personasActivas = input.personas.length
  const diasProgramados = input.personas.reduce((sum, p) => sum + p.contratoDias, 0)
  const diasPerdidos = input.episodios.reduce((sum, e) => sum + e.dias, 0)
  const episodiosCerrados = input.episodios.filter((e) => e.estado === 'cerrado')
  const diasPerdidosCerrados = episodiosCerrados.reduce((sum, e) => sum + e.dias, 0)

  const episodiosPorPersona = new Map<string, number>()
  for (const episodio of input.episodios) {
    episodiosPorPersona.set(episodio.personaId, (episodiosPorPersona.get(episodio.personaId) ?? 0) + 1)
  }
  const personasConUnOMasEpisodios = Array.from(episodiosPorPersona.values()).filter((count) => count >= 1).length
  const personasConDosOMasEpisodios = Array.from(episodiosPorPersona.values()).filter((count) => count >= 2).length

  return {
    tasaAusentismo: tasaAusentismo({ diasPerdidos, diasProgramados, personasActivas }),
    frecuencia: frecuencia({ episodios: input.episodios.length, dotacionPromedio: personasActivas, personasActivas }),
    severidad: severidad({ diasPerdidos, episodios: input.episodios.length, personasActivas }),
    duracionPromedio: duracionPromedio({
      diasPerdidos: diasPerdidosCerrados,
      episodiosCerrados: episodiosCerrados.length,
      personasActivas,
    }),
    reincidencia: reincidencia({ personasConDosOMasEpisodios, personasConUnOMasEpisodios, personasActivas }),
    costoEstimado: costoEstimado({ diasPerdidos, personasActivas, ...input.costos }),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/indicators/aggregate.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add lib/indicators/aggregate.ts lib/indicators/aggregate.test.ts
git commit -m "feat: add pure indicator aggregator over episodio/persona rows"
```

---

### Task 4: Dashboard UI

**Files:**
- Rewrite: `app/plataforma/resumen/page.tsx`
- Create: `components/platform/dashboard/IndicadorCard.tsx`
- Create: `components/platform/dashboard/GuardarLineaBaseButton.tsx`

**Interfaces:**
- Consumes: `computeIndicadores`, `IndicadorResultados` (Task 3), `cambio`, `IndicadorValor`
  (Task 2), `LineaBase`/`mapLineaBaseRow` (Task 1), `createClient` (server, existing).
- Produces: the real `/plataforma/resumen` dashboard, replacing the platform-foundation
  plan's placeholder page.

- [ ] **Step 1: Install the shadcn primitives this task needs**

```bash
npx shadcn@latest add tooltip
```

- [ ] **Step 2: Create `components/platform/dashboard/IndicadorCard.tsx`**

```tsx
import type { IndicadorValor } from '@/lib/indicators/formulas'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function formatValor(valor: number, sufijo: string) {
  return sufijo === '$' ? `$${valor.toLocaleString('es-CL')}` : `${valor.toFixed(1)}${sufijo}`
}

export function IndicadorCard({
  titulo,
  resultado,
  sufijo,
  etiquetaNumerador,
  etiquetaDenominador,
  cambio,
}: {
  titulo: string
  resultado: IndicadorValor
  sufijo: string
  etiquetaNumerador: string
  etiquetaDenominador: string
  cambio?: IndicadorValor | null
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      {'suprimido' in resultado ? (
        <p className="mt-2 text-sm text-muted-foreground">Grupo insuficiente para mostrar</p>
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger className="text-left">
              <p className="mt-1 font-heading text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">
                {formatValor(resultado.valor, sufijo)}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              {etiquetaNumerador}: {resultado.numerador.toLocaleString('es-CL')} · {etiquetaDenominador}:{' '}
              {resultado.denominador.toLocaleString('es-CL')}
            </TooltipContent>
          </Tooltip>
          {cambio && !('suprimido' in cambio) ? (
            <p
              className={
                cambio.valor <= 0 ? 'mt-1 text-xs text-[#38D978]' : 'mt-1 text-xs text-destructive'
              }
            >
              {cambio.valor > 0 ? '+' : ''}
              {(cambio.valor * 100).toFixed(1)}% vs línea base
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
```

Note on the color rule above: a negative change (the indicator went down) is shown in green and
a positive change in red for every indicator card here, because all six indicators in this
plan (tasa de ausentismo, frecuencia, severidad, duración, reincidencia, costo) are "lower is
better" — none of them are a metric where an increase is good. If a future indicator with the
opposite direction is added, this component's color rule must take a per-indicator
`menorEsMejor` flag rather than assuming it globally.

Showing the denominator as a tooltip rather than always-visible text keeps the card compact
while still satisfying the Global Constraints' "always show the denominator" rule — it's one
interaction away, not hidden behind a separate page.

- [ ] **Step 3: Create `components/platform/dashboard/GuardarLineaBaseButton.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { IndicadorResultados } from '@/lib/indicators/aggregate'

export function GuardarLineaBaseButton({
  tenantId,
  empresaId,
  actorId,
  periodoInicio,
  periodoFin,
  indicadores,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  periodoInicio: string
  periodoFin: string
  indicadores: IndicadorResultados
}) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)

  async function handleGuardar() {
    setGuardando(true)
    const supabase = createClient()
    await supabase.from('lineas_base').insert({
      tenant_id: tenantId,
      empresa_id: empresaId,
      creada_por: actorId,
      periodo_inicio: periodoInicio,
      periodo_fin: periodoFin,
      indicadores,
    })
    setGuardando(false)
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" disabled={guardando} onClick={handleGuardar}>
      {guardando ? 'Guardando…' : 'Guardar línea base'}
    </Button>
  )
}
```

- [ ] **Step 4: Rewrite `app/plataforma/resumen/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapLineaBaseRow } from '@/lib/indicators/types'
import { computeIndicadores, type IndicadorResultados } from '@/lib/indicators/aggregate'
import { cambio, type IndicadorValor } from '@/lib/indicators/formulas'
import { IndicadorCard } from '@/components/platform/dashboard/IndicadorCard'
import { GuardarLineaBaseButton } from '@/components/platform/dashboard/GuardarLineaBaseButton'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

export default async function ResumenPage() {
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

  const periodoFin = new Date().toISOString().slice(0, 10)
  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  const { data: personaRows } = await supabase.from('personas').select('id').eq('empresa_id', empresaId)
  const personas = (personaRows ?? []).map((row) => ({ id: row.id as string, contratoDias: 180 }))

  const personaIds = personas.map((p) => p.id)
  const { data: episodioRows } =
    personaIds.length > 0
      ? await supabase
          .from('episodios')
          .select('persona_id, dias, estado')
          .in('persona_id', personaIds)
          .gte('fecha_inicio', periodoInicio)
      : { data: [] }
  const episodios = (episodioRows ?? []).map((row) => ({
    personaId: row.persona_id as string,
    dias: row.dias as number,
    estado: row.estado as 'abierto' | 'cerrado',
  }))

  const resultados = computeIndicadores({ personas, episodios, costos: COSTOS_DEFAULT })

  const { data: lineaBaseRows } = await supabase
    .from('lineas_base')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(1)
  const ultimaLineaBase = lineaBaseRows?.[0] ? mapLineaBaseRow(lineaBaseRows[0]) : null
  const indicadoresBase = ultimaLineaBase?.indicadores as IndicadorResultados | undefined

  function valorNumerico(resultado: IndicadorValor): number | null {
    return 'suprimido' in resultado ? null : resultado.valor
  }

  function cambioDe(clave: keyof IndicadorResultados) {
    if (!indicadoresBase) return null
    return cambio({
      valorActual: valorNumerico(resultados[clave]),
      valorLineaBase: valorNumerico(indicadoresBase[clave]),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Resumen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Período: {periodoInicio} a {periodoFin} · {personas.length} personas activas
          </p>
        </div>
        <GuardarLineaBaseButton
          tenantId={usuario.tenantId}
          empresaId={empresaId}
          actorId={usuario.id}
          periodoInicio={periodoInicio}
          periodoFin={periodoFin}
          indicadores={resultados}
        />
      </div>

      {ultimaLineaBase ? (
        <p className="text-xs text-muted-foreground">
          Última línea base guardada: {new Date(ultimaLineaBase.createdAt).toLocaleDateString('es-CL')} (
          {ultimaLineaBase.periodoInicio} a {ultimaLineaBase.periodoFin})
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sin línea base guardada todavía — guarda una para poder comparar el cambio en el futuro.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <IndicadorCard
          titulo="Tasa de ausentismo"
          resultado={resultados.tasaAusentismo}
          sufijo="%"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Días programados"
          cambio={cambioDe('tasaAusentismo')}
        />
        <IndicadorCard
          titulo="Frecuencia"
          resultado={resultados.frecuencia}
          sufijo="%"
          etiquetaNumerador="Episodios"
          etiquetaDenominador="Dotación promedio"
          cambio={cambioDe('frecuencia')}
        />
        <IndicadorCard
          titulo="Severidad"
          resultado={resultados.severidad}
          sufijo=" días/episodio"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Episodios"
          cambio={cambioDe('severidad')}
        />
        <IndicadorCard
          titulo="Duración promedio"
          resultado={resultados.duracionPromedio}
          sufijo=" días"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Episodios cerrados"
          cambio={cambioDe('duracionPromedio')}
        />
        <IndicadorCard
          titulo="Reincidencia"
          resultado={resultados.reincidencia}
          sufijo="%"
          etiquetaNumerador="Personas con 2+ episodios"
          etiquetaDenominador="Personas con 1+ episodio"
          cambio={cambioDe('reincidencia')}
        />
        <IndicadorCard
          titulo="Costo estimado"
          resultado={resultados.costoEstimado}
          sufijo="$"
          etiquetaNumerador="Costo total"
          etiquetaDenominador="—"
          cambio={cambioDe('costoEstimado')}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Rol: {rol.nombre}. Los costos usan supuestos por defecto (costo promedio diario
        ${COSTOS_DEFAULT.costoPromedioDiario.toLocaleString('es-CL')}); un panel de configuración de costos
        por empresa queda para un plan posterior.
      </p>
    </div>
  )
}
```

Note for the implementer: `contratoDias: 180` is a placeholder (fixed 6-month assumption per
person) rather than reading each person's real `contratos` row — this plan's `personas` query
above only selects `id`, not contract dates, because computing the exact overlap between each
contract's active window and the reporting period is a real scope of work on its own (handling
mid-period hires/terminations correctly). Flag this explicitly as a known simplification in
your report rather than silently fixing it — a follow-up task should join `contratos` and
compute real active-days-in-period per person.

- [ ] **Step 5: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/plataforma/resumen/page.tsx components/platform/dashboard/IndicadorCard.tsx components/platform/dashboard/GuardarLineaBaseButton.tsx components/ui/tooltip.tsx
git commit -m "feat: replace resumen placeholder with real indicators dashboard"
```

---

### Task 5: Manual verification (controller-only)

This step cannot be delegated to an implementer subagent — it requires applying the schema to
the live Supabase project and a real browser walkthrough, same constraint as prior plans'
final tasks.

- [ ] **Step 1: Full check suite**

```bash
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run
npm run build
```

Expected: all three pass clean.

- [ ] **Step 2: Apply the schema to the live Supabase project**

Via the SQL Editor, run the `lineas_base` block (Task 1), then verify with the same
`information_schema.role_table_grants` query used in prior plans that the grants landed
alongside the RLS policies.

- [ ] **Step 3: Record the outcome**

Append a `Progress Ledger` entry for this plan to `.superpowers/sdd/progress.md`, including the
`contratoDias` simplification and any other deferred nits, so they're triaged before the alerts
plan reads these same indicator values.

---

## Explicitly deferred (not in this plan)

- Filters/drill-down by sucursal, unidad, centro de costo, turno — whole-empresa level only in
  this pass. The org-structure data already exists (platform-foundation plan); wiring filters
  into this dashboard is a bounded follow-up once the base dashboard is proven correct.
- Real per-person active-days-in-period (currently a flat 180-day assumption) — see Task 4's
  implementer note.
- Participación/adherencia formulas — depend on Campaña/Plan/Intervención entities not built
  in any plan yet.
- Alerts engine, PDF reports — next two plans, read from the same `computeIndicadores` output
  and `lineas_base` table this plan produces.
