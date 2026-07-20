# Dashboard Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/plataforma/resumen` dashboard actionable instead of a flat read-only
snapshot — add a per-person cost/days breakdown table, and filters by sucursal/unidad/cargo/
turno, per `docs/superpowers/specs/2026-07-20-dashboard-drilldown-design.md`.

**Architecture:** Same stack as the rest of the platform — Next.js 16 (App Router) + Supabase,
no separate backend. Two independent-but-sequenced pieces: (1A) a per-person indicator table,
pure-function-computed like the existing aggregate indicators; (1B) group filters, which
first require extending the import wizard to actually capture and link
sucursal/unidad/cargo/turno on `personas` (it doesn't today — every imported persona has
`unidad_id`/`cargo_id`/`turno_id` = `null`), then adding filter UI that recomputes the
existing pure indicator functions client-side over the filtered subset.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui
(`base-nova` style, on `@base-ui/react`) + `@supabase/ssr` + Vitest.

## Global Constraints

- **No AI/ML anywhere.** Every computation in this plan is arithmetic (`reduce`/`filter`/
  division) or plain string-name matching — never a model call, never a statistical/ML
  library. Same hard requirement as the rest of this project.
- **Small-group suppression is unchanged.** `MIN_GROUP_SIZE = 5` in
  `lib/indicators/formulas.ts` continues to apply to the six aggregate indicators — including
  when a filter narrows the group below 5, where the existing "Grupo insuficiente para
  mostrar" behavior is exactly correct and needs no new code. It does **not** apply to the new
  per-person table (each row is already a single, named individual by design — see spec's
  "1A" section for the rationale).
- **Per-person table is admin-only** (`superadmin`/`admin_cliente`, via `isAdminRole()` from
  `lib/platform/roles.ts`) — confirmed decision, same gate as the existing "Guardar línea
  base" button. Never show the RUT — only `codigo` (already the level of exposure used in
  "Historial de importaciones").
- **Línea base / "cambio" stays whole-empresa only.** When any filter is active, every
  `IndicadorCard`'s `cambio` prop must be `null` (no comparison shown), and
  "Guardar línea base" must always save the **unfiltered** whole-company snapshot — it must
  be impossible to accidentally save a filtered subset as if it were the company baseline.
- **Unmatched group names during import are advertencias, never críticos, and never
  auto-create a catalog entry.** A `personas` row imports successfully even if its
  Sucursal/Unidad/Cargo/Turno text doesn't match anything in the catalog — it just ends up
  with that link set to `null`, plus a warning row in `errores_calidad`.
- Every table query filters by `empresa_id` (and, in Route Handlers using the admin client,
  by `tenant_id`) — same tenant-isolation convention as every existing query in this project.
- `@base-ui/react` quirks already discovered (still apply): `Select` uses plain
  `value`/`onValueChange`, not Radix's compound API. `Button` has no `asChild` — not used in
  this plan's new code, but keep in mind if you touch anything else.
- WCAG 2.2 AA: every new `Select` gets a paired `<Label htmlFor>` (same pattern as
  `ColumnMappingStep.tsx`); the new sortable table headers are real `<button>` elements
  (native keyboard operability) with a visible `focus-visible` ring.
- Every step that changes code shows the code. No "similar to Task N", no TODOs.
- This machine OOMs `tsc`/`vitest` at default heap size — run every verification as
  `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` /
  `... vitest run <path>` (small heap, local binary, not npx).

## File Structure

```
lib/
  indicators/
    porPersona.ts                      (CREATE — computeIndicadoresPorPersona)
    porPersona.test.ts                  (CREATE)
    filtroPersonas.ts                   (CREATE — filtrarPersonas + FiltroGrupo type)
    filtroPersonas.test.ts              (CREATE)
  ingestion/
    columnMapping.ts                    (MODIFY — 4 new canonical fields, export normalize)
    columnMapping.test.ts               (MODIFY — append tests for the 4 new fields)
    groupMatching.ts                    (CREATE — resolveIdPorNombre, resolveUnidadId)
    groupMatching.test.ts               (CREATE)
components/
  platform/
    dashboard/
      PersonaDetalleTable.tsx           (CREATE)
      ResumenInteractivo.tsx            (CREATE)
    import/
      ColumnMappingStep.tsx             (MODIFY — 4 new field labels)
app/
  plataforma/
    resumen/
      page.tsx                         (MODIFY in Task 2, REWRITE in Task 7)
    importar/
      page.tsx                         (MODIFY — toMappedRows adds 4 fields)
  api/
    platform/
      importaciones/
        ejecutar/
          route.ts                     (MODIFY — catalog resolution + advertencias)
```

---

### Task 1: Per-person formula

**Files:**
- Create: `lib/indicators/porPersona.ts`
- Test: `lib/indicators/porPersona.test.ts`

**Interfaces:**
- Produces: `IndicadorPersona` type (`{ id: string; codigo: string; diasPerdidos: number;
  cantidadEpisodios: number; costoEstimado: number }`) and `computeIndicadoresPorPersona()`.
  Task 2's table component and Task 7's `ResumenInteractivo` both consume these.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/indicators/porPersona.test.ts
import { describe, expect, it } from 'vitest'
import { computeIndicadoresPorPersona } from './porPersona'

describe('computeIndicadoresPorPersona', () => {
  it('computa dias perdidos, cantidad de episodios y costo estimado por cada persona', () => {
    const personas = [
      { id: 'p1', codigo: 'EMP001' },
      { id: 'p2', codigo: 'EMP002' },
    ]
    const episodios = [
      { personaId: 'p1', dias: 3 },
      { personaId: 'p1', dias: 5 },
      { personaId: 'p2', dias: 10 },
    ]

    const resultado = computeIndicadoresPorPersona({ personas, episodios, costoPromedioDiario: 40000 })

    expect(resultado).toEqual([
      { id: 'p1', codigo: 'EMP001', diasPerdidos: 8, cantidadEpisodios: 2, costoEstimado: 8 * 40000 },
      { id: 'p2', codigo: 'EMP002', diasPerdidos: 10, cantidadEpisodios: 1, costoEstimado: 10 * 40000 },
    ])
  })

  it('devuelve ceros para una persona sin episodios en el período', () => {
    const personas = [{ id: 'p1', codigo: 'EMP001' }]
    const resultado = computeIndicadoresPorPersona({ personas, episodios: [], costoPromedioDiario: 40000 })
    expect(resultado).toEqual([{ id: 'p1', codigo: 'EMP001', diasPerdidos: 0, cantidadEpisodios: 0, costoEstimado: 0 }])
  })

  it('ignora episodios de personas que no están en la lista de personas activas', () => {
    const personas = [{ id: 'p1', codigo: 'EMP001' }]
    const episodios = [
      { personaId: 'p1', dias: 3 },
      { personaId: 'p-fantasma', dias: 99 },
    ]
    const resultado = computeIndicadoresPorPersona({ personas, episodios, costoPromedioDiario: 40000 })
    expect(resultado).toEqual([{ id: 'p1', codigo: 'EMP001', diasPerdidos: 3, cantidadEpisodios: 1, costoEstimado: 3 * 40000 }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/indicators/porPersona.test.ts`
Expected: FAIL with "Cannot find module './porPersona'"

- [ ] **Step 3: Write `lib/indicators/porPersona.ts`**

```typescript
export type IndicadorPersona = {
  id: string
  codigo: string
  diasPerdidos: number
  cantidadEpisodios: number
  costoEstimado: number
}

export function computeIndicadoresPorPersona(input: {
  personas: Array<{ id: string; codigo: string }>
  episodios: Array<{ personaId: string; dias: number }>
  costoPromedioDiario: number
}): IndicadorPersona[] {
  const diasPorPersona = new Map<string, number>()
  const episodiosPorPersona = new Map<string, number>()

  for (const episodio of input.episodios) {
    diasPorPersona.set(episodio.personaId, (diasPorPersona.get(episodio.personaId) ?? 0) + episodio.dias)
    episodiosPorPersona.set(episodio.personaId, (episodiosPorPersona.get(episodio.personaId) ?? 0) + 1)
  }

  return input.personas.map((persona) => {
    const diasPerdidos = diasPorPersona.get(persona.id) ?? 0
    return {
      id: persona.id,
      codigo: persona.codigo,
      diasPerdidos,
      cantidadEpisodios: episodiosPorPersona.get(persona.id) ?? 0,
      costoEstimado: diasPerdidos * input.costoPromedioDiario,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/indicators/porPersona.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add lib/indicators/porPersona.ts lib/indicators/porPersona.test.ts
git commit -m "feat: add per-person indicator formula (dias perdidos, episodios, costo)"
```

---

### Task 2: Per-person table, wired into the dashboard (ships 1A)

**Files:**
- Create: `components/platform/dashboard/PersonaDetalleTable.tsx`
- Modify: `app/plataforma/resumen/page.tsx`

**Interfaces:**
- Consumes: `computeIndicadoresPorPersona`, `IndicadorPersona` (Task 1); `isAdminRole` from
  `lib/platform/roles.ts` (existing).
- Produces: the real, working "1A" feature — `PersonaDetalleTable` is later reused unchanged
  by Task 7's `ResumenInteractivo`.

- [ ] **Step 1: Create `components/platform/dashboard/PersonaDetalleTable.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { isAdminRole } from '@/lib/platform/roles'
import type { IndicadorPersona } from '@/lib/indicators/porPersona'

type Columna = 'diasPerdidos' | 'cantidadEpisodios' | 'costoEstimado'

const COLUMNAS: Array<{ clave: Columna; etiqueta: string }> = [
  { clave: 'diasPerdidos', etiqueta: 'Días perdidos' },
  { clave: 'cantidadEpisodios', etiqueta: 'Episodios' },
  { clave: 'costoEstimado', etiqueta: 'Costo estimado' },
]

export function PersonaDetalleTable({
  rolClave,
  personas,
}: {
  rolClave: string
  personas: IndicadorPersona[]
}) {
  const [columnaOrden, setColumnaOrden] = useState<Columna>('costoEstimado')
  const [ascendente, setAscendente] = useState(false)

  const personasOrdenadas = useMemo(() => {
    const copia = [...personas]
    copia.sort((a, b) => (ascendente ? a[columnaOrden] - b[columnaOrden] : b[columnaOrden] - a[columnaOrden]))
    return copia
  }, [personas, columnaOrden, ascendente])

  // The DB-level rate limit is Guardar línea base's (superadmin/admin_cliente insert
  // policy); this table has no DB write, but showing individual cost/days per person is a
  // deliberate access decision (confirmed with the product owner), not a technical one —
  // keep this gate even though nothing here calls Supabase.
  if (!isAdminRole(rolClave)) return null

  function alternarOrden(columna: Columna) {
    if (columna === columnaOrden) {
      setAscendente((anterior) => !anterior)
    } else {
      setColumnaOrden(columna)
      setAscendente(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-lg font-semibold text-foreground">Detalle por persona</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4">Código</th>
              {COLUMNAS.map((columna) => (
                <th key={columna.clave} className="py-2 pr-4">
                  <button
                    type="button"
                    className="rounded font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onClick={() => alternarOrden(columna.clave)}
                    aria-sort={columna.clave === columnaOrden ? (ascendente ? 'ascending' : 'descending') : 'none'}
                  >
                    {columna.etiqueta}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personasOrdenadas.map((persona) => (
              <tr key={persona.id} className="border-b border-border/50">
                <td className="py-2 pr-4 text-foreground">{persona.codigo}</td>
                <td className="py-2 pr-4 text-foreground">{persona.diasPerdidos}</td>
                <td className="py-2 pr-4 text-foreground">{persona.cantidadEpisodios}</td>
                <td className="py-2 pr-4 text-foreground">${persona.costoEstimado.toLocaleString('es-CL')}</td>
              </tr>
            ))}
            {personasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                  No hay personas para mostrar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Modify `app/plataforma/resumen/page.tsx`**

Three surgical changes to the existing file:

1. Add two imports, right after the existing `import { GuardarLineaBaseButton } ...` line:

```typescript
import { computeIndicadoresPorPersona } from '@/lib/indicators/porPersona'
import { PersonaDetalleTable } from '@/components/platform/dashboard/PersonaDetalleTable'
```

2. Change the `personaRows` query and the `personas` mapping (currently `select('id')` and
   `{ id: row.id as string, contratoDias: 180 }`) to also carry `codigo`:

```typescript
  const { data: personaRows } = await supabase.from('personas').select('id, codigo').eq('empresa_id', empresaId)
  // Placeholder: assumes every active persona was contracted for the full 6-month period
  // (flat 180 days), instead of reading each person's real `contratos` row. Follow-up task
  // should join `contratos` to compute real active-days-in-period per persona.
  const personas = (personaRows ?? []).map((row) => ({
    id: row.id as string,
    codigo: row.codigo as string,
    contratoDias: 180,
  }))
```

3. Right after the existing `const resultados = computeIndicadores({ personas, episodios, costos: COSTOS_DEFAULT })`
   line, add:

```typescript
  const personasIndicador = computeIndicadoresPorPersona({
    personas,
    episodios,
    costoPromedioDiario: COSTOS_DEFAULT.costoPromedioDiario,
  })
```

4. In the JSX, right after the `</div>` that closes the 6-card grid (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`)
   and before the final "Rol: ..." paragraph, add:

```tsx
      <PersonaDetalleTable rolClave={rol.clave} personas={personasIndicador} />
```

- [ ] **Step 3: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/plataforma/resumen/page.tsx components/platform/dashboard/PersonaDetalleTable.tsx
git commit -m "feat: add per-person detail table to the indicators dashboard"
```

---

### Task 3: Extend column mapping with organizational fields

**Files:**
- Modify: `lib/ingestion/columnMapping.ts`
- Test: `lib/ingestion/columnMapping.test.ts` (append)

**Interfaces:**
- Produces: `CANONICAL_FIELDS` grows to 10 entries (adds `sucursal`, `unidad`, `cargo`,
  `turno`); `normalize()` becomes exported (Task 4's `groupMatching.ts` imports it — this is
  the same normalization already used for header matching, reused so the two don't drift).
- Consumes by later tasks: Task 5 (import wizard UI + `toMappedRows`) reads the new fields
  from `CANONICAL_FIELDS`; Task 4 imports `normalize`.

- [ ] **Step 1: Write the failing test**

Append to `lib/ingestion/columnMapping.test.ts` (do not remove the existing 5 tests):

```typescript
describe('grupo organizacional (sucursal, unidad, cargo, turno)', () => {
  it('matches new organizational headers exactly', () => {
    const result = suggestColumnMapping(['Sucursal', 'Unidad', 'Cargo', 'Turno'])
    expect(result.sucursal).toBe('Sucursal')
    expect(result.unidad).toBe('Unidad')
    expect(result.cargo).toBe('Cargo')
    expect(result.turno).toBe('Turno')
  })

  it('matches "Área" as an alias for unidad', () => {
    const result = suggestColumnMapping(['Área'])
    expect(result.unidad).toBe('Área')
  })

  it('does not map "Centro de Costo" to any of the 4 new fields (out of scope this phase)', () => {
    const result = suggestColumnMapping(['Centro de Costo'])
    expect(result.sucursal).toBeNull()
    expect(result.unidad).toBeNull()
    expect(result.cargo).toBeNull()
    expect(result.turno).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/columnMapping.test.ts`
Expected: FAIL — `result.sucursal` is `undefined`, not present on the returned object
(`sucursal` isn't in `CANONICAL_FIELDS` yet)

- [ ] **Step 3: Modify `lib/ingestion/columnMapping.ts`**

Replace the `CANONICAL_FIELDS` and `ALIASES` declarations (lines 1-13) with:

```typescript
export const CANONICAL_FIELDS = [
  'rut',
  'fechaInicio',
  'fechaFin',
  'dias',
  'tipoAdministrativo',
  'codigoPersona',
  'sucursal',
  'unidad',
  'cargo',
  'turno',
] as const
export type CanonicalField = (typeof CANONICAL_FIELDS)[number]

// Plain string-similarity aliases, no model — see Global Constraints. Listed in priority
// order per field; the first header that matches any alias wins.
const ALIASES: Record<CanonicalField, string[]> = {
  rut: ['rut', 'rut trabajador', 'run'],
  fechaInicio: ['fecha inicio', 'fecha de inicio', 'inicio'],
  fechaFin: ['fecha fin', 'fecha de termino', 'fecha de término', 'termino', 'término'],
  dias: ['dias', 'días', 'dias ausencia', 'días de ausencia'],
  tipoAdministrativo: ['tipo', 'tipo licencia', 'tipo de licencia', 'tipo administrativo'],
  codigoPersona: ['codigo', 'código', 'codigo persona', 'código persona', 'legajo'],
  sucursal: ['sucursal', 'sede', 'planta'],
  unidad: ['unidad', 'area', 'área', 'departamento'],
  cargo: ['cargo', 'puesto', 'posicion', 'posición'],
  turno: ['turno'],
}
```

Then change `function normalize(value: string): string {` to `export function normalize(value: string): string {`
(only the added `export` keyword — the function body is unchanged).

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/columnMapping.test.ts`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add lib/ingestion/columnMapping.ts lib/ingestion/columnMapping.test.ts
git commit -m "feat: add sucursal/unidad/cargo/turno as mappable import columns"
```

---

### Task 4: Group-name-to-catalog-ID resolver

**Files:**
- Create: `lib/ingestion/groupMatching.ts`
- Test: `lib/ingestion/groupMatching.test.ts`

**Interfaces:**
- Consumes: `normalize` from `lib/ingestion/columnMapping.ts` (Task 3).
- Produces: `resolveIdPorNombre(nombre, catalogo)` and
  `resolveUnidadId(unidadNombre, sucursalNombre, sucursales, unidades)`, both pure and
  DB-free. Task 5's `app/api/platform/importaciones/ejecutar/route.ts` calls these directly
  over catalogs it fetches itself — this module never touches Supabase.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/ingestion/groupMatching.test.ts
import { describe, expect, it } from 'vitest'
import { resolveIdPorNombre, resolveUnidadId } from './groupMatching'

describe('resolveIdPorNombre', () => {
  const catalogo = [
    { id: 'c1', nombre: 'Ventas' },
    { id: 'c2', nombre: 'Logística' },
  ]

  it('resuelve por coincidencia exacta', () => {
    expect(resolveIdPorNombre('Ventas', catalogo)).toBe('c1')
  })

  it('resuelve insensible a mayúsculas y acentos', () => {
    expect(resolveIdPorNombre('logistica', catalogo)).toBe('c2')
  })

  it('devuelve null cuando no hay coincidencia', () => {
    expect(resolveIdPorNombre('Marketing', catalogo)).toBeNull()
  })

  it('devuelve null cuando el nombre es null', () => {
    expect(resolveIdPorNombre(null, catalogo)).toBeNull()
  })
})

describe('resolveUnidadId', () => {
  const sucursales = [
    { id: 's1', nombre: 'Santiago Centro' },
    { id: 's2', nombre: 'Valparaíso' },
  ]
  const unidades = [
    { id: 'u1', nombre: 'Ventas', sucursalId: 's1' },
    { id: 'u2', nombre: 'Ventas', sucursalId: 's2' },
    { id: 'u3', nombre: 'Logística', sucursalId: 's2' },
  ]

  it('resuelve la unidad correcta dentro de la sucursal indicada, cuando el mismo nombre existe en varias sucursales', () => {
    expect(resolveUnidadId('Ventas', 'Valparaíso', sucursales, unidades)).toBe('u2')
    expect(resolveUnidadId('Ventas', 'Santiago Centro', sucursales, unidades)).toBe('u1')
  })

  it('resuelve por nombre de unidad sola cuando no se indica sucursal (primera coincidencia)', () => {
    expect(resolveUnidadId('Logística', null, sucursales, unidades)).toBe('u3')
  })

  it('devuelve null cuando la sucursal indicada no existe en el catálogo', () => {
    expect(resolveUnidadId('Ventas', 'Concepción', sucursales, unidades)).toBeNull()
  })

  it('devuelve null cuando el nombre de unidad es null', () => {
    expect(resolveUnidadId(null, null, sucursales, unidades)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/groupMatching.test.ts`
Expected: FAIL with "Cannot find module './groupMatching'"

- [ ] **Step 3: Write `lib/ingestion/groupMatching.ts`**

```typescript
import { normalize } from './columnMapping'

export type CatalogoSimple = { id: string; nombre: string }
export type CatalogoUnidad = { id: string; nombre: string; sucursalId: string }

export function resolveIdPorNombre(nombre: string | null, catalogo: CatalogoSimple[]): string | null {
  if (!nombre) return null
  const normalizado = normalize(nombre)
  return catalogo.find((item) => normalize(item.nombre) === normalizado)?.id ?? null
}

// When the sheet also provides a Sucursal column, use it to disambiguate — unidad names are
// only unique within a sucursal in this schema (two branches can both have a "Ventas" unit).
// Without a Sucursal value, fall back to the first unidad matching that name anywhere in the
// empresa's catalog.
export function resolveUnidadId(
  unidadNombre: string | null,
  sucursalNombre: string | null,
  sucursales: CatalogoSimple[],
  unidades: CatalogoUnidad[]
): string | null {
  if (!unidadNombre) return null
  const unidadNormalizada = normalize(unidadNombre)

  if (sucursalNombre) {
    const sucursalId = resolveIdPorNombre(sucursalNombre, sucursales)
    if (!sucursalId) return null
    return unidades.find((u) => u.sucursalId === sucursalId && normalize(u.nombre) === unidadNormalizada)?.id ?? null
  }

  return unidades.find((u) => normalize(u.nombre) === unidadNormalizada)?.id ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/groupMatching.test.ts`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add lib/ingestion/groupMatching.ts lib/ingestion/groupMatching.test.ts
git commit -m "feat: add pure name-to-catalog-id resolver for import group matching"
```

---

### Task 5: Wire organizational columns through the import wizard

**Files:**
- Modify: `app/plataforma/importar/page.tsx`
- Modify: `app/api/platform/importaciones/ejecutar/route.ts`

**Interfaces:**
- Consumes: `resolveIdPorNombre`, `resolveUnidadId` (Task 4); `CANONICAL_FIELDS` (Task 3).
- Produces: personas created by this route now get `unidad_id`/`cargo_id`/`turno_id`
  populated when the sheet provides matching names; Task 7's filters have real data to filter
  by. No new task depends on new exports from this task — it's the last link before the
  filter UI.

> **Note (corrected during execution):** `components/platform/import/ColumnMappingStep.tsx`'s
> `FIELD_LABELS` update was originally planned as this task's Step 1, but
> `Record<CanonicalField, string>` requires every union member as a key — widening
> `CanonicalField` in Task 3 doesn't typecheck without also updating `FIELD_LABELS` in the
> same commit. Task 3 already made this change (verified in review, commit `9e3785d`); there
> is nothing left to do to that file here.

- [ ] **Step 1: Modify `app/plataforma/importar/page.tsx`**

Replace the `toMappedRows` function with:

```typescript
function toMappedRows(
  parsed: ParsedSpreadsheet,
  mapping: Record<CanonicalField, string | null>
): Array<
  MappedRow & {
    codigoPersona: string | null
    sucursal: string | null
    unidad: string | null
    cargo: string | null
    turno: string | null
  }
> {
  return parsed.rows.map((row) => ({
    rut: mapping.rut ? String(row[mapping.rut] ?? '') || null : null,
    fechaInicio: mapping.fechaInicio ? String(row[mapping.fechaInicio] ?? '') || null : null,
    fechaFin: mapping.fechaFin ? String(row[mapping.fechaFin] ?? '') || null : null,
    dias: mapping.dias ? Number(row[mapping.dias]) : null,
    tipoAdministrativo: mapping.tipoAdministrativo ? String(row[mapping.tipoAdministrativo] ?? '') || null : null,
    codigoPersona: mapping.codigoPersona ? String(row[mapping.codigoPersona] ?? '') || null : null,
    sucursal: mapping.sucursal ? String(row[mapping.sucursal] ?? '') || null : null,
    unidad: mapping.unidad ? String(row[mapping.unidad] ?? '') || null : null,
    cargo: mapping.cargo ? String(row[mapping.cargo] ?? '') || null : null,
    turno: mapping.turno ? String(row[mapping.turno] ?? '') || null : null,
  }))
}
```

Nothing else in this file changes — `handleEjecutar` already sends `mappedRows` wholesale in
the request body, so the 4 new fields ride along automatically.

- [ ] **Step 2: Modify `app/api/platform/importaciones/ejecutar/route.ts`**

Add this import alongside the existing ones at the top of the file:

```typescript
import { resolveIdPorNombre, resolveUnidadId } from '@/lib/ingestion/groupMatching'
```

Change the `body` type to widen `rows`:

```typescript
  const body = (await request.json()) as {
    archivoNombre: string
    archivoHash: string
    empresaId: string
    forzarReimportacion?: boolean
    rows: Array<
      MappedRow & {
        codigoPersona: string | null
        sucursal: string | null
        unidad: string | null
        cargo: string | null
        turno: string | null
      }
    >
  }
```

Right after the existing block that builds `tiposValidos`/`tipoIdPorClave` (the block reading
`tipos_administrativos`), add the organizational catalog fetch and an accumulator for group
warnings:

```typescript
  const { data: sucursalRows } = await admin
    .from('sucursales')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', body.empresaId)
  const sucursales = (sucursalRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))
  const sucursalIds = sucursales.map((s) => s.id)

  const { data: unidadRows } =
    sucursalIds.length > 0
      ? await admin
          .from('unidades')
          .select('id, nombre, sucursal_id')
          .eq('tenant_id', tenantId)
          .in('sucursal_id', sucursalIds)
      : { data: [] }
  const unidades = (unidadRows ?? []).map((row) => ({
    id: row.id as string,
    nombre: row.nombre as string,
    sucursalId: row.sucursal_id as string,
  }))

  const { data: cargoRows } = await admin
    .from('cargos')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', body.empresaId)
  const cargos = (cargoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: turnoRows } = await admin
    .from('turnos')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', body.empresaId)
  const turnos = (turnoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const advertenciasGrupo: Array<{
    tenant_id: string
    importacion_id: string
    fila: number
    severidad: 'advertencia'
    tipo: string
    mensaje: string
  }> = []
```

Replace the persona-creation block inside the per-row loop (currently the `if (!personaId) { ... }`
block that inserts a new persona) with:

```typescript
    let personaId = existingPersona?.id as string | undefined
    if (!personaId) {
      const unidadId = resolveUnidadId(row.unidad, row.sucursal, sucursales, unidades)
      if (row.unidad && !unidadId) {
        advertenciasGrupo.push({
          tenant_id: tenantId,
          importacion_id: importacion.id,
          fila: index,
          severidad: 'advertencia',
          tipo: 'grupo_no_reconocido',
          mensaje: `La unidad "${row.unidad}" no existe en el catálogo; la persona quedará sin unidad asignada.`,
        })
      }

      const cargoId = resolveIdPorNombre(row.cargo, cargos)
      if (row.cargo && !cargoId) {
        advertenciasGrupo.push({
          tenant_id: tenantId,
          importacion_id: importacion.id,
          fila: index,
          severidad: 'advertencia',
          tipo: 'grupo_no_reconocido',
          mensaje: `El cargo "${row.cargo}" no existe en el catálogo; la persona quedará sin cargo asignado.`,
        })
      }

      const turnoId = resolveIdPorNombre(row.turno, turnos)
      if (row.turno && !turnoId) {
        advertenciasGrupo.push({
          tenant_id: tenantId,
          importacion_id: importacion.id,
          fila: index,
          severidad: 'advertencia',
          tipo: 'grupo_no_reconocido',
          mensaje: `El turno "${row.turno}" no existe en el catálogo; la persona quedará sin turno asignado.`,
        })
      }

      const { data: newPersona, error: personaError } = await admin
        .from('personas')
        .insert({
          tenant_id: tenantId,
          empresa_id: body.empresaId,
          codigo: row.codigoPersona ?? rutHash.slice(0, 8),
          rut_hash: rutHash,
          unidad_id: unidadId,
          cargo_id: cargoId,
          turno_id: turnoId,
        })
        .select()
        .single()
      if (personaError || !newPersona) {
        filasRechazadas += 1
        continue
      }
      personaId = newPersona.id as string
    }
```

Right before the existing `await admin.from('importaciones').update({...})` call at the end
of the handler, add:

```typescript
  if (advertenciasGrupo.length > 0) {
    await admin.from('errores_calidad').insert(advertenciasGrupo)
  }
```

And change that `update` call's `advertencias` field from `validation.resumen.advertencias` to:

```typescript
      advertencias: validation.resumen.advertencias + advertenciasGrupo.length,
```

(Every other field in that `update` call stays exactly as it is today.)

- [ ] **Step 3: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/plataforma/importar/page.tsx app/api/platform/importaciones/ejecutar/route.ts
git commit -m "feat: resolve sucursal/unidad/cargo/turno to catalog IDs during import execution"
```

---

### Task 6: Pure group filter over already-fetched rows

**Files:**
- Create: `lib/indicators/filtroPersonas.ts`
- Test: `lib/indicators/filtroPersonas.test.ts`

**Interfaces:**
- Produces: `FiltroGrupo` type (`{ sucursalId: string | null; unidadId: string | null;
  cargoId: string | null; turnoId: string | null }`) and `filtrarPersonas(personas, filtro,
  unidades)`. Task 7's `ResumenInteractivo` is the only consumer.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/indicators/filtroPersonas.test.ts
import { describe, expect, it } from 'vitest'
import { filtrarPersonas } from './filtroPersonas'

const unidades = [
  { id: 'u1', sucursalId: 's1' },
  { id: 'u2', sucursalId: 's2' },
]

const personas = [
  { id: 'p1', unidadId: 'u1', cargoId: 'c1', turnoId: 't1' },
  { id: 'p2', unidadId: 'u2', cargoId: 'c2', turnoId: 't1' },
  { id: 'p3', unidadId: null, cargoId: null, turnoId: null },
]

describe('filtrarPersonas', () => {
  it('devuelve todas las personas cuando el filtro está vacío', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: null, unidadId: null, cargoId: null, turnoId: null }, unidades)
    expect(resultado).toEqual(personas)
  })

  it('filtra por unidad', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: null, unidadId: 'u1', cargoId: null, turnoId: null }, unidades)
    expect(resultado).toEqual([personas[0]])
  })

  it('filtra por sucursal, incluyendo solo personas de las unidades de esa sucursal', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: 's2', unidadId: null, cargoId: null, turnoId: null }, unidades)
    expect(resultado).toEqual([personas[1]])
  })

  it('excluye personas sin unidad asignada cuando el filtro es por sucursal', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: 's1', unidadId: null, cargoId: null, turnoId: null }, unidades)
    expect(resultado).toEqual([personas[0]])
  })

  it('combina varios filtros a la vez (AND)', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: null, unidadId: null, cargoId: null, turnoId: 't1' }, unidades)
    expect(resultado).toEqual([personas[0], personas[1]])
  })

  it('devuelve arreglo vacío cuando ningún filtro coincide', () => {
    const resultado = filtrarPersonas(personas, { sucursalId: null, unidadId: 'u-inexistente', cargoId: null, turnoId: null }, unidades)
    expect(resultado).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/indicators/filtroPersonas.test.ts`
Expected: FAIL with "Cannot find module './filtroPersonas'"

- [ ] **Step 3: Write `lib/indicators/filtroPersonas.ts`**

```typescript
export type FiltroGrupo = {
  sucursalId: string | null
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
}

export type PersonaConGrupo = {
  id: string
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
}

export function filtrarPersonas<T extends PersonaConGrupo>(
  personas: T[],
  filtro: FiltroGrupo,
  unidades: Array<{ id: string; sucursalId: string }>
): T[] {
  const unidadIdsDeSucursal = filtro.sucursalId
    ? new Set(unidades.filter((u) => u.sucursalId === filtro.sucursalId).map((u) => u.id))
    : null

  return personas.filter((persona) => {
    if (unidadIdsDeSucursal && (!persona.unidadId || !unidadIdsDeSucursal.has(persona.unidadId))) return false
    if (filtro.unidadId && persona.unidadId !== filtro.unidadId) return false
    if (filtro.cargoId && persona.cargoId !== filtro.cargoId) return false
    if (filtro.turnoId && persona.turnoId !== filtro.turnoId) return false
    return true
  })
}
```

(`filtrarPersonas` is generic over `T` so Task 7 can pass its richer persona objects — which
also carry `codigo`/`contratoDias` — straight through without an intermediate mapping step,
and get them back out with the same shape.)

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/indicators/filtroPersonas.test.ts`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add lib/indicators/filtroPersonas.ts lib/indicators/filtroPersonas.test.ts
git commit -m "feat: add pure group filter for personas by sucursal/unidad/cargo/turno"
```

---

### Task 7: Filter UI on the dashboard (ships 1B)

**Files:**
- Create: `components/platform/dashboard/ResumenInteractivo.tsx`
- Rewrite: `app/plataforma/resumen/page.tsx`

**Interfaces:**
- Consumes: `computeIndicadores`, `IndicadorResultados` (existing `lib/indicators/aggregate.ts`);
  `computeIndicadoresPorPersona` (Task 1); `filtrarPersonas`, `FiltroGrupo`
  (Task 6); `cambio`, `IndicadorValor` (existing `lib/indicators/formulas.ts`); `IndicadorCard`,
  `PersonaDetalleTable` (Task 2), `GuardarLineaBaseButton` (existing) — all unchanged, only
  wired together differently.
- Produces: the real, working "1B" feature — the final shape of `/plataforma/resumen`.

- [ ] **Step 1: Create `components/platform/dashboard/ResumenInteractivo.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { computeIndicadores, type IndicadorResultados } from '@/lib/indicators/aggregate'
import { computeIndicadoresPorPersona } from '@/lib/indicators/porPersona'
import { filtrarPersonas, type FiltroGrupo } from '@/lib/indicators/filtroPersonas'
import { cambio, type IndicadorValor } from '@/lib/indicators/formulas'
import { IndicadorCard } from '@/components/platform/dashboard/IndicadorCard'
import { PersonaDetalleTable } from '@/components/platform/dashboard/PersonaDetalleTable'
import { GuardarLineaBaseButton } from '@/components/platform/dashboard/GuardarLineaBaseButton'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const FILTRO_VACIO: FiltroGrupo = { sucursalId: null, unidadId: null, cargoId: null, turnoId: null }

type Persona = {
  id: string
  codigo: string
  contratoDias: number
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
}
type Episodio = { personaId: string; dias: number; estado: 'abierto' | 'cerrado' }
type CatalogoItem = { id: string; nombre: string }
type UnidadItem = { id: string; nombre: string; sucursalId: string }
type Costos = { costoPromedioDiario: number; horasExtra: number; reemplazos: number; costosAdministrativos: number }

export function ResumenInteractivo({
  personas,
  episodios,
  sucursales,
  unidades,
  cargos,
  turnos,
  costos,
  indicadoresBase,
  periodoInicio,
  periodoFin,
  tenantId,
  empresaId,
  actorId,
  rolClave,
}: {
  personas: Persona[]
  episodios: Episodio[]
  sucursales: CatalogoItem[]
  unidades: UnidadItem[]
  cargos: CatalogoItem[]
  turnos: CatalogoItem[]
  costos: Costos
  indicadoresBase: IndicadorResultados | undefined
  periodoInicio: string
  periodoFin: string
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
}) {
  const [filtro, setFiltro] = useState<FiltroGrupo>(FILTRO_VACIO)
  const hayFiltroActivo = Boolean(filtro.sucursalId || filtro.unidadId || filtro.cargoId || filtro.turnoId)

  const personasFiltradas = useMemo(() => filtrarPersonas(personas, filtro, unidades), [personas, filtro, unidades])
  const personaIdsFiltrados = useMemo(() => new Set(personasFiltradas.map((p) => p.id)), [personasFiltradas])
  const episodiosFiltrados = useMemo(
    () => episodios.filter((episodio) => personaIdsFiltrados.has(episodio.personaId)),
    [episodios, personaIdsFiltrados]
  )

  const resultados = useMemo(
    () => computeIndicadores({ personas: personasFiltradas, episodios: episodiosFiltrados, costos }),
    [personasFiltradas, episodiosFiltrados, costos]
  )

  const resultadosSinFiltro = useMemo(
    () => computeIndicadores({ personas, episodios, costos }),
    [personas, episodios, costos]
  )

  const personasIndicador = useMemo(
    () =>
      computeIndicadoresPorPersona({
        personas: personasFiltradas,
        episodios: episodiosFiltrados,
        costoPromedioDiario: costos.costoPromedioDiario,
      }),
    [personasFiltradas, episodiosFiltrados, costos.costoPromedioDiario]
  )

  const unidadesDisponibles = useMemo(
    () => (filtro.sucursalId ? unidades.filter((u) => u.sucursalId === filtro.sucursalId) : unidades),
    [unidades, filtro.sucursalId]
  )

  function valorNumerico(resultado: IndicadorValor): number | null {
    return 'suprimido' in resultado ? null : resultado.valor
  }

  function cambioDe(clave: keyof IndicadorResultados): IndicadorValor | null {
    if (hayFiltroActivo || !indicadoresBase) return null
    return cambio({
      valorActual: valorNumerico(resultados[clave]),
      valorLineaBase: valorNumerico(indicadoresBase[clave]),
    })
  }

  function actualizarFiltro(campo: keyof FiltroGrupo, valor: string | null) {
    setFiltro((anterior) => {
      const siguiente = { ...anterior, [campo]: valor }
      if (campo === 'sucursalId') siguiente.unidadId = null
      return siguiente
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-sucursal" className="text-sm text-muted-foreground">
              Sucursal
            </Label>
            <Select
              value={filtro.sucursalId ?? '__todas__'}
              onValueChange={(valor) => actualizarFiltro('sucursalId', valor === '__todas__' ? null : valor)}
            >
              <SelectTrigger id="filtro-sucursal" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas</SelectItem>
                {sucursales.map((sucursal) => (
                  <SelectItem key={sucursal.id} value={sucursal.id}>
                    {sucursal.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-unidad" className="text-sm text-muted-foreground">
              Unidad
            </Label>
            <Select
              value={filtro.unidadId ?? '__todas__'}
              onValueChange={(valor) => actualizarFiltro('unidadId', valor === '__todas__' ? null : valor)}
            >
              <SelectTrigger id="filtro-unidad" className="w-full">
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
          <div className="space-y-1.5">
            <Label htmlFor="filtro-cargo" className="text-sm text-muted-foreground">
              Cargo
            </Label>
            <Select
              value={filtro.cargoId ?? '__todos__'}
              onValueChange={(valor) => actualizarFiltro('cargoId', valor === '__todos__' ? null : valor)}
            >
              <SelectTrigger id="filtro-cargo" className="w-full">
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
          <div className="space-y-1.5">
            <Label htmlFor="filtro-turno" className="text-sm text-muted-foreground">
              Turno
            </Label>
            <Select
              value={filtro.turnoId ?? '__todos__'}
              onValueChange={(valor) => actualizarFiltro('turnoId', valor === '__todos__' ? null : valor)}
            >
              <SelectTrigger id="filtro-turno" className="w-full">
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
        {!hayFiltroActivo ? (
          <GuardarLineaBaseButton
            tenantId={tenantId}
            empresaId={empresaId}
            actorId={actorId}
            rolClave={rolClave}
            periodoInicio={periodoInicio}
            periodoFin={periodoFin}
            indicadores={resultadosSinFiltro}
          />
        ) : null}
      </div>

      {hayFiltroActivo ? (
        <p className="text-xs text-muted-foreground">
          Mostrando {personasFiltradas.length} de {personas.length} personas. La comparación con línea base solo
          está disponible sin filtros.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{personas.length} personas activas.</p>
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

      <PersonaDetalleTable rolClave={rolClave} personas={personasIndicador} />
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `app/plataforma/resumen/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { mapLineaBaseRow } from '@/lib/indicators/types'
import type { IndicadorResultados } from '@/lib/indicators/aggregate'
import type { IndicadorValor } from '@/lib/indicators/formulas'
import { ResumenInteractivo } from '@/components/platform/dashboard/ResumenInteractivo'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

const INDICADOR_KEYS: readonly (keyof IndicadorResultados)[] = [
  'tasaAusentismo',
  'frecuencia',
  'severidad',
  'duracionPromedio',
  'reincidencia',
  'costoEstimado',
]

// A well-formed IndicadorValor is either `{ suprimido: true }` or an object with numeric
// valor/numerador/denominador fields — see lib/indicators/formulas.ts. Checking only for key
// presence lets a malformed value under a present key through, which would then throw inside
// ResumenInteractivo's `'suprimido' in resultado` check.
function esIndicadorValor(valor: unknown): valor is IndicadorValor {
  if (typeof valor !== 'object' || valor === null) return false
  const registro = valor as Record<string, unknown>
  if ('suprimido' in registro) return registro.suprimido === true
  return (
    typeof registro.valor === 'number' &&
    typeof registro.numerador === 'number' &&
    typeof registro.denominador === 'number'
  )
}

function esIndicadorResultados(valor: unknown): valor is IndicadorResultados {
  if (typeof valor !== 'object' || valor === null) return false
  const registro = valor as Record<string, unknown>
  return INDICADOR_KEYS.every((clave) => clave in registro && esIndicadorValor(registro[clave]))
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

  const { data: personaRows } = await supabase
    .from('personas')
    .select('id, codigo, unidad_id, cargo_id, turno_id')
    .eq('empresa_id', empresaId)
  // Placeholder: assumes every active persona was contracted for the full 6-month period
  // (flat 180 days), instead of reading each person's real `contratos` row. Follow-up task
  // should join `contratos` to compute real active-days-in-period per persona.
  const personas = (personaRows ?? []).map((row) => ({
    id: row.id as string,
    codigo: row.codigo as string,
    contratoDias: 180,
    unidadId: row.unidad_id as string | null,
    cargoId: row.cargo_id as string | null,
    turnoId: row.turno_id as string | null,
  }))

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

  const { data: lineaBaseRows } = await supabase
    .from('lineas_base')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(1)
  const ultimaLineaBase = lineaBaseRows?.[0] ? mapLineaBaseRow(lineaBaseRows[0]) : null
  const indicadoresBaseCrudo = ultimaLineaBase?.indicadores
  const indicadoresBase = esIndicadorResultados(indicadoresBaseCrudo) ? indicadoresBaseCrudo : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Resumen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Período: {periodoInicio} a {periodoFin}
        </p>
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

      <ResumenInteractivo
        personas={personas}
        episodios={episodios}
        sucursales={sucursales}
        unidades={unidades}
        cargos={cargos}
        turnos={turnos}
        costos={COSTOS_DEFAULT}
        indicadoresBase={indicadoresBase}
        periodoInicio={periodoInicio}
        periodoFin={periodoFin}
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
      />

      <p className="text-xs text-muted-foreground">
        Rol: {rol.nombre}. Los costos usan supuestos por defecto (costo promedio diario
        ${COSTOS_DEFAULT.costoPromedioDiario.toLocaleString('es-CL')}); un panel de configuración de costos
        por empresa queda para un plan posterior.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 4: Run full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run`
Expected: all test files pass, including all tests from Tasks 1, 3, 4, 6

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/resumen/page.tsx components/platform/dashboard/ResumenInteractivo.tsx
git commit -m "feat: add sucursal/unidad/cargo/turno filters to the indicators dashboard"
```

---

### Task 8: Manual verification (controller-only)

This step cannot be delegated to an implementer subagent — it requires a real file upload and
a real browser walkthrough, same constraint as prior plans' final tasks. No schema migration
is needed for this plan (`unidad_id`/`cargo_id`/`turno_id` on `personas`, and `lineas_base`,
already exist in production).

- [ ] **Step 1: Full check suite**

```bash
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run
npm run build
```

Expected: all three pass clean.

- [ ] **Step 2: Real file walkthrough**

Using `/plataforma/importar`, upload a spreadsheet that includes Sucursal/Unidad/Cargo/Turno
columns (e.g. `_test-data/licencias-prueba-10-personas.xlsx`, which already has these columns
with real catalog-matching names) and confirm:
- The mapping step shows all 10 canonical fields, with the 4 new ones auto-suggested from the
  matching column headers.
- After executing, `/plataforma/resumen`'s filter dropdowns list real sucursales/unidades/
  cargos/turnos, and picking one narrows the 6 cards and the per-person table correctly.
- The per-person table only renders for an admin-role user, sorts by clicking a column
  header, and never displays a RUT.
- With any filter active, no card shows a "vs línea base" percentage, and "Guardar línea
  base" is not shown; clearing the filter brings both back.

- [ ] **Step 3: Record the outcome**

Append a `Progress Ledger` entry for this plan to `.superpowers/sdd/progress.md`, noting the
outcome of Step 2 and any deferred nits found during the walkthrough.
