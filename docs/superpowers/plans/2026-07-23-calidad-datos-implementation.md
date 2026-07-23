# Calidad de Datos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `/plataforma/calidad-datos` page that surfaces `errores_calidad`
rows (already written by every import but never shown after the fact) — a summary by tipo
with static help text, plus a detailed list, plus a "last update" line.

**Architecture:** No new database table, no RLS changes. A Server Component page queries the
last 50 `importaciones` (already RLS-scoped to the caller's tenant, no admin client needed),
then their associated `errores_calidad` rows, and hands both to two new presentational Client
Components. A shared label map (`lib/ingestion/calidadLabels.ts`) is used by both components
so the tipo→label lookup isn't duplicated.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr`),
Tailwind v4, existing shadcn `Table`/`Badge` primitives.

## Global Constraints

- **No new database table, no RLS/schema changes.** `errores_calidad_select_same_tenant` and
  `importaciones_select_same_tenant` already let any authenticated tenant member read these
  rows — no `createAdminClient()`, no new grant.
- **Do not modify** `mapImportacionRow`, `mapErrorCalidadRow` (`lib/ingestion/types.ts`),
  `ImportHistoryTable.tsx`, `validate.ts`, or `app/api/platform/importaciones/ejecutar/route.ts`
  — this plan only reads existing data, it never touches the import/validation pipeline.
- **Query shape:** `importaciones` ordered by `created_at` descending, `.limit(50)` — this
  bounds the join, since `errores_calidad` has no `created_at` column of its own (it inherits
  its date from the parent importación). The detail table additionally caps at 200 rows
  (sorted by the joined importación date, descending) — same cap convention as Auditoría and
  Ausencias y Licencias. The tipo-summary counts are **not** capped — they aggregate every
  error from all 50 fetched importaciones.
- **`tipo` is free `text` in the database, not an enum.** The label/tip lookups are
  `Record<string, string>` with a fallback for any unlisted value — never an exhaustive
  `Record` over a closed union (there is no closed union to check against).
- **The 7 known `tipo` values today** (verified against `lib/ingestion/validate.ts` and
  `app/api/platform/importaciones/ejecutar/route.ts:200,212,224`): `campo_obligatorio_faltante`,
  `fila_duplicada`, `duracion_invalida`, `tipo_no_reconocido`, `fecha_imposible`,
  `periodo_superpuesto`, `grupo_no_reconocido`.
- **"Recomendaciones" is a static one-line tip per tipo, not a recommendation engine.** No AI,
  no scoring, no persistence — a fixed lookup table. This is explicitly not the "motor de
  recomendaciones" from the product document's section 10, which remains out of scope
  project-wide.
- **`/plataforma/calidad-datos` nav entry uses `adminOnly: true`** — same as every other
  admin-only page in this project. The route itself does not re-check the role server-side,
  matching that precedent.
- No filters, no write/resolve actions on this page.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required
  exact invocation on this machine (default heap OOMs).
- No unit test for the page or either new component — matches the established pattern (no
  `/plataforma/*` page or table/summary component like `AuditoriaTable.tsx` has a test file in
  this project). `lib/ingestion/calidadLabels.ts` is a plain data literal, same category as
  `lib/encuestas/catalogo.ts` — no test file either.

---

## File Structure

```
lib/ingestion/calidadLabels.ts                              (CREATE — shared tipo→label map)
components/platform/calidad-datos/CalidadDatosResumen.tsx    (CREATE — summary by tipo + tips)
components/platform/calidad-datos/CalidadDatosTable.tsx      (CREATE — detail table)
components/platform/Sidebar.tsx                              (MODIFY — new nav entry)
app/plataforma/calidad-datos/page.tsx                        (CREATE — the query, the page)
```

---

### Task 1: Componentes + mapa de etiquetas + entrada de navegación

**Files:**
- Create: `lib/ingestion/calidadLabels.ts`
- Create: `components/platform/calidad-datos/CalidadDatosResumen.tsx`
- Create: `components/platform/calidad-datos/CalidadDatosTable.tsx`
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: `ErrorCalidad` type (`lib/ingestion/types.ts`) — `{ id, tenantId, importacionId, fila, severidad: 'critico' | 'advertencia', tipo: string, mensaje: string }`.
- Produces: `TIPO_LABELS` (exported from `lib/ingestion/calidadLabels.ts`), `CalidadDatosResumen` (takes `{ errores: ErrorCalidad[] }`), `CalidadDatosTable` and its exported type `ErrorCalidadFila` (takes `{ errores: ErrorCalidadFila[] }`) — all consumed by Task 2's page. The Sidebar nav entry `{ href: '/plataforma/calidad-datos', label: 'Calidad de datos', adminOnly: true }` makes Task 2's route reachable from the UI.

- [ ] **Step 1: Create the shared label map**

Create `lib/ingestion/calidadLabels.ts`:

```ts
export const TIPO_LABELS: Record<string, string> = {
  campo_obligatorio_faltante: 'Campo obligatorio faltante',
  fila_duplicada: 'Fila duplicada',
  duracion_invalida: 'Duración inválida',
  tipo_no_reconocido: 'Tipo no reconocido',
  fecha_imposible: 'Fecha imposible',
  periodo_superpuesto: 'Período superpuesto',
  grupo_no_reconocido: 'Grupo no reconocido',
}
```

- [ ] **Step 2: Create the summary component**

Create `components/platform/calidad-datos/CalidadDatosResumen.tsx`:

```tsx
import type { ErrorCalidad } from '@/lib/ingestion/types'
import { TIPO_LABELS } from '@/lib/ingestion/calidadLabels'

const TIPO_TIPS: Record<string, string> = {
  campo_obligatorio_faltante:
    'Revisa que la plantilla tenga todas las columnas requeridas antes de volver a importar.',
  fila_duplicada:
    'Verifica si el mismo archivo se importó más de una vez, o si hay filas repetidas dentro del mismo archivo.',
  duracion_invalida: 'Confirma que las fechas de inicio y fin de cada licencia sean coherentes entre sí.',
  tipo_no_reconocido:
    'El tipo de licencia del archivo no coincide con ningún tipo administrativo del catálogo — revisa la ortografía o el mapeo de columnas.',
  fecha_imposible: 'Alguna fecha del archivo no es una fecha válida (por ejemplo, fuera de rango o mal formateada).',
  periodo_superpuesto:
    'Dos licencias de la misma persona se superponen en el tiempo — confirma cuál es la correcta antes de reimportar.',
  grupo_no_reconocido:
    'El código de sucursal, unidad, cargo o turno del archivo no coincide con ningún registro existente.',
}

const TIP_GENERICO = 'Revisa el mensaje detallado de cada error en la tabla de abajo.'

export function CalidadDatosResumen({ errores }: { errores: ErrorCalidad[] }) {
  const conteos = new Map<string, number>()
  for (const error of errores) {
    conteos.set(error.tipo, (conteos.get(error.tipo) ?? 0) + 1)
  }
  const filas = Array.from(conteos.entries()).sort((a, b) => b[1] - a[1])

  if (filas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin errores de calidad en las importaciones recientes.</p>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filas.map(([tipo, cantidad]) => (
        <div key={tipo} className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{TIPO_LABELS[tipo] ?? tipo}</p>
          <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{cantidad}</p>
          <p className="mt-2 text-xs text-muted-foreground">{TIPO_TIPS[tipo] ?? TIP_GENERICO}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create the detail table component**

Create `components/platform/calidad-datos/CalidadDatosTable.tsx`:

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { TIPO_LABELS } from '@/lib/ingestion/calidadLabels'

export type ErrorCalidadFila = {
  id: string
  fecha: string
  archivo: string
  fila: number
  severidad: 'critico' | 'advertencia'
  tipo: string
  mensaje: string
}

export function CalidadDatosTable({ errores }: { errores: ErrorCalidadFila[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Archivo</TableHead>
          <TableHead>Fila</TableHead>
          <TableHead>Severidad</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Mensaje</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {errores.map((error) => (
          <TableRow key={error.id}>
            <TableCell>{new Date(error.fecha).toLocaleDateString('es-CL')}</TableCell>
            <TableCell>{error.archivo}</TableCell>
            <TableCell>{error.fila}</TableCell>
            <TableCell>
              <Badge variant={error.severidad === 'critico' ? 'destructive' : 'outline'}>
                {error.severidad === 'critico' ? 'Crítico' : 'Advertencia'}
              </Badge>
            </TableCell>
            <TableCell>{TIPO_LABELS[error.tipo] ?? error.tipo}</TableCell>
            <TableCell>{error.mensaje}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 4: Add the "Calidad de datos" nav entry to the Sidebar**

In `components/platform/Sidebar.tsx`, the `NAV_ITEMS` array currently has this entry:

```ts
  { href: '/plataforma/importar/historial', label: 'Historial de importaciones', adminOnly: true },
```

Add a new entry directly after it:

```ts
  { href: '/plataforma/importar/historial', label: 'Historial de importaciones', adminOnly: true },
  { href: '/plataforma/calidad-datos', label: 'Calidad de datos', adminOnly: true },
```

- [ ] **Step 5: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add lib/ingestion/calidadLabels.ts components/platform/calidad-datos/CalidadDatosResumen.tsx components/platform/calidad-datos/CalidadDatosTable.tsx components/platform/Sidebar.tsx
git commit -m "feat: add calidad de datos components and nav entry"
```

---

### Task 2: Página de Calidad de Datos

**Files:**
- Create: `app/plataforma/calidad-datos/page.tsx`

**Interfaces:**
- Consumes: `mapImportacionRow`, `mapErrorCalidadRow` (`lib/ingestion/types.ts`, exact shapes below). `CalidadDatosResumen` (takes `{ errores: ErrorCalidad[] }`) and `CalidadDatosTable`/`ErrorCalidadFila` (takes `{ errores: ErrorCalidadFila[] }`), both from Task 1.
- Produces: nothing consumed by a later task — this is the last code task in this plan.

Real shapes this task depends on (for reference, do not redefine these — import them):

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

export type ErrorCalidad = {
  id: string
  tenantId: string
  importacionId: string
  fila: number
  severidad: 'critico' | 'advertencia'
  tipo: string
  mensaje: string
}
export function mapErrorCalidadRow(row: {
  id: string; tenant_id: string; importacion_id: string; fila: number
  severidad: 'critico' | 'advertencia'; tipo: string; mensaje: string
}): ErrorCalidad
```

Database facts this task relies on (verified against `supabase/schema.sql`, no migration
needed): `importaciones` has RLS policy `importaciones_select_same_tenant` and `grant select
... to authenticated`. `errores_calidad` has RLS policy `errores_calidad_select_same_tenant`
and `grant select on errores_calidad to authenticated` (no insert/update/delete grant for
authenticated — writes only ever happen via `service_role` in the import execution route,
which this plan does not touch). Both are readable with the regular (non-admin) Supabase
client, exactly as they already are for `/plataforma/importar/historial`.

- [ ] **Step 1: Write the page**

Create `app/plataforma/calidad-datos/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapImportacionRow, mapErrorCalidadRow } from '@/lib/ingestion/types'
import { CalidadDatosResumen } from '@/components/platform/calidad-datos/CalidadDatosResumen'
import { CalidadDatosTable, type ErrorCalidadFila } from '@/components/platform/calidad-datos/CalidadDatosTable'

const ESTADO_LABELS: Record<'en_progreso' | 'completada' | 'revertida' | 'fallida', string> = {
  en_progreso: 'En progreso',
  completada: 'Completada',
  revertida: 'Revertida',
  fallida: 'Fallida',
}

export default async function CalidadDatosPage() {
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
    .limit(50)
  const importaciones = (importacionRows ?? []).map(mapImportacionRow)
  const importacionIds = importaciones.map((i) => i.id)

  const { data: errorRows } =
    importacionIds.length > 0
      ? await supabase.from('errores_calidad').select('*').in('importacion_id', importacionIds)
      : { data: [] }
  const errores = (errorRows ?? []).map(mapErrorCalidadRow)

  const erroresFilas: ErrorCalidadFila[] = errores
    .map((error) => {
      const importacion = importaciones.find((i) => i.id === error.importacionId)
      return {
        id: error.id,
        fecha: importacion?.createdAt ?? '',
        archivo: importacion?.archivoNombre ?? '',
        fila: error.fila,
        severidad: error.severidad,
        tipo: error.tipo,
        mensaje: error.mensaje,
      }
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
    .slice(0, 200)

  const ultimaImportacion = importaciones[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Calidad de datos</h1>
        {ultimaImportacion ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Última importación: {new Date(ultimaImportacion.createdAt).toLocaleDateString('es-CL')} —{' '}
            {ultimaImportacion.archivoNombre} — {ESTADO_LABELS[ultimaImportacion.estado]}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Todavía no se ha realizado ninguna importación.</p>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Resumen por tipo</h2>
        <CalidadDatosResumen errores={errores} />
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Detalle</h2>
        <CalidadDatosTable errores={erroresFilas} />
      </div>
    </div>
  )
}
```

Note: the summary (`CalidadDatosResumen`) receives the full, uncapped `errores` array (all
errors from the 50 fetched importaciones), while the detail table (`erroresFilas`) is sorted
by the joined importación date descending and capped at 200 — matching the plan's stated
constraint that only the detail view has a row cap. `usuarioRow` is fetched with
`.select('id')` only and never mapped, matching the same deliberate pattern already used in
`app/plataforma/bienestar/page.tsx` and `app/plataforma/ausencias/page.tsx`.

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass (no test was added or changed by this task).

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, and the route list printed at the end includes
`/plataforma/calidad-datos`. A full logged-in visual check is out of scope for this step (same
gap already documented for Reportes/Bienestar/Ausencias' equivalent steps — no live Supabase
credentials in this worktree/checkout); Task 3 covers that against the real deployed
environment.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/calidad-datos/page.tsx
git commit -m "feat: add calidad de datos page"
```

---

### Task 3: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user)
to run against the deployed/production environment after Tasks 1-2 are merged and deployed.
**This module has no database schema, so there is no "apply SQL to production Supabase" step
in this task** — same as Reportes, Bienestar Preventivo, and Ausencias y Licencias before it.

- [ ] **Step 1: Verify the page renders correctly with real production data**

Log in to production as an admin. Go to `/plataforma/calidad-datos`. Confirm: the "Última
importación" line matches the most recent row in `importaciones` for that empresa. The
per-tipo counts in the summary match a manual count of `errores_calidad` grouped by `tipo`
for the same set of recent importaciones. The detail table's rows match real
`errores_calidad` rows (fecha, archivo, fila, severidad, tipo, mensaje all correct).

- [ ] **Step 2: Confirm no other page's behavior changed**

Navigate to `/plataforma/importar/historial` and confirm it still renders exactly as
before — this plan never touched `ImportHistoryTable.tsx` or the historial page.

- [ ] **Step 3: Confirm non-admin visibility is correctly restricted**

If a non-admin test account is available, confirm "Calidad de datos" does **not** appear in
their sidebar (matches `adminOnly: true`). If no non-admin account is readily available, skip
this and note it as unverified rather than blocking on it.

- [ ] **Step 4: Report results to the user**

Summarize: page renders correct real data ✅/❌, historial de importaciones unchanged ✅/❌,
non-admin sidebar visibility confirmed or noted as unverified. Ask the user which module from
`referencia/instrucciones2.txt` to tackle next.

---

## Self-Review Notes

- **Spec coverage:** "Errores/Campos faltantes/Duplicados" cubiertos vía el resumen por tipo
  con las 7 etiquetas conocidas ✅ (Task 1), "Actualización" vía la línea de última
  importación ✅ (Task 2), "Recomendaciones" como tip estático por tipo, explícitamente no el
  motor de recomendaciones de la sección 10 ✅ (Task 1), tope de 50 importaciones + 200 filas
  de detalle ✅ (Task 2), ruta `/plataforma/calidad-datos` con `adminOnly: true` ✅ (Task 1
  nav + Task 2 route), verificación manual ✅ (Task 3). Explícitamente-fuera-de-alcance del
  spec (motor de recomendaciones real, filtros, edición/resolución de errores, ventana de
  fecha configurable) no se implementa en ninguna tarea, coincide con el spec.
- **Placeholder scan:** sin TBD/TODO; cada paso tiene código completo.
- **Type consistency:** `Importacion`/`mapImportacionRow`, `ErrorCalidad`/`mapErrorCalidadRow`,
  y `TIPO_LABELS` se usan idénticamente a como están definidos/creados en Task 1 y consumidos
  en Task 2 (verificado leyendo `lib/ingestion/types.ts` directamente para las firmas reales).
  `ErrorCalidadFila` (definido en Task 1's `CalidadDatosTable.tsx`, consumido en Task 2) tiene
  los mismos nombres de campo en ambas tareas. No se introduce ningún tipo nuevo que pueda
  desviarse.
