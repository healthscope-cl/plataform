# Bienestar Preventivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `/plataforma/bienestar` dashboard that aggregates the wellbeing
signals already collected through the existing Encuestas module (estrés, fatiga, sueño,
carga, liderazgo, conciliación, clima) across every survey the company has ever run, applying
the same small-group suppression the individual survey results page already uses.

**Architecture:** No new database table, no RLS changes. Adds one missing question ("clima")
to the existing survey catalog, then a new page that pulls every `encuesta_respuestas` row
belonging to the company's surveys (via `createAdminClient()`, the same privileged read path
`/plataforma/encuestas/[id]` already uses) and calls `agregarRespuestas()` — completely
unmodified — over the union of all of them instead of just one survey's.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr` +
`@supabase/supabase-js` admin client), Tailwind v4.

## Global Constraints

- **No new database table, no RLS/schema changes.** This module reads `encuestas` and
  `encuesta_respuestas` exactly as they exist today — no migration, no new grant.
- **Do not modify** `agregarRespuestas()` (`lib/encuestas/agregar.ts`), `CATALOGO_PREGUNTAS`'s
  existing 8 entries, `mapEncuestaRespuestaRow`, `mapEmpresaRow`, or `createAdminClient()` —
  import and use them exactly as they exist today. The only catalog change is one new
  appended entry (`clima`), never touching the existing entries.
- **`BIENESTAR_PREGUNTA_IDS` is exactly this list, in this order:**
  `['estres', 'fatiga', 'sueno', 'carga', 'liderazgo', 'conciliacion', 'clima']`. Do not
  include `dolor_musculoesqueletico` (belongs to the Ergonomía module) or `pausas_activas`
  (not assigned to any module this phase) — both already exist in the catalog for other uses,
  neither belongs in this list.
- **Snapshot acumulado, sin ventana de tiempo, sin segmentación.** Aggregate every response
  the company's surveys have ever collected — no date filter, no breakdown by
  sucursal/unidad/cargo/turno (the underlying table doesn't capture that data by design).
- The `/plataforma/bienestar` nav entry uses `adminOnly: true` — same visibility level as
  "Encuestas", because this page exposes aggregated (though suppressed) stress/wellbeing
  signals, not a purely operational view like "Resumen"/"Reportes".
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required
  exact invocation on this machine (default heap OOMs).
- Neither `Sidebar.tsx` nor any `/plataforma/*` page in this codebase has a unit test file —
  matches the established pattern (verified: no `*.test.*` file exists anywhere under
  `components/platform/` or any `/plataforma/*` route directory). Do not add one for this
  plan's files either.

---

## File Structure

```
lib/encuestas/catalogo.ts               (MODIFY — append "clima" question)
components/platform/Sidebar.tsx         (MODIFY — new nav entry)
app/plataforma/bienestar/page.tsx       (CREATE — the dashboard page)
```

---

### Task 1: Catálogo "clima" + entrada de navegación

**Files:**
- Modify: `lib/encuestas/catalogo.ts`
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing from another task in this plan.
- Produces: `CATALOGO_PREGUNTAS` (exported from `lib/encuestas/catalogo.ts`) gains a 9th
  entry `{ id: 'clima', texto: 'Percepción del clima laboral en el equipo' }`, which Task 2
  looks up by id. The Sidebar gains the `/plataforma/bienestar` nav entry that makes Task 2's
  route reachable from the UI (the route itself works without it, but is otherwise
  undiscoverable).

- [ ] **Step 1: Add the "clima" question to the survey catalog**

Current file (`lib/encuestas/catalogo.ts`) ends with:

```ts
  { id: 'pausas_activas', texto: 'Cumplimiento de pausas activas durante la jornada' },
]
```

Change it to:

```ts
  { id: 'pausas_activas', texto: 'Cumplimiento de pausas activas durante la jornada' },
  { id: 'clima', texto: 'Percepción del clima laboral en el equipo' },
]
```

- [ ] **Step 2: Add the "Bienestar preventivo" nav entry to the Sidebar**

In `components/platform/Sidebar.tsx`, the `NAV_ITEMS` array currently has this entry:

```ts
  { href: '/plataforma/encuestas', label: 'Encuestas', adminOnly: true },
```

Add a new entry directly after it:

```ts
  { href: '/plataforma/encuestas', label: 'Encuestas', adminOnly: true },
  { href: '/plataforma/bienestar', label: 'Bienestar preventivo', adminOnly: true },
```

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0 (this task only adds a literal array entry and a data
literal — no new types are introduced, so a clean pre-existing project should still type-check
clean).

- [ ] **Step 4: Commit**

```bash
git add lib/encuestas/catalogo.ts components/platform/Sidebar.tsx
git commit -m "feat: add clima question to survey catalog and bienestar nav entry"
```

---

### Task 2: Página de Bienestar Preventivo

**Files:**
- Create: `app/plataforma/bienestar/page.tsx`

**Interfaces:**
- Consumes: `CATALOGO_PREGUNTAS` (`lib/encuestas/catalogo.ts`, from Task 1, already includes
  `clima`) — array of `{ id: string; texto: string }`. `agregarRespuestas({ preguntaIds:
  string[], respuestas: Array<Record<string, number>> })` (`lib/encuestas/agregar.ts`) —
  returns `Record<string, { promedio: number; cantidad: number } | { suprimido: true }>`.
  `mapEncuestaRespuestaRow(row)` and `mapEmpresaRow(row)` (see exact row shapes below).
  `createClient()` (`lib/supabase/server.ts`) for the RLS-respecting client,
  `createAdminClient()` (`lib/supabase/admin.ts`) for the one privileged read.
- Produces: nothing consumed by a later task — this is the last code task in this plan.

Real shapes this task depends on (for reference, do not redefine these — import them):

```ts
// lib/encuestas/types.ts
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
}): EncuestaRespuesta

// lib/platform/types.ts
export type Empresa = { id: string; tenantId: string; createdAt: string; nombre: string; rut: string | null }
export function mapEmpresaRow(row: {
  id: string
  tenant_id: string
  created_at: string
  nombre: string
  rut: string | null
}): Empresa
```

Database facts this task relies on (verified against `supabase/schema.sql`, no migration
needed): `encuestas` has RLS policy `encuestas_select_same_tenant` (`for select to
authenticated using (tenant_id = auth_tenant_id())`) — the regular (non-admin) Supabase client
can already read every survey row belonging to the caller's tenant, so tenant scoping doesn't
need to be checked manually for that query. `encuesta_respuestas` has **no** select grant for
`authenticated` (only `insert` — see `grant insert on encuesta_respuestas to
anon`/`authenticated` at `supabase/schema.sql:560-561`) — raw responses can only be read
through `createAdminClient()`, which bypasses RLS entirely, so this route must scope that
query itself (via the `encuesta_id in (...)` filter built from the tenant-scoped `encuestas`
query) rather than relying on any policy.

- [ ] **Step 1: Write the page**

Create `app/plataforma/bienestar/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapEmpresaRow } from '@/lib/platform/types'
import { mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { agregarRespuestas } from '@/lib/encuestas/agregar'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'

const BIENESTAR_PREGUNTA_IDS = ['estres', 'fatiga', 'sueno', 'carga', 'liderazgo', 'conciliacion', 'clima']

export default async function BienestarPreventivoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)

  const { data: encuestaRows } = await supabase.from('encuestas').select('id').eq('empresa_id', empresa.id)
  const encuestaIds = (encuestaRows ?? []).map((row) => row.id as string)

  // encuesta_respuestas has no authenticated-role SELECT policy by design (see the encuestas
  // module's Task 1 security fix) — this Server Component is one of the few places allowed to
  // read raw rows, precisely so it can aggregate (and apply small-group suppression) before
  // anything reaches the browser.
  const admin = createAdminClient()
  const { data: respuestaRows } =
    encuestaIds.length > 0
      ? await admin.from('encuesta_respuestas').select('*').in('encuesta_id', encuestaIds)
      : { data: [] }
  const respuestas = (respuestaRows ?? []).map(mapEncuestaRespuestaRow)

  const resultados = agregarRespuestas({
    preguntaIds: BIENESTAR_PREGUNTA_IDS,
    respuestas: respuestas.map((r) => r.respuestas),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Bienestar preventivo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Promedio agregado de todas las encuestas de {empresa.nombre}, sin filtrar por período.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BIENESTAR_PREGUNTA_IDS.map((preguntaId) => {
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

Note: `usuarioRow` is fetched with `.select('id')` only and never read beyond the
existence/redirect check — deliberately not mapped through `mapUsuarioRow()` here, because
nothing in this page needs the mapped fields. (A prior task in this same roadmap — the
Reportes module — mapped a `usuarios.roles` join into an unused `rol` variable; this page
avoids repeating that.)

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass (no test was added or changed by this task — this
step exists to confirm the new page doesn't break anything already covered, e.g. via a shared
import path).

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, and the route list printed at the end includes
`/plataforma/bienestar`. A full logged-in visual check is out of scope for this step (same
gap already documented for the Reportes module's equivalent step — this worktree/checkout has
no live Supabase credentials for an interactive session); Task 3 covers that against the real
deployed environment.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/bienestar/page.tsx
git commit -m "feat: add bienestar preventivo page"
```

---

### Task 3: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user)
to run against the deployed/production environment after Tasks 1-2 are merged and deployed.
**This module has no database schema, so there is no "apply SQL to production Supabase" step
in this task** — same as the Reportes module before it.

- [ ] **Step 1: Verify the page renders correctly with real production data**

Log in to production as an admin. Go to `/plataforma/bienestar`. Confirm: each of the 7
bienestar questions (estrés, fatiga, sueño, carga, liderazgo, conciliación, clima) shows
either a promedio + cantidad, or "Grupo insuficiente para mostrar". For at least one question
where the real cantidad is known (e.g. by counting responses directly in Supabase), confirm
the displayed promedio matches a manual calculation over the real `encuesta_respuestas` rows.

- [ ] **Step 2: Verify the "clima" question is selectable in new surveys**

Go to `/plataforma/encuestas`, create (or edit, if editing is supported) a survey, and confirm
"Percepción del clima laboral en el equipo" appears as a selectable question — confirms the
catalog addition from Task 1 reached the survey-creation form without needing any change to
`EncuestaSheet.tsx` itself (it reads the catalog dynamically).

- [ ] **Step 3: Confirm no other page's behavior changed**

Navigate to `/plataforma/encuestas/[id]` for an existing survey and confirm its results page
still renders exactly as before (this plan never touched that file or `agregarRespuestas()`).

- [ ] **Step 4: Confirm non-admin visibility is correctly restricted**

If a non-admin test account is available, confirm "Bienestar preventivo" does **not** appear
in their sidebar (matches `adminOnly: true`, same as "Encuestas") and that navigating directly
to `/plataforma/bienestar` is a product decision to leave unenforced at the route level (same
precedent as every other `adminOnly: true` page in this project — the nav link is hidden, but
the route itself doesn't re-check the role, consistent with Encuestas/Alertas/etc.). If no
non-admin account is readily available, skip this and note it as unverified rather than
blocking on it.

- [ ] **Step 5: Report results to the user**

Summarize: page renders correct real data ✅/❌, clima question selectable in survey creation
✅/❌, encuesta results page unchanged ✅/❌, non-admin sidebar visibility confirmed or noted as
unverified. Ask the user which module from `referencia/instrucciones2.txt` to tackle next.

---

## Self-Review Notes

- **Spec coverage:** catálogo "clima" ✅ (Task 1), `BIENESTAR_PREGUNTA_IDS` con el conjunto y
  orden exactos del spec ✅ (Task 2), agregación de todas las encuestas de la empresa sin
  ventana temporal ✅ (Task 2), reutilización sin modificar de `agregarRespuestas` ✅ (Task 2),
  ruta `/plataforma/bienestar` con `adminOnly: true` ✅ (Task 1 nav + Task 2 route),
  verificación manual de datos reales/catálogo/no-regresión/visibilidad ✅ (Task 3).
  Explícitamente-fuera-de-alcance del spec (tendencia temporal, segmentación, vínculo con
  índice de suficiencia o alertas, motor de recomendaciones) no se implementa en ninguna
  tarea, coincide con el spec.
- **Placeholder scan:** sin TBD/TODO; cada paso tiene código completo.
- **Type consistency:** `EncuestaRespuesta`/`mapEncuestaRespuestaRow`, `Empresa`/`mapEmpresaRow`,
  y la firma de `agregarRespuestas` se usan idénticamente a como están definidas en los
  archivos reales ya existentes (verificado leyendo `lib/encuestas/types.ts`,
  `lib/platform/types.ts`, `lib/encuestas/agregar.ts` directamente, no de memoria). No se
  introduce ningún tipo nuevo que pueda desviarse — todo se importa de módulos ya enviados.
