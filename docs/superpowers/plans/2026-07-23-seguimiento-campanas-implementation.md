# Seguimiento (Campañas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a before/after measurement view for campaigns at `/plataforma/campanas/[id]`,
comparing an optional tracked survey question (average, before `fecha_inicio` vs after
`fecha_fin`) and security-event counts (always available), using data the platform already
collects.

**Architecture:** One new nullable column on `campanas` (`pregunta_seguimiento_id`), one new
pure function (`medirAntesDespues()` — genuinely new logic, unlike the last four modules
which only reused existing functions), two small edits to existing components
(`CampanaSheet.tsx` gains an optional question picker, `CampanasTable.tsx` gains a "Ver
seguimiento" link), and one new page that queries `campanas`/`encuesta_respuestas`/
`eventos_seguridad` and renders the comparison.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr` +
`@supabase/supabase-js` admin client), Tailwind v4, react-hook-form + zod (existing
`CampanaSheet` stack).

## Global Constraints

- **Schema change (the first since Calidad de Datos):** `campanas` gains one nullable column,
  `pregunta_seguimiento_id text`, no FK (same pattern as `encuestas.pregunta_ids text[]` — an
  app-validated catalog id, not a database reference). No other column, RLS policy, or grant
  on `campanas` changes.
- **Do not modify** `agregarRespuestas()`, `CATALOGO_PREGUNTAS`'s existing entries,
  `mapEncuestaRespuestaRow`, `mapEventoSeguridadRow`, `GestionarCampanaSheet.tsx`, or
  `EncuestasTable.tsx`/`EncuestaSheet.tsx` — this plan only adds to `CampanaSheet.tsx` and
  `CampanasTable.tsx`, and only reads (never writes) `encuesta_respuestas`/`eventos_seguridad`.
- **`medirAntesDespues()` boundary semantics (exact, not left ambiguous):** "antes" is
  `fecha < fechaInicio` (strict); "después" is `fecha > fechaFin` (strict). A value dated
  exactly on `fechaInicio` or exactly on `fechaFin` belongs to neither group (it falls
  "durante" the campaign) — this is a deliberate exclusion, not an oversight, and Task 2's
  tests must cover both boundary cases explicitly.
- **No time window cap.** "Antes" is everything before `fechaInicio`, "después" is everything
  after `fechaFin` (up to now) — no fixed lookback/lookahead window.
- **Small-group suppression (`MIN_GROUP_SIZE`) applies only to the survey-question
  comparison**, not to the security-event counts — same asymmetry already established between
  encuesta-derived aggregates (suppressed) and `eventos_seguridad` counts (shown raw, e.g. in
  `/plataforma/reportes`).
- **`CampanaSheet.tsx` stays create-only.** The new question picker is only settable at
  creation time in this phase — `GestionarCampanaSheet.tsx` (the existing edit/advance-state
  sheet) is not touched, and there is no way to change `pregunta_seguimiento_id` after a
  campaign is created.
- **The "Ver seguimiento" link goes inside `CampanasTable.tsx`'s existing `canEdit`-gated
  Acciones cell**, not a new always-visible column. This file (unlike `EncuestasTable.tsx`,
  which shows its actions cell to everyone and gates only the write button inside it) already
  hides its entire Acciones column from non-admins — this plan follows that file's own
  existing pattern rather than introducing a second, inconsistent gating style within the same
  component.
- **`/plataforma/campanas/[id]` has no Sidebar entry** — reached only via the "Ver
  seguimiento" link, same as `/plataforma/encuestas/[id]` has no Sidebar entry of its own.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required
  exact invocation on this machine (default heap OOMs).
- No unit test for the page, `CampanaSheet.tsx`, or `CampanasTable.tsx` — matches the
  established pattern (no `/plataforma/*` page or form/table component has a test file in
  this project). `medirAntesDespues()` is the exception — it is genuinely new logic and gets
  real unit tests (TDD), same standard already applied to `agregarRespuestas()`,
  `clasificarEpisodio()`, etc.

---

## File Structure

```
supabase/schema.sql                                   (MODIFY — add pregunta_seguimiento_id column)
lib/campanas/types.ts                                 (MODIFY — add field to Campana + mapCampanaRow)
lib/campanas/medicion.ts                              (CREATE — medirAntesDespues pure function)
lib/campanas/medicion.test.ts                         (CREATE — its tests)
components/platform/campanas/CampanaSheet.tsx         (MODIFY — optional question picker)
components/platform/campanas/CampanasTable.tsx        (MODIFY — "Ver seguimiento" link)
app/plataforma/campanas/[id]/page.tsx                 (CREATE — the before/after view)
```

---

### Task 1: Schema — columna `pregunta_seguimiento_id`

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `lib/campanas/types.ts`

**Interfaces:**
- Consumes: nothing from another task in this plan.
- Produces: `Campana.preguntaSeguimientoId: string | null` and the corresponding
  `mapCampanaRow` field, consumed by Tasks 3 and 4.

- [ ] **Step 1: Add the column to the `campanas` table definition**

In `supabase/schema.sql`, the `campanas` table currently ends with:

```sql
  participantes integer,
  resultado text,
  estado text not null default 'planificada' check (estado in ('planificada', 'activa', 'finalizada'))
);
```

Change it to:

```sql
  participantes integer,
  resultado text,
  pregunta_seguimiento_id text,
  estado text not null default 'planificada' check (estado in ('planificada', 'activa', 'finalizada'))
);
```

No RLS policy, grant, or any other part of the `campanas` block changes — this is the only
edit to that table's definition. (This edits `schema.sql`'s own "current desired state"
snapshot; applying the equivalent `ALTER TABLE` to the already-existing production table is a
separate controller-only step in Task 5, since production's table already exists and can't be
re-created from this `CREATE TABLE` statement.)

- [ ] **Step 2: Add the field to the `Campana` type and its mapper**

In `lib/campanas/types.ts`, the `Campana` type and `mapCampanaRow` currently look like:

```ts
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

Add `preguntaSeguimientoId: string | null` to the type (right after `resultado`) and
`pregunta_seguimiento_id: string | null` to the row parameter and the mapping (right after
`resultado`):

```ts
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
  preguntaSeguimientoId: string | null
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
  pregunta_seguimiento_id: string | null
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
    preguntaSeguimientoId: row.pregunta_seguimiento_id,
    estado: row.estado as EstadoCampana,
  }
}
```

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0. This project's Supabase clients (`lib/supabase/client.ts`,
`lib/supabase/server.ts`) are created without a `Database` generic, so `.insert()`/`.update()`
calls are not type-checked against real table columns — adding a column here does not, by
itself, produce any new tsc error anywhere else in the codebase. (`CampanaSheet.tsx`'s insert
call will still work at runtime without the new field too, since the column is nullable — Task
3 adds the field to that call for completeness, not because omitting it would break anything.)

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql lib/campanas/types.ts
git commit -m "feat: add pregunta_seguimiento_id column to campanas"
```

---

### Task 2: Función pura `medirAntesDespues()`

**Files:**
- Create: `lib/campanas/medicion.ts`
- Test: `lib/campanas/medicion.test.ts`

**Interfaces:**
- Consumes: `MIN_GROUP_SIZE` (`lib/indicators/formulas.ts`, value `5`).
- Produces: `medirAntesDespues()` and its return type `ResultadoMedicion`, consumed by Task 4's page.

This is TDD — write the failing tests first.

- [ ] **Step 1: Write the failing tests**

Create `lib/campanas/medicion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { medirAntesDespues } from './medicion'

describe('medirAntesDespues', () => {
  it('calcula el promedio correcto antes y después cuando hay suficientes valores en cada lado', () => {
    const valores = [
      { valor: 5, fecha: '2026-01-01' },
      { valor: 5, fecha: '2026-01-02' },
      { valor: 5, fecha: '2026-01-03' },
      { valor: 5, fecha: '2026-01-04' },
      { valor: 5, fecha: '2026-01-05' },
      { valor: 2, fecha: '2026-03-01' },
      { valor: 2, fecha: '2026-03-02' },
      { valor: 2, fecha: '2026-03-03' },
      { valor: 2, fecha: '2026-03-04' },
      { valor: 2, fecha: '2026-03-05' },
    ]
    const resultado = medirAntesDespues({ valores, fechaInicio: '2026-02-01', fechaFin: '2026-02-15' })
    expect(resultado.antes).toEqual({ promedio: 5, cantidad: 5 })
    expect(resultado.despues).toEqual({ promedio: 2, cantidad: 5 })
  })

  it('suprime un lado con menos de MIN_GROUP_SIZE valores', () => {
    const valores = [
      { valor: 5, fecha: '2026-01-01' },
      { valor: 5, fecha: '2026-01-02' },
    ]
    const resultado = medirAntesDespues({ valores, fechaInicio: '2026-02-01', fechaFin: '2026-02-15' })
    expect(resultado.antes).toEqual({ suprimido: true })
  })

  it('marca sinDatos cuando un lado tiene cero valores', () => {
    const resultado = medirAntesDespues({ valores: [], fechaInicio: '2026-02-01', fechaFin: '2026-02-15' })
    expect(resultado.antes).toEqual({ sinDatos: true })
    expect(resultado.despues).toEqual({ sinDatos: true })
  })

  it('devuelve despues: null cuando la campaña no tiene fecha de fin', () => {
    const valores = [{ valor: 5, fecha: '2026-01-01' }]
    const resultado = medirAntesDespues({ valores, fechaInicio: '2026-02-01', fechaFin: null })
    expect(resultado.despues).toBeNull()
  })

  it('excluye un valor fechado exactamente en fecha_inicio del grupo "antes"', () => {
    const valores = Array.from({ length: 5 }, () => ({ valor: 5, fecha: '2026-02-01' }))
    const resultado = medirAntesDespues({ valores, fechaInicio: '2026-02-01', fechaFin: '2026-02-15' })
    expect(resultado.antes).toEqual({ sinDatos: true })
  })

  it('excluye un valor fechado exactamente en fecha_fin del grupo "despues"', () => {
    const valores = Array.from({ length: 5 }, () => ({ valor: 5, fecha: '2026-02-15' }))
    const resultado = medirAntesDespues({ valores, fechaInicio: '2026-02-01', fechaFin: '2026-02-15' })
    expect(resultado.despues).toEqual({ sinDatos: true })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run lib/campanas/medicion.test.ts`
Expected: FAIL — `lib/campanas/medicion.ts` doesn't exist yet, so the import fails.

- [ ] **Step 3: Write the implementation**

Create `lib/campanas/medicion.ts`:

```ts
import { MIN_GROUP_SIZE } from '../indicators/formulas'

export type ResultadoMedicion = { promedio: number; cantidad: number } | { suprimido: true } | { sinDatos: true }

export function medirAntesDespues(input: {
  valores: Array<{ valor: number; fecha: string }>
  fechaInicio: string
  fechaFin: string | null
}): { antes: ResultadoMedicion; despues: ResultadoMedicion | null } {
  const antesValores = input.valores.filter((v) => v.fecha < input.fechaInicio).map((v) => v.valor)
  const antes = calcular(antesValores)

  if (!input.fechaFin) {
    return { antes, despues: null }
  }

  const fechaFin = input.fechaFin
  const despuesValores = input.valores.filter((v) => v.fecha > fechaFin).map((v) => v.valor)
  const despues = calcular(despuesValores)

  return { antes, despues }
}

function calcular(valores: number[]): ResultadoMedicion {
  if (valores.length === 0) return { sinDatos: true }
  if (valores.length < MIN_GROUP_SIZE) return { suprimido: true }
  const suma = valores.reduce((acc, v) => acc + v, 0)
  return { promedio: suma / valores.length, cantidad: valores.length }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run lib/campanas/medicion.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add lib/campanas/medicion.ts lib/campanas/medicion.test.ts
git commit -m "feat: add medirAntesDespues pure function"
```

---

### Task 3: `CampanaSheet.tsx` (selector de pregunta) + `CampanasTable.tsx` (link)

**Files:**
- Modify: `components/platform/campanas/CampanaSheet.tsx`
- Modify: `components/platform/campanas/CampanasTable.tsx`

**Interfaces:**
- Consumes: `CATALOGO_PREGUNTAS` (`lib/encuestas/catalogo.ts`, 9 existing entries, unmodified) —
  `{ id: string; texto: string }[]`. `Campana.preguntaSeguimientoId` (from Task 1).
- Produces: nothing new consumed by a later task — Task 4's page reads
  `campana.preguntaSeguimientoId` directly from the DB row, not from these components.

- [ ] **Step 1: Add the optional question picker to `CampanaSheet.tsx`**

In `components/platform/campanas/CampanaSheet.tsx`:

Add the import (with the other imports, near the top):

```ts
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
```

Change the zod schema from:

```ts
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
```

to:

```ts
const schema = z.strictObject({
  tipo: z.enum(TIPOS),
  nombre: z.string().min(1, 'Requerido'),
  fechaInicio: z.string().min(1, 'Requerido'),
  fechaFin: z.string(),
  responsable: z.string().min(1, 'Requerido'),
  proveedor: z.string(),
  costo: z.string(),
  participantes: z.string(),
  preguntaSeguimientoId: z.string(),
})
```

Add `preguntaSeguimientoId: ''` to `defaultValues` (alongside the other empty-string defaults).

Change the insert call from:

```ts
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
```

to:

```ts
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
        pregunta_seguimiento_id: values.preguntaSeguimientoId.trim() ? values.preguntaSeguimientoId : null,
      })
```

Add the new field's JSX directly after the "Tipo" field block (after its closing `</div>`, before the "Nombre" field block):

```tsx
          <div className="space-y-2">
            <Label htmlFor="preguntaSeguimiento">Pregunta de seguimiento (opcional)</Label>
            <Select
              value={form.watch('preguntaSeguimientoId') || '__ninguna__'}
              onValueChange={(v) => v !== null && form.setValue('preguntaSeguimientoId', v === '__ninguna__' ? '' : v)}
            >
              <SelectTrigger id="preguntaSeguimiento" className="w-full">
                <SelectValue>
                  {(valor: string) =>
                    valor === '__ninguna__' ? 'Ninguna' : (CATALOGO_PREGUNTAS.find((p) => p.id === valor)?.texto ?? valor)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ninguna__">Ninguna</SelectItem>
                {CATALOGO_PREGUNTAS.map((pregunta) => (
                  <SelectItem key={pregunta.id} value={pregunta.id}>
                    {pregunta.texto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
```

- [ ] **Step 2: Add the "Ver seguimiento" link to `CampanasTable.tsx`**

In `components/platform/campanas/CampanasTable.tsx`, add these imports (with the others):

```ts
import Link from 'next/link'
import { Button } from '@/components/ui/button'
```

Change the Acciones cell from:

```tsx
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
```

to:

```tsx
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <Link href={`/plataforma/campanas/${campana.id}`}>
                    <Button type="button" variant="outline" size="sm">
                      Ver seguimiento
                    </Button>
                  </Link>
                  <GestionarCampanaSheet
                    tenantId={tenantId}
                    actorId={actorId}
                    campana={campana}
                    onSaved={handleSaved}
                  />
                </TableCell>
              ) : null}
```

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 4: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests pass, including Task 2's new `medicion.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add components/platform/campanas/CampanaSheet.tsx components/platform/campanas/CampanasTable.tsx
git commit -m "feat: add seguimiento question picker and link to campanas UI"
```

---

### Task 4: Página `/plataforma/campanas/[id]`

**Files:**
- Create: `app/plataforma/campanas/[id]/page.tsx`

**Interfaces:**
- Consumes: `mapCampanaRow` (Task 1's updated version), `medirAntesDespues`/`ResultadoMedicion`
  (Task 2), `CATALOGO_PREGUNTAS` (`lib/encuestas/catalogo.ts`), `mapEncuestaRespuestaRow`
  (`lib/encuestas/types.ts`), `mapEventoSeguridadRow` (`lib/seguridad/types.ts`),
  `createAdminClient` (`lib/supabase/admin.ts`).
- Produces: nothing consumed by a later task — this is the last code task in this plan.

Real shapes this task depends on (for reference, do not redefine these — import them):

```ts
// lib/encuestas/types.ts
export type EncuestaRespuesta = { id: string; encuestaId: string; createdAt: string; respuestas: Record<string, number> }
export function mapEncuestaRespuestaRow(row: {
  id: string; encuesta_id: string; created_at: string; respuestas: Record<string, number>
}): EncuestaRespuesta

// lib/seguridad/types.ts
export type EventoSeguridad = {
  id: string; tenantId: string; empresaId: string; createdAt: string; creadaPor: string | null
  tipo: TipoEventoSeguridad; descripcion: string; gravedad: GravedadEvento; fecha: string
  sucursalId: string | null; unidadId: string | null; cargoId: string | null; turnoId: string | null
  estado: EstadoEvento; accionCorrectiva: string | null
}
export function mapEventoSeguridadRow(row: { ... }): EventoSeguridad  // fecha is the field to use, NOT createdAt
```

Database facts this task relies on (verified against `supabase/schema.sql`, no migration
needed beyond Task 1's column): `campanas` has RLS `campanas_select_same_tenant` (`for select
to authenticated using (tenant_id = auth_tenant_id())`) — a `.eq('id', id)` lookup can only
ever return a row belonging to the caller's own tenant, so every subsequent query scoped by
`campana.empresaId` is already bounded to that tenant. `encuestas` has
`encuestas_select_same_tenant` (regular client works). `encuesta_respuestas` has **no**
authenticated SELECT grant (only `insert`) — requires `createAdminClient()`, exactly like
`app/plataforma/bienestar/page.tsx`. `eventos_seguridad` has `eventos_seguridad_select_same_tenant`
and an authenticated SELECT grant — regular client works, no admin client needed for this part.

- [ ] **Step 1: Write the page**

Create `app/plataforma/campanas/[id]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapCampanaRow } from '@/lib/campanas/types'
import { mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
import { medirAntesDespues, type ResultadoMedicion } from '@/lib/campanas/medicion'

const TIPO_LABELS: Record<string, string> = {
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

const ESTADO_LABELS: Record<string, string> = {
  planificada: 'Planificada',
  activa: 'Activa',
  finalizada: 'Finalizada',
}

function renderResultadoMedicion(resultado: ResultadoMedicion | null): string {
  if (resultado === null) return 'La campaña todavía no tiene fecha de término'
  if ('sinDatos' in resultado) return 'Sin datos todavía'
  if ('suprimido' in resultado) return 'Grupo insuficiente para mostrar'
  return `${resultado.promedio.toFixed(1)} / 5 (${resultado.cantidad} respuestas)`
}

export default async function SeguimientoCampanaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const { data: campanaRow } = await supabase.from('campanas').select('*').eq('id', id).maybeSingle()
  if (!campanaRow) notFound()
  const campana = mapCampanaRow(campanaRow)

  let seguimientoEncuesta: { pregunta: string; antes: ResultadoMedicion; despues: ResultadoMedicion | null } | null =
    null

  if (campana.preguntaSeguimientoId) {
    const preguntaId = campana.preguntaSeguimientoId
    const { data: encuestaRows } = await supabase.from('encuestas').select('id').eq('empresa_id', campana.empresaId)
    const encuestaIds = (encuestaRows ?? []).map((row) => row.id as string)

    const admin = createAdminClient()
    const { data: respuestaRows } =
      encuestaIds.length > 0
        ? await admin.from('encuesta_respuestas').select('*').in('encuesta_id', encuestaIds)
        : { data: [] }
    const respuestas = (respuestaRows ?? []).map(mapEncuestaRespuestaRow)

    const valores = respuestas
      .filter((r) => typeof r.respuestas[preguntaId] === 'number')
      .map((r) => ({ valor: r.respuestas[preguntaId], fecha: r.createdAt }))

    const resultado = medirAntesDespues({ valores, fechaInicio: campana.fechaInicio, fechaFin: campana.fechaFin })
    const preguntaTexto = CATALOGO_PREGUNTAS.find((p) => p.id === preguntaId)?.texto ?? preguntaId

    seguimientoEncuesta = { pregunta: preguntaTexto, antes: resultado.antes, despues: resultado.despues }
  }

  const { data: eventoRows } = await supabase
    .from('eventos_seguridad')
    .select('*')
    .eq('empresa_id', campana.empresaId)
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)
  const eventosAntes = eventos.filter((e) => e.fecha < campana.fechaInicio).length
  const eventosDespues = campana.fechaFin
    ? eventos.filter((e) => e.fecha > campana.fechaFin!).length
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{campana.nombre}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {TIPO_LABELS[campana.tipo] ?? campana.tipo} — {ESTADO_LABELS[campana.estado] ?? campana.estado}
        </p>
        <p className="text-sm text-muted-foreground">
          {campana.fechaInicio} a {campana.fechaFin ?? 'sin fecha de término'} — Responsable: {campana.responsable}
        </p>
        {campana.participantes !== null ? (
          <p className="text-sm text-muted-foreground">Participantes: {campana.participantes}</p>
        ) : null}
        {campana.resultado ? <p className="mt-2 text-sm text-foreground">{campana.resultado}</p> : null}
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de encuesta</h2>
        {seguimientoEncuesta ? (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Antes — {seguimientoEncuesta.pregunta}</p>
              <p className="mt-1 text-foreground">{renderResultadoMedicion(seguimientoEncuesta.antes)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Después — {seguimientoEncuesta.pregunta}</p>
              <p className="mt-1 text-foreground">{renderResultadoMedicion(seguimientoEncuesta.despues)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Esta campaña no tiene una pregunta de seguimiento configurada.
          </p>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de seguridad</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos antes</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{eventosAntes}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos después</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
              {eventosDespues === null ? 'La campaña todavía no tiene fecha de término' : eventosDespues}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Note: `usuarioRow` is fetched with `.select('id')` only and never mapped, matching the same
deliberate pattern already used in `app/plataforma/bienestar/page.tsx` and
`app/plataforma/ausencias/page.tsx`.

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass, including Task 2's tests.

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, and the route list printed at the end includes
`/plataforma/campanas/[id]`. A full logged-in visual check is out of scope for this step (same
gap already documented for every prior read-only-page module in this roadmap — no live
Supabase credentials in this worktree/checkout); Task 5 covers that against the real deployed
environment.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/campanas/[id]/page.tsx
git commit -m "feat: add campana seguimiento page"
```

---

### Task 5: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user)
to run against the deployed/production environment after Tasks 1-4 are merged and deployed.
**Unlike Reportes, Bienestar Preventivo, Ausencias y Licencias, and Calidad de Datos, this
module DOES have a schema change** — Step 1 below is not optional.

- [ ] **Step 1: Apply the schema change to production Supabase**

Run this exact SQL against the production Supabase project (via the SQL Editor or equivalent):

```sql
alter table campanas add column pregunta_seguimiento_id text;
```

Verify via `information_schema.columns` (or the table editor) that `campanas` now has the new
nullable `pregunta_seguimiento_id` column, and that no existing row's other columns were
affected (existing campaigns simply get `null` for the new column).

- [ ] **Step 2: Verify the question picker and link work end-to-end**

Log in to production as an admin. Go to `/plataforma/campanas`. Create a new campaign,
selecting a real question from "Pregunta de seguimiento" (not "Ninguna"). Confirm "Ver
seguimiento" appears for it, and clicking it opens `/plataforma/campanas/[id]` showing the
campaign's header info correctly.

- [ ] **Step 3: Verify the before/after comparison against real data**

For a campaign with `pregunta_seguimiento_id` set and with real `encuesta_respuestas` in
Supabase both before its `fecha_inicio` and after its `fecha_fin` (create test responses via
the public survey link if needed), confirm the "Antes"/"Después" averages shown match a manual
calculation over those rows. For a campaign without `fecha_fin` set, confirm "Después" shows
"La campaña todavía no tiene fecha de término" instead of a number. For a campaign with no
`pregunta_seguimiento_id`, confirm the page shows "Esta campaña no tiene una pregunta de
seguimiento configurada" instead of the comparison cards.

- [ ] **Step 4: Verify the security-event counts**

Confirm "Eventos antes"/"Eventos después" match a manual count of `eventos_seguridad` rows
(by their `fecha` column) before/after the same campaign's dates.

- [ ] **Step 5: Confirm no other page's behavior changed**

Navigate to `/plataforma/encuestas` and `/plataforma/encuestas/[id]` for an existing survey,
and confirm both render exactly as before — this plan never touched
`EncuestasTable.tsx`/`EncuestaSheet.tsx`/that results page. Confirm `GestionarCampanaSheet`
(advance state / edit resultado) still works exactly as before on an existing campaign.

- [ ] **Step 6: Report results to the user**

Summarize: schema applied ✅/❌, question picker + link work ✅/❌, before/after comparison
correct against real data ✅/❌, security-event counts correct ✅/❌, no regression on
encuestas/campañas management ✅/❌. Ask the user which module from
`referencia/instrucciones2.txt` to tackle next (Intervenciones' equivalent seguimiento,
Reportes' remaining 6 report types, or Integraciones remain as options).

---

## Self-Review Notes

- **Spec coverage:** columna nueva + tipo actualizado ✅ (Task 1), `medirAntesDespues()` con
  supresión y semántica de límites exacta (estrictos, ambos lados) + pruebas de límite ✅
  (Task 2), selector opcional en creación + link de navegación ✅ (Task 3), página con
  encabezado/seguimiento de encuesta/seguimiento de seguridad/mensajes de "sin fecha de
  término" ✅ (Task 4), aplicación de schema a producción explícita ✅ (Task 5).
  Explícitamente-fuera-de-alcance del spec (Intervenciones, ventana de tiempo configurable,
  múltiples preguntas, edición de `pregunta_seguimiento_id` post-creación, alertas
  automáticas, motor de recomendaciones) no se implementa en ninguna tarea, coincide con el
  spec.
- **Placeholder scan:** sin TBD/TODO; cada paso tiene código completo.
- **Type consistency:** `Campana.preguntaSeguimientoId` (Task 1) se consume idénticamente en
  Task 3 (`CampanaSheet`'s insert) y Task 4 (la página). `ResultadoMedicion` (Task 2) se
  consume idénticamente en Task 4 (`renderResultadoMedicion`, los dos usos en
  `seguimientoEncuesta.antes`/`.despues`). `EncuestaRespuesta`/`EventoSeguridad` y sus mappers
  se usan según sus firmas reales verificadas directamente en `lib/encuestas/types.ts` y
  `lib/seguridad/types.ts`. No se introduce ningún tipo nuevo que pueda desviarse entre
  tareas.
