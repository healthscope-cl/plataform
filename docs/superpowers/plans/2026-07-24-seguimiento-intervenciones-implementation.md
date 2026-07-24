# Seguimiento (Intervenciones) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a before/after measurement view for interventions at
`/plataforma/intervenciones/[id]`, mirroring the Seguimiento de Campañas module exactly, but
adapted to `intervenciones`' single `fecha` column (no `fecha_inicio`/`fecha_fin`).

**Architecture:** One new nullable column on `intervenciones` (`pregunta_seguimiento_id`,
same pattern as `campanas.pregunta_seguimiento_id`), no new pure function — `medirAntesDespues()`
(`lib/campanas/medicion.ts`) is reused completely unmodified, called with
`fechaInicio: intervencion.fecha` and `fechaFin: intervencion.fecha` (the same value in both
parameters), which correctly yields "antes de la fecha" / "después de la fecha" given the
function's strict `<`/`>` boundaries. Two small edits to existing components
(`IntervencionSheet.tsx` gains an optional question picker, `IntervencionesTable.tsx` gains a
"Ver seguimiento" link), and one new page.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr` +
`@supabase/supabase-js` admin client), Tailwind v4, react-hook-form + zod (existing
`IntervencionSheet` stack).

## Global Constraints

- **Schema change:** `intervenciones` gains one nullable column,
  `pregunta_seguimiento_id text`, no FK (same pattern as `campanas.pregunta_seguimiento_id`
  and `encuestas.pregunta_ids`). No other column, RLS policy, or grant on `intervenciones`
  changes.
- **Do not modify** `medirAntesDespues()` (`lib/campanas/medicion.ts`) — it is reused exactly
  as it exists, imported from its existing location (`lib/campanas/`) even though this plan
  lives in `lib/intervenciones/`/`app/plataforma/intervenciones/` — it is generic over "values
  with a date and a boundary," nothing campaign-specific. Do not modify
  `CATALOGO_PREGUNTAS`'s existing entries, `mapEncuestaRespuestaRow`, `mapEventoSeguridadRow`,
  `GestionarIntervencionSheet.tsx`.
- **`intervencion.fecha` is a single, non-nullable date** (`fecha date not null` in schema,
  typed `string` in `Intervencion`, never `string | null`). Calling `medirAntesDespues({
  ..., fechaInicio: intervencion.fecha, fechaFin: intervencion.fecha })` means "antes" is
  strictly before that date and "después" is strictly after it. Because `fechaFin` is always a
  real string here (never actually `null` at runtime), `despues` will never actually be
  `null` either — but the **type** of `medirAntesDespues`'s return is still `despues:
  ResultadoMedicion | null` regardless of what's passed in (TypeScript does not narrow a
  function's declared return type based on the literal value of a call-site argument), so the
  page's rendering code must still handle that type-level case. This is a real,
  type-required branch that will never execute at runtime for this page — Task 3 documents
  this explicitly so a reviewer doesn't mistake it for a real gap.
- **`IntervencionSheet.tsx` stays create-only.** The new question picker is only settable at
  creation time — `GestionarIntervencionSheet.tsx` (the existing edit/advance-state sheet) is
  not touched, and there is no way to change `pregunta_seguimiento_id` after an intervention is
  created.
- **The "Ver seguimiento" link goes inside `IntervencionesTable.tsx`'s existing
  `canEdit`-gated Acciones cell**, not a new always-visible column — mirrors exactly how
  `CampanasTable.tsx` was changed in the Seguimiento de Campañas module (that file, like this
  one, already hides its entire Acciones column from non-admins).
- **`/plataforma/intervenciones/[id]` needs no server-side role gate of its own** — unlike the
  Reportes module (where a real authorization gap was found because the parent menu was
  `adminOnly: false`), `/plataforma/intervenciones` is already `adminOnly: true` in the
  Sidebar, and this new page has no other entry point. Same reasoning already applies to
  `/plataforma/campanas/[id]`, which also has no page-level role check.
- **No Sidebar change** — this page has no nav entry of its own, reached only via the "Ver
  seguimiento" link.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required
  exact invocation on this machine (default heap OOMs).
- No unit test for the page, `IntervencionSheet.tsx`, or `IntervencionesTable.tsx` — matches
  the established pattern. No new pure function means no new test file at all in this plan
  (`medirAntesDespues()` already has its own tests from the Campañas module).

---

## File Structure

```
supabase/schema.sql                                          (MODIFY — add pregunta_seguimiento_id column)
lib/intervenciones/types.ts                                  (MODIFY — add field to Intervencion + mapIntervencionRow)
components/platform/intervenciones/IntervencionSheet.tsx     (MODIFY — optional question picker)
components/platform/intervenciones/IntervencionesTable.tsx   (MODIFY — "Ver seguimiento" link)
app/plataforma/intervenciones/[id]/page.tsx                   (CREATE — the before/after view)
```

---

### Task 1: Schema — columna `pregunta_seguimiento_id`

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `lib/intervenciones/types.ts`

**Interfaces:**
- Consumes: nothing from another task in this plan.
- Produces: `Intervencion.preguntaSeguimientoId: string | null` and the corresponding
  `mapIntervencionRow` field, consumed by Tasks 2 and 3.

- [ ] **Step 1: Add the column to the `intervenciones` table definition**

In `supabase/schema.sql`, the `intervenciones` table currently ends with:

```sql
  indicadores text not null,
  resultado text,
  estado text not null default 'planificada' check (estado in ('planificada', 'en_ejecucion', 'completada'))
);
```

Change it to:

```sql
  indicadores text not null,
  resultado text,
  pregunta_seguimiento_id text,
  estado text not null default 'planificada' check (estado in ('planificada', 'en_ejecucion', 'completada'))
);
```

No RLS policy, grant, or any other part of the `intervenciones` block changes — this is the
only edit to that table's definition. This project's Supabase clients are created without a
`Database` generic (verified in the Seguimiento de Campañas module), so this change does not,
by itself, cause any tsc error elsewhere.

- [ ] **Step 2: Add the field to the `Intervencion` type and its mapper**

In `lib/intervenciones/types.ts`, the `Intervencion` type and `mapIntervencionRow` currently
look like:

```ts
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

Add `preguntaSeguimientoId: string | null` to the type (right after `resultado`) and
`pregunta_seguimiento_id: string | null` to the row parameter and the mapping (right after
`resultado`):

```ts
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
  preguntaSeguimientoId: string | null
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
  pregunta_seguimiento_id: string | null
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
    preguntaSeguimientoId: row.pregunta_seguimiento_id,
    estado: row.estado as EstadoIntervencion,
  }
}
```

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql lib/intervenciones/types.ts
git commit -m "feat: add pregunta_seguimiento_id column to intervenciones"
```

---

### Task 2: `IntervencionSheet.tsx` (selector de pregunta) + `IntervencionesTable.tsx` (link)

**Files:**
- Modify: `components/platform/intervenciones/IntervencionSheet.tsx`
- Modify: `components/platform/intervenciones/IntervencionesTable.tsx`

**Interfaces:**
- Consumes: `CATALOGO_PREGUNTAS` (`lib/encuestas/catalogo.ts`, 9 existing entries,
  unmodified) — `{ id: string; texto: string }[]`. `Intervencion.preguntaSeguimientoId`
  (from Task 1).
- Produces: nothing new consumed by a later task — Task 3's page reads
  `intervencion.preguntaSeguimientoId` directly from the DB row, not from these components.

- [ ] **Step 1: Add the optional question picker to `IntervencionSheet.tsx`**

In `components/platform/intervenciones/IntervencionSheet.tsx`:

Add these imports (alongside the existing ones):

```ts
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
```

Change the zod schema from:

```ts
const schema = z.strictObject({
  problema: z.string().min(1, 'Requerido'),
  objetivo: z.string().min(1, 'Requerido'),
  responsable: z.string().min(1, 'Requerido'),
  presupuesto: z.string(),
  fecha: z.string().min(1, 'Requerido'),
  indicadores: z.string().min(1, 'Requerido'),
})
```

to:

```ts
const schema = z.strictObject({
  problema: z.string().min(1, 'Requerido'),
  objetivo: z.string().min(1, 'Requerido'),
  responsable: z.string().min(1, 'Requerido'),
  presupuesto: z.string(),
  fecha: z.string().min(1, 'Requerido'),
  indicadores: z.string().min(1, 'Requerido'),
  preguntaSeguimientoId: z.string(),
})
```

Add `preguntaSeguimientoId: ''` to `defaultValues` (alongside the other defaults).

Change the insert call from:

```ts
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
```

to:

```ts
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
        pregunta_seguimiento_id: values.preguntaSeguimientoId.trim() ? values.preguntaSeguimientoId : null,
      })
```

Add the new field's JSX directly after the "Fecha"/"Indicadores a medir" grid block (after its
closing `</div>`, before the submit `Button`):

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

Note: the `onValueChange={(v) => v !== null && ...}` guard (explicit null check, not a
truthiness check) is required — a sibling module (Ausencias y Licencias) found that a
truthiness-check version of this exact pattern has a latent bug (an empty-string value would
silently no-op). Use `!== null` here from the start.

- [ ] **Step 2: Add the "Ver seguimiento" link to `IntervencionesTable.tsx`**

In `components/platform/intervenciones/IntervencionesTable.tsx`, add these imports (with the
others):

```ts
import Link from 'next/link'
import { Button } from '@/components/ui/button'
```

Change the Acciones cell from:

```tsx
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
```

to:

```tsx
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <Link href={`/plataforma/intervenciones/${intervencion.id}`}>
                    <Button type="button" variant="outline" size="sm">
                      Ver seguimiento
                    </Button>
                  </Link>
                  <GestionarIntervencionSheet
                    tenantId={tenantId}
                    actorId={actorId}
                    intervencion={intervencion}
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
Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/platform/intervenciones/IntervencionSheet.tsx components/platform/intervenciones/IntervencionesTable.tsx
git commit -m "feat: add seguimiento question picker and link to intervenciones UI"
```

---

### Task 3: Página `/plataforma/intervenciones/[id]`

**Files:**
- Create: `app/plataforma/intervenciones/[id]/page.tsx`

**Interfaces:**
- Consumes: `mapIntervencionRow` (Task 1's updated version), `medirAntesDespues`/`ResultadoMedicion`
  (`lib/campanas/medicion.ts` — real signature: `medirAntesDespues(input: { valores:
  Array<{ valor: number; fecha: string }>; fechaInicio: string; fechaFin: string | null })`
  returning `{ antes: ResultadoMedicion; despues: ResultadoMedicion | null }`, where
  `ResultadoMedicion = { promedio: number; cantidad: number } | { suprimido: true } | { sinDatos: true }`),
  `CATALOGO_PREGUNTAS` (`lib/encuestas/catalogo.ts`), `mapEncuestaRespuestaRow`
  (`lib/encuestas/types.ts`), `mapEventoSeguridadRow` (`lib/seguridad/types.ts`),
  `createAdminClient` (`lib/supabase/admin.ts`).
- Produces: nothing consumed by a later task — this is the last code task in this plan.

Database facts this task relies on (verified against `supabase/schema.sql`, no migration
needed beyond Task 1's column): `intervenciones` has RLS policy
`intervenciones_select_same_tenant` (`for select to authenticated using (tenant_id =
auth_tenant_id())`) — a `.eq('id', id)` lookup can only ever return a row belonging to the
caller's own tenant, so every subsequent query scoped by `intervencion.empresaId` is already
bounded to that tenant. `encuestas` has `encuestas_select_same_tenant` (regular client works).
`encuesta_respuestas` has **no** authenticated SELECT grant (only `insert`) — requires
`createAdminClient()`, exactly like `app/plataforma/campanas/[id]/page.tsx` and
`app/plataforma/reportes/campanas/page.tsx`. `eventos_seguridad` has
`eventos_seguridad_select_same_tenant` and an authenticated SELECT grant — regular client
works, no admin client needed for this part.

- [ ] **Step 1: Write the page**

Create `app/plataforma/intervenciones/[id]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapIntervencionRow } from '@/lib/intervenciones/types'
import { mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
import { medirAntesDespues, type ResultadoMedicion } from '@/lib/campanas/medicion'

const ESTADO_LABELS: Record<string, string> = {
  planificada: 'Planificada',
  en_ejecucion: 'En ejecución',
  completada: 'Completada',
}

// `despues` is typed `ResultadoMedicion | null` by medirAntesDespues's declared return type,
// but for this page it can never actually be null at runtime: intervencion.fecha is always a
// real date (never null), so the fechaFin argument is never null either. This branch exists
// only to satisfy TypeScript, not because it can execute here.
function renderResultadoMedicion(resultado: ResultadoMedicion | null): string {
  if (resultado === null) return 'No aplica'
  if ('sinDatos' in resultado) return 'Sin datos todavía'
  if ('suprimido' in resultado) return 'Grupo insuficiente para mostrar'
  return `${resultado.promedio.toFixed(1)} / 5 (${resultado.cantidad} respuestas)`
}

export default async function SeguimientoIntervencionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const { data: intervencionRow } = await supabase.from('intervenciones').select('*').eq('id', id).maybeSingle()
  if (!intervencionRow) notFound()
  const intervencion = mapIntervencionRow(intervencionRow)

  let seguimientoEncuesta: { pregunta: string; antes: ResultadoMedicion; despues: ResultadoMedicion | null } | null =
    null

  if (intervencion.preguntaSeguimientoId) {
    const preguntaId = intervencion.preguntaSeguimientoId
    const { data: encuestaRows } = await supabase
      .from('encuestas')
      .select('id')
      .eq('empresa_id', intervencion.empresaId)
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

    const resultado = medirAntesDespues({ valores, fechaInicio: intervencion.fecha, fechaFin: intervencion.fecha })
    const preguntaTexto = CATALOGO_PREGUNTAS.find((p) => p.id === preguntaId)?.texto ?? preguntaId

    seguimientoEncuesta = { pregunta: preguntaTexto, antes: resultado.antes, despues: resultado.despues }
  }

  const { data: eventoRows } = await supabase
    .from('eventos_seguridad')
    .select('*')
    .eq('empresa_id', intervencion.empresaId)
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)
  const eventosAntes = eventos.filter((e) => e.fecha < intervencion.fecha).length
  const eventosDespues = eventos.filter((e) => e.fecha > intervencion.fecha).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{intervencion.problema}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ESTADO_LABELS[intervencion.estado] ?? intervencion.estado} — Fecha: {intervencion.fecha} — Responsable:{' '}
          {intervencion.responsable}
        </p>
        <p className="mt-2 text-sm text-foreground">Objetivo: {intervencion.objetivo}</p>
        <p className="text-sm text-foreground">Indicadores a medir: {intervencion.indicadores}</p>
        {intervencion.presupuesto !== null ? (
          <p className="text-sm text-muted-foreground">
            Presupuesto: ${intervencion.presupuesto.toLocaleString('es-CL')}
          </p>
        ) : null}
        {intervencion.resultado ? <p className="mt-2 text-sm text-foreground">{intervencion.resultado}</p> : null}
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
            Esta intervención no tiene una pregunta de seguimiento configurada.
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
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{eventosDespues}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Note: `usuarioRow` is fetched with `.select('id')` only and never mapped, matching the same
deliberate pattern already used throughout this project. Unlike Campañas (which had a nullable
`fechaFin` and thus a real "la campaña todavía no tiene fecha de término" message),
`eventosDespues` here has no `null` branch at all — `intervencion.fecha` always exists, so
"después" is always computable for the security-events count.

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, and the route list printed at the end includes
`/plataforma/intervenciones/[id]`. A full logged-in visual check is out of scope for this step
(same gap already documented for every prior read-only-page module in this roadmap — no live
Supabase credentials in this worktree/checkout); Task 4 covers that against the real deployed
environment.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/intervenciones/[id]/page.tsx
git commit -m "feat: add intervencion seguimiento page"
```

---

### Task 4: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user)
to run against the deployed/production environment after Tasks 1-3 are merged and deployed.
**Unlike Reportes, Bienestar Preventivo, Ausencias y Licencias, Calidad de Datos, and
Integraciones, this module DOES have a schema change** — Step 1 below is not optional, and
per the lesson learned in the Seguimiento de Campañas module, **the migration must be applied
to production BEFORE the code is deployed** (this plan's `IntervencionSheet.tsx` insert
unconditionally references the new column, same risk class as before).

- [ ] **Step 1: Apply the schema change to production Supabase BEFORE deploying the code**

Run this exact SQL against the production Supabase project (via the SQL Editor or
equivalent), and confirm it succeeds, BEFORE pushing/deploying this branch's code:

```sql
alter table intervenciones add column pregunta_seguimiento_id text;
```

Verify via `information_schema.columns` (or the table editor) that `intervenciones` now has
the new nullable `pregunta_seguimiento_id` column, and that no existing row's other columns
were affected.

- [ ] **Step 2: Verify the question picker and link work end-to-end**

Log in to production as an admin. Go to `/plataforma/intervenciones`. Create a new
intervention, selecting a real question from "Pregunta de seguimiento" (not "Ninguna").
Confirm "Ver seguimiento" appears for it, and clicking it opens
`/plataforma/intervenciones/[id]` showing the intervention's header info correctly.

- [ ] **Step 3: Verify the before/after comparison against real data**

For an intervention with `pregunta_seguimiento_id` set and with real `encuesta_respuestas` in
Supabase both before and after its `fecha` (create test responses via the public survey link
if needed), confirm the "Antes"/"Después" averages shown match a manual calculation over
those rows. For an intervention with no `pregunta_seguimiento_id`, confirm the page shows
"Esta intervención no tiene una pregunta de seguimiento configurada" instead of the
comparison cards.

- [ ] **Step 4: Verify the security-event counts**

Confirm "Eventos antes"/"Eventos después" match a manual count of `eventos_seguridad` rows
(by their `fecha` column) before/after the same intervention's date.

- [ ] **Step 5: Confirm no other page's behavior changed**

Navigate to `/plataforma/encuestas` and `/plataforma/campanas`/`/plataforma/campanas/[id]` for
an existing survey/campaign, and confirm both render exactly as before — this plan never
touched any of those files. Confirm `GestionarIntervencionSheet` (advance state / edit
resultado) still works exactly as before on an existing intervention.

- [ ] **Step 6: Report results to the user**

Summarize: schema applied before deploy ✅/❌, question picker + link work ✅/❌,
before/after comparison correct against real data ✅/❌, security-event counts correct ✅/❌,
no regression on encuestas/campañas management ✅/❌. Note that this is the last item from
`referencia/instrucciones2.txt`'s module list — ask the user if any follow-up refinements are
wanted (e.g. Seguimiento's own explicitly-deferred items: configurable time windows, multiple
tracked questions).

---

## Self-Review Notes

- **Spec coverage:** columna nueva + tipo actualizado ✅ (Task 1), reuso sin modificar de
  `medirAntesDespues()` con `fechaInicio`/`fechaFin` iguales a `intervencion.fecha` ✅ (Task 3),
  selector opcional en creación + link de navegación ✅ (Task 2), página con
  encabezado/seguimiento de encuesta/seguimiento de seguridad ✅ (Task 3), aplicación de
  schema a producción ANTES del deploy, explícita esta vez desde el inicio ✅ (Task 4).
  Explícitamente-fuera-de-alcance del spec (ventana de tiempo configurable, múltiples
  preguntas, edición post-creación, alertas automáticas, motor de recomendaciones) no se
  implementa en ninguna tarea, coincide con el spec.
- **Placeholder scan:** sin TBD/TODO; cada paso tiene código completo.
- **Type consistency:** `Intervencion.preguntaSeguimientoId` (Task 1) se consume idénticamente
  en Task 2 (`IntervencionSheet`'s insert) y Task 3 (la página). `ResultadoMedicion`
  (reutilizado de `lib/campanas/medicion.ts`, no redefinido) se consume idénticamente en Task
  3. El caso `despues === null` está documentado explícitamente como inalcanzable en runtime
  pero requerido por TypeScript — no es una laguna real, y se explica así en el código y en
  este plan para que un reviewer no lo marque como un hallazgo. No se introduce ningún tipo
  nuevo que pueda desviarse entre tareas.
- **No new pure function, no new test file** — a diferencia del plan de Campañas (que
  necesitó construir `medirAntesDespues()` desde cero con TDD), este plan reutiliza esa función
  ya probada sin cambios, por eso no hay Task de "función pura + tests" aquí.
