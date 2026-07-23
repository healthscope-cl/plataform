# Reportes (Reporte Ejecutivo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a printable "Reporte Ejecutivo" page at `/plataforma/reportes` that aggregates data already computed by existing modules (índice de suficiencia, 6 indicadores clave, alertas activas, seguridad laboral, campañas activas) into one clean, print-friendly view. No new database table.

**Architecture:** Unlike every prior module in this roadmap, this plan adds **no table and no RLS**. It reuses `calcularIndiceSuficiencia()`, `computeIndicadores()`, `evaluarReglas()`, `SuficienciaBanner`, and `AlertasBanner` **completely unmodified**, adds two small new presentational components, and makes a minimal `print:hidden` change to the two shared layout components (`Sidebar.tsx`, `Topbar.tsx`) so the report prints cleanly without app chrome.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr`), Tailwind v4 (`print:` variant), browser-native `window.print()`.

## Global Constraints

- **No new database table, no RLS changes.** This module is a read-only aggregation view over data already produced by `personas`, `episodios`, `reglas_alerta`, `eventos_seguridad`, `campanas` — all of which already have their own RLS from prior plans.
- **Do not modify** `calcularIndiceSuficiencia()`, `computeIndicadores()`, `evaluarReglas()`, `SuficienciaBanner`, or `AlertasBanner` — import and use them exactly as they exist today.
- The `Sidebar.tsx`/`Topbar.tsx` change in Task 1 must be **exactly one added class token each** (`print:hidden`) plus one new nav array entry in `Sidebar.tsx` — nothing else in either file should change. These are shared layout files used by every `/plataforma/*` page; keep the diff minimal and low-risk.
- The `/plataforma/reportes` nav entry uses `adminOnly: false` (same as `/plataforma/resumen`) — this is a read-only page, not gated to admins.
- Neither the eventos_seguridad summary nor the campañas activas summary is period-filtered — both are current-status snapshots (matches the spec's literal wording), not scoped to the report's 6-month período like the ausentismo indicators are.
- No PDF-generation library or service — printing is via the browser's native `window.print()`, matching how this project already produces PDFs for `docs/entregables/`.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required exact invocation on this machine (default heap OOMs).

---

## File Structure

```
components/platform/Sidebar.tsx                            (MODIFY — print:hidden + nav entry)
components/platform/Topbar.tsx                              (MODIFY — print:hidden)
components/platform/reportes/IndicadoresResumenTabla.tsx    (CREATE — indicator table)
components/platform/reportes/ImprimirButton.tsx             (CREATE — window.print() trigger)
app/plataforma/reportes/page.tsx                            (CREATE — the report page)
```

---

### Task 1: Print-hiding on shared layout + nav entry

**Files:**
- Modify: `components/platform/Sidebar.tsx`
- Modify: `components/platform/Topbar.tsx`

**Interfaces:**
- No new exports. `Sidebar` and `Topbar`'s existing prop signatures are unchanged.

- [ ] **Step 1: Add `print:hidden` and the nav entry to `components/platform/Sidebar.tsx`**

Current file:

```tsx
import Link from 'next/link'
import { isAdminRole } from '@/lib/platform/roles'

const NAV_ITEMS = [
  { href: '/plataforma/resumen', label: 'Resumen', adminOnly: false },
  { href: '/plataforma/alertas', label: 'Alertas', adminOnly: true },
  { href: '/plataforma/encuestas', label: 'Encuestas', adminOnly: true },
  { href: '/plataforma/seguridad', label: 'Seguridad laboral', adminOnly: true },
  { href: '/plataforma/ergonomia', label: 'Ergonomía', adminOnly: true },
  { href: '/plataforma/intervenciones', label: 'Intervenciones', adminOnly: true },
  { href: '/plataforma/campanas', label: 'Campañas', adminOnly: true },
  { href: '/plataforma/profesionales', label: 'Profesionales', adminOnly: true },
  { href: '/plataforma/organizacion', label: 'Organización', adminOnly: true },
  { href: '/plataforma/importar', label: 'Importar datos', adminOnly: true },
  { href: '/plataforma/importar/historial', label: 'Historial de importaciones', adminOnly: true },
  { href: '/plataforma/usuarios', label: 'Usuarios y permisos', adminOnly: true },
  { href: '/plataforma/auditoria', label: 'Auditoría', adminOnly: true },
] as const

export function Sidebar({ rolClave }: { rolClave: string }) {
  const isAdmin = isAdminRole(rolClave)

  return (
    <nav className="w-60 shrink-0 border-r border-border bg-card p-4">
      <ul className="space-y-1">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

Change it to exactly this (two changes: the added `reportes` entry right after `resumen`, and `print:hidden` appended to the `<nav>` className):

```tsx
import Link from 'next/link'
import { isAdminRole } from '@/lib/platform/roles'

const NAV_ITEMS = [
  { href: '/plataforma/resumen', label: 'Resumen', adminOnly: false },
  { href: '/plataforma/reportes', label: 'Reportes', adminOnly: false },
  { href: '/plataforma/alertas', label: 'Alertas', adminOnly: true },
  { href: '/plataforma/encuestas', label: 'Encuestas', adminOnly: true },
  { href: '/plataforma/seguridad', label: 'Seguridad laboral', adminOnly: true },
  { href: '/plataforma/ergonomia', label: 'Ergonomía', adminOnly: true },
  { href: '/plataforma/intervenciones', label: 'Intervenciones', adminOnly: true },
  { href: '/plataforma/campanas', label: 'Campañas', adminOnly: true },
  { href: '/plataforma/profesionales', label: 'Profesionales', adminOnly: true },
  { href: '/plataforma/organizacion', label: 'Organización', adminOnly: true },
  { href: '/plataforma/importar', label: 'Importar datos', adminOnly: true },
  { href: '/plataforma/importar/historial', label: 'Historial de importaciones', adminOnly: true },
  { href: '/plataforma/usuarios', label: 'Usuarios y permisos', adminOnly: true },
  { href: '/plataforma/auditoria', label: 'Auditoría', adminOnly: true },
] as const

export function Sidebar({ rolClave }: { rolClave: string }) {
  const isAdmin = isAdminRole(rolClave)

  return (
    <nav className="w-60 shrink-0 border-r border-border bg-card p-4 print:hidden">
      <ul className="space-y-1">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Add `print:hidden` to `components/platform/Topbar.tsx`**

Find the `<header>` element's `className`:

```tsx
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
```

Change it to:

```tsx
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3 print:hidden">
```

Nothing else in this file changes.

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/platform/Sidebar.tsx components/platform/Topbar.tsx
git commit -m "feat: hide sidebar and topbar when printing, add reportes nav entry"
```

---

### Task 2: Presentational components

**Files:**
- Create: `components/platform/reportes/IndicadoresResumenTabla.tsx`
- Create: `components/platform/reportes/ImprimirButton.tsx`

**Interfaces:**
- Consumes: `IndicadorResultados` type from `@/lib/indicators/aggregate`, `IndicadorValor` type from `@/lib/indicators/formulas`, `Button` from `@/components/ui/button`.
- Produces: `IndicadoresResumenTabla` (props: `indicadores: IndicadorResultados`) and `ImprimirButton` (no props) — both consumed by Task 3's `app/plataforma/reportes/page.tsx`.

- [ ] **Step 1: Create `components/platform/reportes/IndicadoresResumenTabla.tsx`**

```tsx
import type { IndicadorResultados } from '@/lib/indicators/aggregate'
import type { IndicadorValor } from '@/lib/indicators/formulas'

const FILAS: Array<{ clave: keyof IndicadorResultados; etiqueta: string; sufijo: string; prefijo?: boolean }> = [
  { clave: 'tasaAusentismo', etiqueta: 'Tasa de ausentismo', sufijo: '%' },
  { clave: 'frecuencia', etiqueta: 'Frecuencia', sufijo: '%' },
  { clave: 'severidad', etiqueta: 'Severidad', sufijo: ' días/episodio' },
  { clave: 'duracionPromedio', etiqueta: 'Duración promedio', sufijo: ' días' },
  { clave: 'reincidencia', etiqueta: 'Reincidencia', sufijo: '%' },
  { clave: 'costoEstimado', etiqueta: 'Costo estimado', sufijo: '', prefijo: true },
]

function formatearValor(resultado: IndicadorValor, prefijo?: boolean, sufijo?: string): string {
  if ('suprimido' in resultado) return 'Grupo insuficiente para mostrar'
  const numero = prefijo ? `$${resultado.valor.toLocaleString('es-CL')}` : resultado.valor.toFixed(1)
  return `${numero}${sufijo ?? ''}`
}

export function IndicadoresResumenTabla({ indicadores }: { indicadores: IndicadorResultados }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="py-2 font-medium text-muted-foreground">Indicador</th>
          <th className="py-2 font-medium text-muted-foreground">Valor</th>
        </tr>
      </thead>
      <tbody>
        {FILAS.map((fila) => (
          <tr key={fila.clave} className="border-b border-border/50">
            <td className="py-2 text-foreground">{fila.etiqueta}</td>
            <td className="py-2 text-foreground">
              {formatearValor(indicadores[fila.clave], fila.prefijo, fila.sufijo)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: Create `components/platform/reportes/ImprimirButton.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'

export function ImprimirButton() {
  return (
    <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
      Imprimir
    </Button>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors in the two new files (not yet imported anywhere, so no wiring errors expected either).

- [ ] **Step 4: Commit**

```bash
git add components/platform/reportes/IndicadoresResumenTabla.tsx components/platform/reportes/ImprimirButton.tsx
git commit -m "feat: add reportes presentational components"
```

---

### Task 3: Reporte Ejecutivo page

**Files:**
- Create: `app/plataforma/reportes/page.tsx`

**Interfaces:**
- Consumes: `IndicadoresResumenTabla` and `ImprimirButton` from Task 2 (exact prop shapes above); `calcularIndiceSuficiencia`, `SuficienciaBanner`, `computeIndicadores`, `mapReglaAlertaRow`, `evaluarReglas`, `AlertasBanner`, `mapEventoSeguridadRow`, `mapCampanaRow`, `mapUsuarioRow`/`mapRolRow`/`mapEmpresaRow` — all pre-existing, unmodified.
- Produces: the `/plataforma/reportes` route, reachable from the sidebar (wired in Task 1).

- [ ] **Step 1: Create `app/plataforma/reportes/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow, mapEmpresaRow } from '@/lib/platform/types'
import { computeIndicadores } from '@/lib/indicators/aggregate'
import { calcularIndiceSuficiencia } from '@/lib/suficiencia/calcular'
import { SuficienciaBanner } from '@/components/platform/dashboard/SuficienciaBanner'
import { mapReglaAlertaRow } from '@/lib/alertas/types'
import { evaluarReglas } from '@/lib/alertas/evaluar'
import { AlertasBanner } from '@/components/platform/dashboard/AlertasBanner'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { mapCampanaRow, type Campana } from '@/lib/campanas/types'
import { IndicadoresResumenTabla } from '@/components/platform/reportes/IndicadoresResumenTabla'
import { ImprimirButton } from '@/components/platform/reportes/ImprimirButton'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

const CAMPANA_TIPO_LABELS: Record<Campana['tipo'], string> = {
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

export default async function ReportesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase.from('usuarios').select('*, roles(*)').eq('id', user.id).single()
  if (!usuarioRow) redirect('/login')
  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
  const empresaId = empresa.id

  const periodoFin = new Date().toISOString().slice(0, 10)
  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  const { data: personaRows } = await supabase
    .from('personas')
    .select('id, codigo, unidad_id, cargo_id, turno_id')
    .eq('empresa_id', empresaId)
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

  const indicadores = computeIndicadores({ personas, episodios, costos: COSTOS_DEFAULT })

  const { data: sucursalRows } = await supabase.from('sucursales').select('id').eq('empresa_id', empresaId)
  const sucursalIds = (sucursalRows ?? []).map((row) => row.id as string)

  const { data: unidadRows } =
    sucursalIds.length > 0
      ? await supabase.from('unidades').select('id, nombre, sucursal_id').in('sucursal_id', sucursalIds)
      : { data: [] }
  const unidades = (unidadRows ?? []).map((row) => ({
    id: row.id as string,
    nombre: row.nombre as string,
    sucursalId: row.sucursal_id as string,
  }))

  const { data: reglaRows } = await supabase.from('reglas_alerta').select('*').eq('empresa_id', empresaId)
  const reglas = (reglaRows ?? []).map(mapReglaAlertaRow)

  const alertasDisparadas = evaluarReglas({
    reglas,
    personas,
    unidades,
    episodios,
    costos: COSTOS_DEFAULT,
  })

  const { data: eventoRows } = await supabase.from('eventos_seguridad').select('*').eq('empresa_id', empresaId)
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)
  const eventosPorEstado = { abierto: 0, en_seguimiento: 0, cerrado: 0 }
  for (const evento of eventos) {
    eventosPorEstado[evento.estado] += 1
  }

  const { data: campanaRows } = await supabase
    .from('campanas')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('estado', 'activa')
  const campanasActivas = (campanaRows ?? []).map(mapCampanaRow)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte Ejecutivo</h1>
          <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
          <p className="text-sm text-muted-foreground">
            Período: {periodoInicio} a {periodoFin}
          </p>
          <p className="text-xs text-muted-foreground">
            Generado el {new Date().toLocaleDateString('es-CL')} por {usuario.nombre}
          </p>
        </div>
        <ImprimirButton />
      </div>

      <SuficienciaBanner indice={indiceSuficiencia} />

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Indicadores clave</h2>
        <IndicadoresResumenTabla indicadores={indicadores} />
      </div>

      <AlertasBanner alertas={alertasDisparadas} />

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguridad laboral</h2>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          <li>Eventos abiertos: {eventosPorEstado.abierto}</li>
          <li>En seguimiento: {eventosPorEstado.en_seguimiento}</li>
          <li>Cerrados: {eventosPorEstado.cerrado}</li>
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Campañas activas</h2>
        {campanasActivas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin campañas activas.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {campanasActivas.map((campana) => (
              <li key={campana.id}>
                {campana.nombre} — {CAMPANA_TIPO_LABELS[campana.tipo]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

Notes:
- The `personas`/`episodios`/período/`indiceSuficiencia` block is copied verbatim from `app/plataforma/resumen/page.tsx`'s existing logic — same 6-month window, same flat-180-days `contratoDias` placeholder (a pre-existing simplification in this codebase, not something to "fix" here).
- `eventos_seguridad` and `campanas` queries are **not** period-filtered (see Global Constraints) — they reflect current status, not the report's 6-month window.
- `unidades` is fetched (via `sucursales` → `unidades`) solely because `evaluarReglas()` requires it as an input, even though this page never renders a sucursal/unidad picker itself.

- [ ] **Step 2: Typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run`
Expected: all existing tests still pass (no new tests in this plan — no new pure function).

- [ ] **Step 4: Manual smoke check (dev server)**

Run: `npm run dev` (or confirm it's already running), then navigate to `/plataforma/reportes` while logged in.
Expected: page loads showing empresa name, período, índice de suficiencia (or nothing if `estado === 'solido'`, since `SuficienciaBanner` returns `null` in that case), the 6-indicator table, alertas (if any), seguridad laboral counts, and campañas activas list (or "Sin campañas activas."); "Reportes" appears in the sidebar right after "Resumen", visible even to a non-admin test if one is available.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/reportes/page.tsx
git commit -m "feat: add reporte ejecutivo page"
```

---

### Task 4: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user) to run against the deployed/production environment after Tasks 1-3 are merged and deployed. **This module has no database schema, so there is no "apply SQL to production Supabase" step in this task — that's a first for this roadmap.**

- [ ] **Step 1: Verify the report renders correctly with real production data**

Log in to production as an admin. Go to `/plataforma/reportes`. Confirm: empresa name and período are correct; the 6-indicator table shows real numbers (or "Grupo insuficiente para mostrar" if suppressed); if there are any currently-active `reglas_alerta` whose condition is met, `AlertasBanner` shows them (cross-check against `/plataforma/alertas` and `/plataforma/resumen`, which should show the identical fired-alerts list, since both pages call the same `evaluarReglas()` with the same inputs); seguridad laboral counts match what's visible on `/plataforma/seguridad`; campañas activas list matches campaigns with `estado = 'activa'` on `/plataforma/campanas`.

- [ ] **Step 2: Verify print preview hides the sidebar and topbar on `/plataforma/reportes`**

With `/plataforma/reportes` open, trigger the browser's print preview (Ctrl+P, or click the in-page "Imprimir" button). Confirm the preview shows **only** the report content — no left sidebar, no top bar, no "Imprimir" button itself (it's `print:hidden`). Cancel the print dialog without actually printing/saving unless you want to keep a copy.

- [ ] **Step 3: Verify no other page's on-screen appearance changed**

Navigate to `/plataforma/resumen` (and optionally one or two other `/plataforma/*` pages). Confirm the sidebar and topbar look and behave exactly as before — `print:hidden` only takes effect in print media, so normal on-screen browsing must be visually identical to before this change.

- [ ] **Step 4: Confirm non-admin visibility**

If a non-admin test account is available, confirm "Reportes" appears in their sidebar (since `adminOnly: false`) and the page loads correctly for them, same as `/plataforma/resumen` already does. If no non-admin account is readily available, skip this and note it as unverified rather than blocking on it.

- [ ] **Step 5: Report results to the user**

Summarize: report content verified correct against real data ✅/❌, print preview correctly hides app chrome ✅/❌, other pages' on-screen appearance unchanged ✅/❌, non-admin visibility confirmed or noted as unverified. Ask the user which module from `referencia/instrucciones2.txt` to tackle next.

---

## Self-Review Notes

- **Spec coverage:** índice de suficiencia (reused unmodified) ✅, 6 indicadores clave in a new table (Task 2) ✅, alertas activas (reused unmodified) ✅, seguridad laboral summary (Task 3) ✅, campañas activas summary (Task 3) ✅, print button using `window.print()` (Task 2) ✅, `print:hidden` on Sidebar/Topbar (Task 1) ✅, nav entry with `adminOnly: false` (Task 1) ✅. Explicitly-out-of-scope items (the other 6 report types, server-side PDF generation, custom period selector, report history/persistence, scheduled email delivery) are not implemented anywhere in this plan, matching the spec.
- **Placeholder scan:** no TBD/TODO; every step has complete code.
- **Type consistency:** `IndicadorResultados`/`IndicadorValor` (from existing `lib/indicators`), `Campana` (from existing `lib/campanas/types`), and the new components' prop shapes are used identically across Tasks 2-3. No new types are introduced that could drift — everything is imported from already-shipped modules.
