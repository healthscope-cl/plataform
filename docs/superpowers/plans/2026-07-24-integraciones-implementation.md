# Integraciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `/plataforma/integraciones` page showing the status of the 8 data
sources the product document names — Excel/CSV (active, with real import statistics) and 6
external sources (HRIS, ERP, API, IMED, Medipass, Sistemas propios) shown as "No configurada"
with a static description of how each would connect.

**Architecture:** No new database table, no RLS changes, no new component file — this is a
single-file module. The page queries the existing `importaciones` table (already RLS-scoped
to the caller's tenant, no `empresa_id` column on this table at all — same simple pattern
already used by `/plataforma/importar/historial` and `/plataforma/auditoria`) for the
Excel/CSV statistics, and renders 6 static text cards for the unconfigured sources.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr`),
Tailwind v4, existing shadcn `Badge` primitive.

## Global Constraints

- **No new database table, no RLS/schema changes, no new lib or component file.** This is
  the smallest module in the roadmap so far — everything lives in the one new page file.
- **Do not modify** `mapImportacionRow` (`lib/ingestion/types.ts`), `ImportHistoryTable.tsx`,
  or any file under `app/plataforma/importar/` or `app/plataforma/calidad-datos/` — this plan
  only reads `importaciones`, it never writes to it, and it doesn't duplicate those pages'
  views (it summarizes the channel's health, not its quality-error detail or full history).
- **Excel and CSV are one source, not two.** They render as a single "Excel / CSV" card —
  the import wizard already processes both formats through the same `parseSpreadsheet()`
  function, so presenting them as two separate channels would misrepresent the real
  implementation.
- **The 6 unconfigured-source descriptions are static strings, not computed** — no
  configuration UI, no "connect" button, no state to toggle. Use the exact wording below
  (verbatim, sourced from the design spec).
- **`importaciones` has no `empresa_id` column** (verified against `supabase/schema.sql`) —
  it is scoped by `tenant_id` only. Do not add an `empresas`/`.limit(1)` lookup the way
  Resumen/Reportes/Bienestar/Ausencias/Calidad de Datos do; query `importaciones` directly,
  exactly like `/plataforma/importar/historial/page.tsx` and `/plataforma/auditoria/page.tsx`
  already do.
- **`/plataforma/integraciones` nav entry uses `adminOnly: true`**, positioned directly after
  "Calidad de datos" in the Sidebar (same grouping as the other ingestion-related pages) —
  same access pattern as every other admin-only page in this project (route doesn't re-check
  role server-side).
- Use the shared `Badge` component (`components/ui/badge.tsx`) for the "Activa"/"No
  configurada" status pills — `variant="secondary"` for Activa, `variant="outline"` for No
  configurada — same convention `ImportHistoryTable.tsx` already uses for its own status
  badges.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required
  exact invocation on this machine (default heap OOMs).
- No unit test for the page — matches the established pattern (no `/plataforma/*` page has a
  test file in this project).

---

## File Structure

```
components/platform/Sidebar.tsx          (MODIFY — new nav entry)
app/plataforma/integraciones/page.tsx    (CREATE — the entire module)
```

---

### Task 1: Página de Integraciones + entrada de navegación

**Files:**
- Modify: `components/platform/Sidebar.tsx`
- Create: `app/plataforma/integraciones/page.tsx`

**Interfaces:**
- Consumes: `mapImportacionRow` (`lib/ingestion/types.ts`, exact shape below), `Badge`
  (`components/ui/badge.tsx`).
- Produces: nothing consumed by a later task — this is the only code task in this plan.

Real shape this task depends on (for reference, do not redefine — import it):

```ts
// lib/ingestion/types.ts
export type Importacion = {
  id: string
  tenantId: string
  createdAt: string
  responsableId: string
  archivoNombre: string
  archivoHash: string
  estado: 'en_progreso' | 'completada' | 'revertida' | 'fallida'
  filasProcesadas: number
  filasRechazadas: number
  advertencias: number
}
export function mapImportacionRow(row: {
  id: string; tenant_id: string; created_at: string; responsable_id: string
  archivo_nombre: string; archivo_hash: string
  estado: 'en_progreso' | 'completada' | 'revertida' | 'fallida'
  filas_procesadas: number; filas_rechazadas: number; advertencias: number
}): Importacion
```

Database facts this task relies on (verified against `supabase/schema.sql`, no migration
needed): `importaciones` has RLS policy `importaciones_select_same_tenant` (`for select to
authenticated using (tenant_id = auth_tenant_id())`) and `grant select ... to authenticated` —
the regular Supabase client can already read every import row belonging to the caller's
tenant, with no `empresa_id` column to filter by at all.

- [ ] **Step 1: Add the "Integraciones" nav entry to the Sidebar**

In `components/platform/Sidebar.tsx`, the `NAV_ITEMS` array currently has this entry:

```ts
  { href: '/plataforma/calidad-datos', label: 'Calidad de datos', adminOnly: true },
```

Add a new entry directly after it:

```ts
  { href: '/plataforma/calidad-datos', label: 'Calidad de datos', adminOnly: true },
  { href: '/plataforma/integraciones', label: 'Integraciones', adminOnly: true },
```

- [ ] **Step 2: Write the page**

Create `app/plataforma/integraciones/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapImportacionRow } from '@/lib/ingestion/types'
import { Badge } from '@/components/ui/badge'

const ESTADO_LABELS: Record<string, string> = {
  en_progreso: 'En progreso',
  completada: 'Completada',
  revertida: 'Revertida',
  fallida: 'Fallida',
}

const FUENTES_NO_CONFIGURADAS = [
  {
    nombre: 'HRIS',
    descripcion:
      'Se conecta mediante una exportación periódica autorizada del sistema de Recursos Humanos del cliente — no acceso directo a su base de datos.',
  },
  {
    nombre: 'ERP',
    descripcion:
      'Requiere una integración autorizada con el ERP del cliente (exportación de asistencia, turnos u otros datos relevantes) — no acceso directo.',
  },
  {
    nombre: 'API',
    descripcion:
      'Requiere una API contratada y autorizada explícitamente por el cliente — HealthScope no expone ni consume APIs sin esa autorización.',
  },
  {
    nombre: 'IMED',
    descripcion:
      'Nunca acceso directo a la base de IMED — solo mediante exportación autorizada del empleador o datos clínicos agregados enviados por el prestador.',
  },
  {
    nombre: 'Medipass',
    descripcion:
      'Mismo principio que IMED — nunca acceso directo, solo exportación autorizada o datos agregados del prestador.',
  },
  {
    nombre: 'Sistemas propios',
    descripcion:
      'Se evalúa caso a caso según qué pueda exportar de forma segura el sistema propio del cliente (típicamente Excel/CSV o una API contratada).',
  },
] as const

export default async function IntegracionesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')

  const { data: importacionRows } = await supabase
    .from('importaciones')
    .select('*')
    .order('created_at', { ascending: false })
  const importaciones = (importacionRows ?? []).map(mapImportacionRow)

  const totalImportaciones = importaciones.length
  const totalFilasProcesadas = importaciones.reduce((acc, imp) => acc + imp.filasProcesadas, 0)
  const ultimaImportacion = importaciones[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Integraciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado de las fuentes de datos que HealthScope puede recibir.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Excel / CSV</p>
            <Badge variant="secondary">Activa</Badge>
          </div>
          <p className="mt-2 text-sm text-foreground">{totalImportaciones} importaciones realizadas</p>
          <p className="text-sm text-foreground">{totalFilasProcesadas} filas procesadas en total</p>
          {ultimaImportacion ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Última: {new Date(ultimaImportacion.createdAt).toLocaleDateString('es-CL')} —{' '}
              {ultimaImportacion.archivoNombre} — {ESTADO_LABELS[ultimaImportacion.estado] ?? ultimaImportacion.estado}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Todavía no se ha realizado ninguna importación.</p>
          )}
        </div>

        {FUENTES_NO_CONFIGURADAS.map((fuente) => (
          <div key={fuente.nombre} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{fuente.nombre}</p>
              <Badge variant="outline">No configurada</Badge>
            </div>
            <p className="mt-2 text-sm text-foreground">{fuente.descripcion}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Note: `usuarioRow` is fetched with `.select('id')` only and never mapped, matching the same
deliberate pattern already used in `app/plataforma/bienestar/page.tsx`,
`app/plataforma/ausencias/page.tsx`, and `app/plataforma/calidad-datos/page.tsx`.

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 4: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass (no test was added or changed by this task).

- [ ] **Step 5: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, and the route list printed at the end includes
`/plataforma/integraciones`. A full logged-in visual check is out of scope for this step (same
gap already documented for every prior read-only-page module in this roadmap — no live
Supabase credentials in this worktree/checkout); Task 2 covers that against the real deployed
environment.

- [ ] **Step 6: Commit**

```bash
git add components/platform/Sidebar.tsx app/plataforma/integraciones/page.tsx
git commit -m "feat: add integraciones page"
```

---

### Task 2: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user)
to run against the deployed/production environment after Task 1 is merged and deployed.
**This module has no database schema, so there is no "apply SQL to production Supabase" step
in this task** — same as Reportes, Bienestar Preventivo, Ausencias y Licencias, and Calidad de
Datos before it.

- [ ] **Step 1: Verify the page renders correctly with real production data**

Log in to production as an admin. Go to `/plataforma/integraciones`. Confirm: the "Excel /
CSV" card shows "Activa" and its total-imports/total-filas-procesadas numbers match a manual
count over `importaciones` for that empresa's tenant, and its "Última" line matches the most
recent import. Confirm all 6 other cards show "No configurada" with the correct description
text.

- [ ] **Step 2: Confirm no other page's behavior changed**

Navigate to `/plataforma/importar/historial` and `/plataforma/calidad-datos` and confirm both
still render exactly as before — this plan never touched either page or
`ImportHistoryTable.tsx`.

- [ ] **Step 3: Confirm non-admin visibility is correctly restricted**

If a non-admin test account is available, confirm "Integraciones" does **not** appear in
their sidebar (matches `adminOnly: true`). If no non-admin account is readily available, skip
this and note it as unverified rather than blocking on it.

- [ ] **Step 4: Report results to the user**

Summarize: page renders correct real data ✅/❌, historial/calidad-datos unchanged ✅/❌,
non-admin sidebar visibility confirmed or noted as unverified. Ask the user which module from
`referencia/instrucciones2.txt` to tackle next (the remaining candidates: Reportes' other 6
report types, or Seguimiento for Intervenciones).

---

## Self-Review Notes

- **Spec coverage:** las 8 fuentes cubiertas (Excel/CSV combinado en una tarjeta activa con
  datos reales, las 6 externas como "No configurada" con la descripción exacta del spec) ✅
  (Task 1), ruta `/plataforma/integraciones` con `adminOnly: true` ✅ (Task 1), verificación
  manual ✅ (Task 2). Explícitamente-fuera-de-alcance del spec (conectores reales, flujo de
  "solicitar conexión", historial detallado por fuente) no se implementa, coincide con el
  spec.
- **Placeholder scan:** sin TBD/TODO; el paso de código tiene el archivo completo.
- **Type consistency:** `Importacion`/`mapImportacionRow` se usan idénticamente a como están
  definidos en `lib/ingestion/types.ts` (verificado leyendo el archivo real, no de memoria). No
  se introduce ningún tipo nuevo.
