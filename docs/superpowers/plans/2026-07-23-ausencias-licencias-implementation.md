# Ausencias y Licencias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `/plataforma/ausencias` page listing individual `episodios`
(licencias/ausencias) records — one row per episode, not the per-person aggregate that
already exists in `/plataforma/resumen` — with filters by tipo administrativo and estado.

**Architecture:** No new database table, no RLS changes. A Server Component page queries
`episodios` (already RLS-scoped to the caller's tenant, no admin client needed), joins it in
memory against `personas` (for `codigo`) and `tipos_administrativos` (for the human-readable
name), and hands the flattened rows to a new Client Component that filters them in the
browser — same pattern `ResumenInteractivo` already uses for its filters.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr`),
Tailwind v4, existing shadcn `Table`/`Select`/`Label` primitives.

## Global Constraints

- **No new database table, no RLS/schema changes.** `episodios_select_same_tenant` already
  lets any authenticated tenant member read these rows — no `createAdminClient()`, no new
  grant.
- **Do not modify** `mapEpisodioRow`, `mapEmpresaRow`, or any file under
  `components/platform/dashboard/` (`PersonaDetalleTable.tsx`, `ResumenInteractivo.tsx`,
  `computeIndicadoresPorPersona`) — this plan adds a new, separate record-level view; it does
  not touch the existing person-level aggregate view.
- **Query shape:** `episodios` ordered by `fecha_inicio` descending, `.limit(200)` — same
  exact pattern as `/plataforma/auditoria` (`app/plataforma/auditoria/page.tsx:14`). No date
  range filter.
- **Filters:** exactly two, both client-side over the already-fetched 200 rows — tipo
  administrativo and estado. No sucursal/unidad/cargo/turno filter, no código search, no
  pagination beyond the 200-row cap.
- **`/plataforma/ausencias` nav entry uses `adminOnly: true`** — same as every other
  admin-only page in this project (Encuestas, Alertas, Seguridad laboral, Ergonomía,
  Intervenciones, Campañas, Profesionales, Bienestar preventivo). The route itself does not
  re-check the role server-side, matching that exact precedent — this is not the
  `PersonaDetalleTable` case (that component does check the role explicitly, but only because
  it lives inside `/plataforma/resumen`, a page non-admins can already visit).
- **No `MIN_GROUP_SIZE` suppression.** Each row is already a single person's single episode —
  same rationale already established for `PersonaDetalleTable`: small-group suppression
  exists to prevent reidentification from an aggregate, not to gate an operational tool for
  someone who already administers these people directly.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required
  exact invocation on this machine (default heap OOMs).
- No unit test for the page or the new table component — matches the established pattern (no
  `/plataforma/*` page and no table component like `AuditoriaTable.tsx` has a test file in
  this project).

---

## File Structure

```
components/platform/ausencias/AusenciasTable.tsx    (CREATE — client component, table + filters)
components/platform/Sidebar.tsx                      (MODIFY — new nav entry)
app/plataforma/ausencias/page.tsx                    (CREATE — the page, the query)
```

---

### Task 1: Componente de tabla + entrada de navegación

**Files:**
- Create: `components/platform/ausencias/AusenciasTable.tsx`
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing from another task in this plan — this component takes only its own props.
- Produces: `AusenciasTable` (default export style: named export `AusenciasTable`) and the
  type `EpisodioFila` it accepts, both imported by Task 2's page. `EpisodioFila` is exactly:

```ts
export type EpisodioFila = {
  id: string
  personaCodigo: string
  tipoAdministrativoNombre: string
  fechaInicio: string
  fechaFin: string | null
  dias: number
  estado: 'abierto' | 'cerrado'
  clasificacionAnalitica: import('@/lib/ingestion/types').ClasificacionAnalitica
}
```

Also produces: the Sidebar nav entry `{ href: '/plataforma/ausencias', label: 'Ausencias y licencias', adminOnly: true }`, which makes Task 2's route reachable from the UI (the route works without it, but is otherwise undiscoverable).

Real type this task depends on (for reference — import it, do not redefine it):

```ts
// lib/ingestion/types.ts
export type ClasificacionAnalitica =
  | 'corto' | 'mediano' | 'prolongado' | 'recurrente' | 'continuacion'
  | 'accidente' | 'enfermedad_profesional' | 'maternal' | 'cuidado_familiar'
  | 'sin_clasificar' | 'calidad_insuficiente'
```

- [ ] **Step 1: Create the table component**

Create `components/platform/ausencias/AusenciasTable.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import type { ClasificacionAnalitica } from '@/lib/ingestion/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CLASIFICACION_LABELS: Record<ClasificacionAnalitica, string> = {
  corto: 'Corto',
  mediano: 'Mediano',
  prolongado: 'Prolongado',
  recurrente: 'Recurrente',
  continuacion: 'Continuación',
  accidente: 'Accidente',
  enfermedad_profesional: 'Enfermedad profesional',
  maternal: 'Maternal',
  cuidado_familiar: 'Cuidado familiar',
  sin_clasificar: 'Sin clasificar',
  calidad_insuficiente: 'Calidad insuficiente',
}

export type EpisodioFila = {
  id: string
  personaCodigo: string
  tipoAdministrativoNombre: string
  fechaInicio: string
  fechaFin: string | null
  dias: number
  estado: 'abierto' | 'cerrado'
  clasificacionAnalitica: ClasificacionAnalitica
}

export function AusenciasTable({ episodios }: { episodios: EpisodioFila[] }) {
  const [tipoFiltro, setTipoFiltro] = useState('__todos__')
  const [estadoFiltro, setEstadoFiltro] = useState('__todos__')

  const tiposDisponibles = useMemo(
    () => Array.from(new Set(episodios.map((e) => e.tipoAdministrativoNombre))).sort(),
    [episodios]
  )

  const episodiosFiltrados = useMemo(
    () =>
      episodios.filter(
        (e) =>
          (tipoFiltro === '__todos__' || e.tipoAdministrativoNombre === tipoFiltro) &&
          (estadoFiltro === '__todos__' || e.estado === estadoFiltro)
      ),
    [episodios, tipoFiltro, estadoFiltro]
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="filtro-tipo" className="text-sm text-muted-foreground">
            Tipo administrativo
          </Label>
          <Select value={tipoFiltro} onValueChange={(valor) => setTipoFiltro(valor)}>
            <SelectTrigger id="filtro-tipo" className="w-full">
              <SelectValue>{(valor: string) => (valor === '__todos__' ? 'Todos' : valor)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos</SelectItem>
              {tiposDisponibles.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filtro-estado" className="text-sm text-muted-foreground">
            Estado
          </Label>
          <Select value={estadoFiltro} onValueChange={(valor) => setEstadoFiltro(valor)}>
            <SelectTrigger id="filtro-estado" className="w-full">
              <SelectValue>
                {(valor: string) => (valor === '__todos__' ? 'Todos' : valor === 'abierto' ? 'Abierto' : 'Cerrado')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos</SelectItem>
              <SelectItem value="abierto">Abierto</SelectItem>
              <SelectItem value="cerrado">Cerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {episodiosFiltrados.length} de {episodios.length} registros.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Persona</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha inicio</TableHead>
            <TableHead>Fecha fin</TableHead>
            <TableHead>Días</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Clasificación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {episodiosFiltrados.map((episodio) => (
            <TableRow key={episodio.id}>
              <TableCell>{episodio.personaCodigo}</TableCell>
              <TableCell>{episodio.tipoAdministrativoNombre}</TableCell>
              <TableCell>{episodio.fechaInicio}</TableCell>
              <TableCell>{episodio.fechaFin ?? '—'}</TableCell>
              <TableCell>{episodio.dias}</TableCell>
              <TableCell className="capitalize">{episodio.estado}</TableCell>
              <TableCell>{CLASIFICACION_LABELS[episodio.clasificacionAnalitica]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: Add the "Ausencias y licencias" nav entry to the Sidebar**

In `components/platform/Sidebar.tsx`, the `NAV_ITEMS` array currently starts with:

```ts
  { href: '/plataforma/resumen', label: 'Resumen', adminOnly: false },
  { href: '/plataforma/reportes', label: 'Reportes', adminOnly: false },
```

Add a new entry directly after the "Resumen" line:

```ts
  { href: '/plataforma/resumen', label: 'Resumen', adminOnly: false },
  { href: '/plataforma/ausencias', label: 'Ausencias y licencias', adminOnly: true },
  { href: '/plataforma/reportes', label: 'Reportes', adminOnly: false },
```

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add components/platform/ausencias/AusenciasTable.tsx components/platform/Sidebar.tsx
git commit -m "feat: add ausencias table component and nav entry"
```

---

### Task 2: Página de Ausencias y Licencias

**Files:**
- Create: `app/plataforma/ausencias/page.tsx`

**Interfaces:**
- Consumes: `AusenciasTable` and `EpisodioFila` (from `components/platform/ausencias/AusenciasTable.tsx`, Task 1). `mapEpisodioRow` (`lib/ingestion/types.ts`) — returns `Episodio` with fields `id, tenantId, personaId, createdAt, importacionId, tipoAdministrativoId, fechaInicio, fechaFin, dias, clasificacionAnalitica, estado` (see exact row shape below). `mapEmpresaRow` (`lib/platform/types.ts`) — same as used by `app/plataforma/reportes/page.tsx` and `app/plataforma/bienestar/page.tsx`.
- Produces: nothing consumed by a later task — this is the last code task in this plan.

Real shapes this task depends on (for reference, do not redefine these — import them):

```ts
// lib/ingestion/types.ts
export type Episodio = {
  id: string
  tenantId: string
  personaId: string
  createdAt: string
  importacionId: string | null
  tipoAdministrativoId: string
  fechaInicio: string
  fechaFin: string | null
  dias: number
  clasificacionAnalitica: ClasificacionAnalitica
  estado: 'abierto' | 'cerrado'
}
export function mapEpisodioRow(row: {
  id: string
  tenant_id: string
  persona_id: string
  created_at: string
  importacion_id: string | null
  tipo_administrativo_id: string
  fecha_inicio: string
  fecha_fin: string | null
  dias: number
  clasificacion_analitica: ClasificacionAnalitica
  estado: 'abierto' | 'cerrado'
}): Episodio

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
needed): `episodios` has RLS policy `episodios_select_same_tenant` (`for select to
authenticated using (tenant_id = auth_tenant_id())`) and `grant select ... on episodios to
authenticated` — the regular (non-admin) Supabase client can already read every episode row
belonging to the caller's tenant. `tipos_administrativos` has `grant select on
tipos_administrativos to authenticated` with no RLS restriction beyond that (it's a shared,
non-tenant-scoped catalog of 12 fixed rows) — readable with the regular client too.

- [ ] **Step 1: Write the page**

Create `app/plataforma/ausencias/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow } from '@/lib/platform/types'
import { mapEpisodioRow } from '@/lib/ingestion/types'
import { AusenciasTable, type EpisodioFila } from '@/components/platform/ausencias/AusenciasTable'

export default async function AusenciasPage() {
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

  const { data: personaRows } = await supabase.from('personas').select('id, codigo').eq('empresa_id', empresa.id)
  const personas = (personaRows ?? []).map((row) => ({ id: row.id as string, codigo: row.codigo as string }))
  const personaIds = personas.map((p) => p.id)

  const { data: tipoRows } = await supabase.from('tipos_administrativos').select('id, nombre')
  const tipos = (tipoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))

  const { data: episodioRows } =
    personaIds.length > 0
      ? await supabase
          .from('episodios')
          .select('*')
          .in('persona_id', personaIds)
          .order('fecha_inicio', { ascending: false })
          .limit(200)
      : { data: [] }
  const episodios = (episodioRows ?? []).map(mapEpisodioRow)

  const episodiosFilas: EpisodioFila[] = episodios.map((episodio) => ({
    id: episodio.id,
    personaCodigo: personas.find((p) => p.id === episodio.personaId)?.codigo ?? episodio.personaId,
    tipoAdministrativoNombre:
      tipos.find((t) => t.id === episodio.tipoAdministrativoId)?.nombre ?? episodio.tipoAdministrativoId,
    fechaInicio: episodio.fechaInicio,
    fechaFin: episodio.fechaFin,
    dias: episodio.dias,
    estado: episodio.estado,
    clasificacionAnalitica: episodio.clasificacionAnalitica,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Ausencias y licencias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registros más recientes de {empresa.nombre} (máximo 200).
        </p>
      </div>
      <AusenciasTable episodios={episodiosFilas} />
    </div>
  )
}
```

Note: `usuarioRow` is fetched with `.select('id')` only and never read beyond the
existence/redirect check — same deliberate pattern already used in
`app/plataforma/bienestar/page.tsx` (fetched only to confirm the caller has a valid `usuarios`
row, never mapped since nothing here needs the mapped fields).

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass (no test was added or changed by this task).

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, and the route list printed at the end includes
`/plataforma/ausencias`. A full logged-in visual check is out of scope for this step (same
gap already documented for the Reportes and Bienestar Preventivo modules' equivalent steps —
no live Supabase credentials in this worktree/checkout); Task 3 covers that against the real
deployed environment.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/ausencias/page.tsx
git commit -m "feat: add ausencias y licencias page"
```

---

### Task 3: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user)
to run against the deployed/production environment after Tasks 1-2 are merged and deployed.
**This module has no database schema, so there is no "apply SQL to production Supabase" step
in this task** — same as Reportes and Bienestar Preventivo before it.

- [ ] **Step 1: Verify the page renders correctly with real production data**

Log in to production as an admin. Go to `/plataforma/ausencias`. Confirm: the row count shown
matches a manual count of `episodios` for that empresa in Supabase (capped at 200, most
recent first by `fecha_inicio`). Spot-check a few rows: persona código, tipo administrativo
name, dates, días, estado, and clasificación all look correct against the same rows viewed
directly in Supabase.

- [ ] **Step 2: Verify the filters work**

Pick a tipo administrativo from the dropdown and confirm the table narrows to only that type
(and the "X de Y registros" count updates). Do the same for estado (abierto/cerrado). Reset
both to "Todos" and confirm the full list returns.

- [ ] **Step 3: Confirm no other page's behavior changed**

Navigate to `/plataforma/resumen` and confirm `PersonaDetalleTable` (the per-person aggregate
view) still renders exactly as before — this plan never touched that file.

- [ ] **Step 4: Confirm non-admin visibility is correctly restricted**

If a non-admin test account is available, confirm "Ausencias y licencias" does **not** appear
in their sidebar (matches `adminOnly: true`). If no non-admin account is readily available,
skip this and note it as unverified rather than blocking on it.

- [ ] **Step 5: Report results to the user**

Summarize: page renders correct real data ✅/❌, filters work ✅/❌, Resumen unchanged ✅/❌,
non-admin sidebar visibility confirmed or noted as unverified. Ask the user which module from
`referencia/instrucciones2.txt` to tackle next.

---

## Self-Review Notes

- **Spec coverage:** listado de registros individuales con tipo/fechas/días/estado/clasificación
  ✅ (Task 2), "reincidencia" expuesta vía `clasificacionAnalitica` sin cálculo nuevo ✅ (Task
  1's `CLASIFICACION_LABELS`), filtros por tipo y estado ✅ (Task 1), tope de 200
  ordenado por fecha ✅ (Task 2), ruta `/plataforma/ausencias` con `adminOnly: true` ✅ (Task
  1 nav + Task 2 route), verificación manual de datos reales/filtros/no-regresión/visibilidad
  ✅ (Task 3). Explícitamente-fuera-de-alcance del spec (evolución mensual, filtro de período,
  filtro organizacional, búsqueda por código, paginación real, escritura) no se implementa en
  ninguna tarea, coincide con el spec.
- **Placeholder scan:** sin TBD/TODO; cada paso tiene código completo.
- **Type consistency:** `Episodio`/`mapEpisodioRow`, `Empresa`/`mapEmpresaRow`, y
  `ClasificacionAnalitica` se usan idénticamente a como están definidos en los archivos reales
  ya existentes (verificado leyendo `lib/ingestion/types.ts`, `lib/platform/types.ts`, y
  `supabase/schema.sql` directamente). `EpisodioFila` (definido en Task 1, consumido en Task
  2) tiene los mismos nombres de campo en ambas tareas. No se introduce ningún tipo nuevo que
  pueda desviarse.
