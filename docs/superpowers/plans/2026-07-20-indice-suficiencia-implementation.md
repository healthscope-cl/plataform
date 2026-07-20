# Índice de Suficiencia de Datos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute a data-sufficiency index from data the dashboard already has, and show a
banner explaining when the six indicators shouldn't be trusted at face value — per
`docs/superpowers/specs/2026-07-20-indice-suficiencia-design.md`.

**Architecture:** Same stack as the rest of the platform — Next.js 16 (App Router) + Supabase.
A pure function (same family as `computeIndicadores`/`evaluarReglas`) computes the index from
`personas`/`episodios` the Server Component already fetches, plus one small new query (has a
recent completed import). No new table, no persistence — recomputed live on every dashboard
load, same as everything else on this page.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + Vitest.

## Global Constraints

- **No AI/ML.** The index is arithmetic thresholds over counts — same hard requirement as the
  rest of this project.
- **Thresholds are named, exported constants, explicitly commented as adjustable placeholders**
  — same pattern as `MIN_GROUP_SIZE` in `lib/indicators/formulas.ts`. Do not bury the numbers
  inline in conditionals.
- **`estado: 'solido'` always means empty `razones`/`recomendaciones`**, and the banner renders
  nothing at all in that case — a healthy dataset gets no nagging.
- **Only three dimensions (dotación, episodios, completitud organizacional) determine the
  `estado` tier.** Cobertura temporal (`huboImportacionReciente`) never changes the tier by
  itself — it only ever contributes a `razon`/`recomendacion` when the tier is already below
  `solido` from the other three dimensions. Do not add it to the tier gating logic.
- **`IndicadorCard` is not modified in this plan.** The "interpret with caution" message lives
  once in the banner, not repeated per card — this was a deliberate scope decision in the spec,
  not an oversight.
- Every table query filters by `empresa_id` (or `tenant_id` where that's the only scoping
  column available, as with `importaciones` — see Task 2) — same tenant-isolation convention as
  every existing query in this project.
- This machine OOMs `tsc`/`vitest` at default heap size — run every verification as
  `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` /
  `... vitest run <path>` (small heap, local binary, not npx).

## File Structure

```
lib/
  suficiencia/
    calcular.ts                         (CREATE — calcularIndiceSuficiencia + thresholds)
    calcular.test.ts                    (CREATE)
components/
  platform/
    dashboard/
      SuficienciaBanner.tsx             (CREATE)
app/
  plataforma/
    resumen/
      page.tsx                         (MODIFY — fetch signal, compute index, render banner)
```

---

### Task 1: Sufficiency index — pure function

**Files:**
- Create: `lib/suficiencia/calcular.ts`
- Test: `lib/suficiencia/calcular.test.ts`

**Interfaces:**
- Produces: `EstadoSuficiencia` type, `IndiceSuficiencia` type (`{ estado, razones: string[],
  recomendaciones: string[] }`), and `calcularIndiceSuficiencia()`. Task 2's
  `SuficienciaBanner` and `app/plataforma/resumen/page.tsx` both consume these.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/suficiencia/calcular.test.ts
import { describe, expect, it } from 'vitest'
import { calcularIndiceSuficiencia } from './calcular'

function personas(n: number, completas = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    unidadId: i < completas ? 'u1' : null,
    cargoId: i < completas ? 'c1' : null,
    turnoId: i < completas ? 't1' : null,
  }))
}

describe('calcularIndiceSuficiencia', () => {
  it('estado solido cuando se superan los tres umbrales, sin razones ni recomendaciones', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(30, 25),
      cantidadEpisodios: 20,
      huboImportacionReciente: true,
    })
    expect(resultado.estado).toBe('solido')
    expect(resultado.razones).toEqual([])
    expect(resultado.recomendaciones).toEqual([])
  })

  it('estado utilizable cuando hay suficiente dotacion y episodios pero no llega a solido', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(10),
      cantidadEpisodios: 5,
      huboImportacionReciente: true,
    })
    expect(resultado.estado).toBe('utilizable')
    expect(resultado.razones.length).toBeGreaterThan(0)
  })

  it('estado limitado cuando hay pocas personas pero al menos un episodio', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(3),
      cantidadEpisodios: 1,
      huboImportacionReciente: true,
    })
    expect(resultado.estado).toBe('limitado')
  })

  it('estado limitado cuando hay al menos 5 personas aunque no haya episodios', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(5),
      cantidadEpisodios: 0,
      huboImportacionReciente: true,
    })
    expect(resultado.estado).toBe('limitado')
  })

  it('estado insuficiente cuando hay menos de 5 personas y cero episodios', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(2),
      cantidadEpisodios: 0,
      huboImportacionReciente: false,
    })
    expect(resultado.estado).toBe('insuficiente')
    expect(resultado.razones.length).toBeGreaterThan(0)
    expect(resultado.recomendaciones.length).toBeGreaterThan(0)
  })

  it('incluye una razon de completitud organizacional cuando menos del 70% tiene unidad/cargo/turno', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(30, 10),
      cantidadEpisodios: 20,
      huboImportacionReciente: true,
    })
    expect(resultado.estado).not.toBe('solido')
    expect(resultado.razones.some((r) => r.includes('unidad, cargo y turno'))).toBe(true)
  })

  it('incluye una razon de cobertura temporal cuando no hay importacion reciente, sin afectar el estado', () => {
    const resultado = calcularIndiceSuficiencia({
      personas: personas(10),
      cantidadEpisodios: 5,
      huboImportacionReciente: false,
    })
    expect(resultado.estado).toBe('utilizable')
    expect(resultado.razones.some((r) => r.includes('importación completada'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/suficiencia/calcular.test.ts`
Expected: FAIL with "Cannot find module './calcular'"

- [ ] **Step 3: Write `lib/suficiencia/calcular.ts`**

```typescript
// Placeholder thresholds — a reasonable starting point, not a validated business decision.
// Named and exported so they're easy to find and adjust without touching the logic below,
// same pattern as MIN_GROUP_SIZE in lib/indicators/formulas.ts.
export const UMBRAL_SOLIDO = { personasMin: 30, episodiosMin: 20, completitudMin: 0.7 }
export const UMBRAL_UTILIZABLE = { personasMin: 10, episodiosMin: 5 }
export const UMBRAL_LIMITADO = { personasMin: 5, episodiosMin: 1 }

export type EstadoSuficiencia = 'insuficiente' | 'limitado' | 'utilizable' | 'solido'

export type IndiceSuficiencia = {
  estado: EstadoSuficiencia
  razones: string[]
  recomendaciones: string[]
}

export function calcularIndiceSuficiencia(input: {
  personas: Array<{ id: string; unidadId: string | null; cargoId: string | null; turnoId: string | null }>
  cantidadEpisodios: number
  huboImportacionReciente: boolean
}): IndiceSuficiencia {
  const dotacion = input.personas.length
  const personasCompletas = input.personas.filter((p) => p.unidadId && p.cargoId && p.turnoId).length
  const completitud = dotacion > 0 ? personasCompletas / dotacion : 0

  let estado: EstadoSuficiencia
  if (
    dotacion >= UMBRAL_SOLIDO.personasMin &&
    input.cantidadEpisodios >= UMBRAL_SOLIDO.episodiosMin &&
    completitud >= UMBRAL_SOLIDO.completitudMin
  ) {
    estado = 'solido'
  } else if (dotacion >= UMBRAL_UTILIZABLE.personasMin && input.cantidadEpisodios >= UMBRAL_UTILIZABLE.episodiosMin) {
    estado = 'utilizable'
  } else if (dotacion >= UMBRAL_LIMITADO.personasMin || input.cantidadEpisodios >= UMBRAL_LIMITADO.episodiosMin) {
    estado = 'limitado'
  } else {
    estado = 'insuficiente'
  }

  if (estado === 'solido') {
    return { estado, razones: [], recomendaciones: [] }
  }

  const razones: string[] = []
  const recomendaciones: string[] = []

  if (dotacion < UMBRAL_SOLIDO.personasMin) {
    const plural = dotacion === 1 ? '' : 's'
    razones.push(`Solo ${dotacion} persona${plural} activa${plural} registrada${plural}.`)
    recomendaciones.push('Importa datos de más personas para ampliar la muestra.')
  }
  if (input.cantidadEpisodios < UMBRAL_SOLIDO.episodiosMin) {
    const plural = input.cantidadEpisodios === 1 ? '' : 's'
    razones.push(`Solo ${input.cantidadEpisodios} episodio${plural} registrado${plural} en el período.`)
  }
  if (completitud < UMBRAL_SOLIDO.completitudMin) {
    razones.push(`Solo ${Math.round(completitud * 100)}% de las personas tiene unidad, cargo y turno asignados.`)
    recomendaciones.push('Completa la asignación de unidad/cargo/turno al reimportar o editar personas.')
  }
  if (!input.huboImportacionReciente) {
    razones.push('No hay una importación completada que cubra el período actual.')
    recomendaciones.push('Sube una importación reciente para reflejar el período vigente.')
  }

  return { estado, razones, recomendaciones }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/suficiencia/calcular.test.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add lib/suficiencia/calcular.ts lib/suficiencia/calcular.test.ts
git commit -m "feat: add data-sufficiency index calculation"
```

---

### Task 2: Banner + dashboard wiring

**Files:**
- Create: `components/platform/dashboard/SuficienciaBanner.tsx`
- Modify: `app/plataforma/resumen/page.tsx`

**Interfaces:**
- Consumes: `calcularIndiceSuficiencia`, `IndiceSuficiencia`, `EstadoSuficiencia` (Task 1).
- Produces: the finished feature. No later task in this plan depends on this one.

- [ ] **Step 1: Create `components/platform/dashboard/SuficienciaBanner.tsx`**

```tsx
import type { EstadoSuficiencia, IndiceSuficiencia } from '@/lib/suficiencia/calcular'

const ETIQUETAS: Record<EstadoSuficiencia, string> = {
  insuficiente: 'Datos insuficientes',
  limitado: 'Datos limitados',
  utilizable: 'Datos utilizables',
  solido: 'Datos sólidos',
}

export function SuficienciaBanner({ indice }: { indice: IndiceSuficiencia }) {
  if (indice.estado === 'solido') return null

  const precaucion = indice.estado === 'insuficiente' || indice.estado === 'limitado'

  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4">
      <p className="text-sm font-semibold text-foreground">{ETIQUETAS[indice.estado]}</p>
      {indice.razones.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {indice.razones.map((razon) => (
            <li key={razon}>{razon}</li>
          ))}
        </ul>
      ) : null}
      {indice.recomendaciones.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          {indice.recomendaciones.map((recomendacion) => (
            <li key={recomendacion}>→ {recomendacion}</li>
          ))}
        </ul>
      ) : null}
      {precaucion ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Los indicadores de abajo deben interpretarse con precaución dado el tamaño de la muestra.
        </p>
      ) : null}
    </div>
  )
}
```

(Using each string itself as the `key` is safe here — `razones`/`recomendaciones` are short,
non-repeating, freshly-built arrays with no stable id of their own, and this component never
reorders or mutates them in place.)

- [ ] **Step 2: Modify `app/plataforma/resumen/page.tsx`**

Add one import, right after the existing `import { ResumenInteractivo } ...` line:

```typescript
import { calcularIndiceSuficiencia } from '@/lib/suficiencia/calcular'
import { SuficienciaBanner } from '@/components/platform/dashboard/SuficienciaBanner'
```

Right after the existing `const episodios = (episodioRows ?? []).map(...)` block (before the
`sucursales` fetch that follows it), add the recent-import check and the index computation:

```typescript
  const { data: importacionReciente } = await supabase
    .from('importaciones')
    .select('id')
    .eq('tenant_id', usuario.tenantId)
    .eq('estado', 'completada')
    .gte('created_at', periodoInicio)
    .limit(1)
  const huboImportacionReciente = (importacionReciente ?? []).length > 0

  const indiceSuficiencia = calcularIndiceSuficiencia({
    personas,
    cantidadEpisodios: episodios.length,
    huboImportacionReciente,
  })
```

`importaciones` has no `empresa_id` column (only `tenant_id` — see `lib/ingestion/types.ts`),
so this check is tenant-scoped rather than empresa-scoped; that is the most precise signal this
table's schema allows, consistent with how the rest of the ingestion feature already treats
`importaciones`.

In the JSX, add `<SuficienciaBanner indice={indiceSuficiencia} />` as the first child inside
the outer `<div className="space-y-6">`, before the `<div>` that currently holds the
`<h1>Resumen</h1>`:

```tsx
  return (
    <div className="space-y-6">
      <SuficienciaBanner indice={indiceSuficiencia} />
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Resumen</h1>
```

(Everything else in the file stays exactly as it is — this task only adds the one query block,
the index computation, and the one banner line.)

- [ ] **Step 3: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 4: Run full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run`
Expected: all test files pass, including Task 1's `lib/suficiencia/calcular.test.ts`

- [ ] **Step 5: Commit**

```bash
git add components/platform/dashboard/SuficienciaBanner.tsx app/plataforma/resumen/page.tsx
git commit -m "feat: show data-sufficiency banner on the indicators dashboard"
```

---

### Task 3: Manual verification (controller-only)

No schema change in this plan — nothing to apply to the live Supabase project. This step
still can't be delegated to an implementer subagent, because it requires a real browser
walkthrough with real data shapes (an empty tenant, a small tenant, and a well-populated one)
that only exist in production.

- [ ] **Step 1: Full check suite**

```bash
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run
npm run build
```

Expected: all three pass clean.

- [ ] **Step 2: Browser walkthrough**

On `/plataforma/resumen` with the current production data: confirm the banner's estado and
razones/recomendaciones match what the actual dotación/episodios/completitud numbers would
predict (cross-check by hand against the Organización and Importar/Historial pages). If the
current tenant is already at `solido`, temporarily reason about a smaller tenant/empresa (or,
if one exists, switch to it) to confirm the banner actually renders and reads sensibly for a
non-`solido` case — don't ship this task considering it verified only against a state where
the banner never shows.

- [ ] **Step 3: Record the outcome**

Append a `Progress Ledger` entry for this plan to `.superpowers/sdd/progress.md`.
