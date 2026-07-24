# Empresa Activa (multiempresa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-existing `EmpresaSwitcher` in the Topbar functional, and make every page/route that reads or writes empresa-scoped data (19 pages + the import wizard) respect the empresa the user actually selected, instead of silently defaulting to the first empresa Postgres returns.

**Architecture:** A single server-side helper `getEmpresaActiva(supabase)` resolves "the active empresa" from a cookie (falling back to the tenant's first empresa), replacing the repeated `.limit(1)` block in every page. A new Route Handler lets the switcher persist the choice as a cookie. No schema change, no RLS change — `empresas` already supports multiple rows per tenant correctly.

**Tech Stack:** Next.js 16 App Router (Server Components + Route Handlers), `@supabase/ssr`, `next/headers` cookies, `@base-ui/react` Select (via `components/ui/select.tsx`).

## Global Constraints

- One empresa active at a time (not an aggregated multi-empresa view) — confirmed design decision.
- Persistence via cookie only (`empresa_activa`, httpOnly, `path: '/'`, 1 year) — no database migration, no new column on `usuarios`.
- Fallback behavior: if there is no cookie, or the cookie's empresa id is not one of the tenant's current empresas, resolve to the first empresa of the tenant — never show an error to the user for this case.
- With exactly one empresa in the tenant (today's only real case in production), behavior must be pixel-identical to today — `EmpresaSwitcher` already collapses to a plain label when `empresas.length <= 1`, this must keep working unchanged.
- Route Handlers, not Server Actions, for all mutations — this project's established convention (`app/api/platform/importaciones/ejecutar/route.ts`, `app/api/platform/importaciones/revertir/route.ts`, `app/api/platform/usuarios/invitar/route.ts`). Do not introduce Server Actions.
- `@base-ui/react` Select's `onValueChange` callback type is `(value: string | null) => void`, not `(value: string) => void`. Every `onValueChange` in this plan MUST guard with `v !== null`, never a truthiness check (`if (v)`) — a truthiness check silently drops a legitimately empty string value. This exact bug happened once already in this project (Ausencias y Licencias module) and was fixed; do not reintroduce it.
- Every "no empresa configured" guard message across the whole codebase uses the identical string `"Esta cuenta todavía no tiene una empresa configurada."` — keep using this exact string, do not reword it.

---

### Task 1: `getEmpresaActiva()` helper

**Files:**
- Create: `lib/platform/empresa-activa.ts`

**Interfaces:**
- Consumes: `Empresa` type and `mapEmpresaRow` from `lib/platform/types.ts` (already defined — `Empresa = { id: string; tenantId: string; createdAt: string; nombre: string; rut: string | null }`; `mapEmpresaRow(row: { id, tenant_id, created_at, nombre, rut }): Empresa`). `SupabaseClient` type from `@supabase/supabase-js` (same import already used in `lib/platform/audit.ts`).
- Produces: `getEmpresaActiva(supabase: SupabaseClient): Promise<Empresa | null>` — used by every later task. `COOKIE_EMPRESA_ACTIVA: string` (the exported cookie name constant) — used by Task 2's Route Handler.

This is the one piece of new logic in the whole plan; every other task is a mechanical call-site swap. There is no automated test for this function — it depends on `next/headers` cookies() and a live Supabase query, so (matching this project's established pattern of not testing Server-Component-adjacent code, e.g. no page in this project has an automated test) it is verified manually as part of Task 2's manual check, not with Vitest.

- [ ] **Step 1: Write the helper**

Create `lib/platform/empresa-activa.ts`:

```ts
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mapEmpresaRow, type Empresa } from './types'

export const COOKIE_EMPRESA_ACTIVA = 'empresa_activa'

export async function getEmpresaActiva(supabase: SupabaseClient): Promise<Empresa | null> {
  const { data: empresaRows } = await supabase.from('empresas').select('*')
  const empresas = (empresaRows ?? []).map(mapEmpresaRow)
  if (empresas.length === 0) return null

  const cookieStore = await cookies()
  const empresaIdCookie = cookieStore.get(COOKIE_EMPRESA_ACTIVA)?.value
  const activa = empresaIdCookie ? empresas.find((empresa) => empresa.id === empresaIdCookie) : undefined

  return activa ?? empresas[0]
}
```

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite (regression check — this task adds no new tests)**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass (112 tests as of the last module shipped).

- [ ] **Step 4: Commit**

```bash
git add lib/platform/empresa-activa.ts
git commit -m "feat: add getEmpresaActiva helper for empresa-activa resolution"
```

---

### Task 2: Route Handler + functional EmpresaSwitcher + layout wiring

**Files:**
- Create: `app/api/platform/empresa-activa/route.ts`
- Modify: `components/platform/EmpresaSwitcher.tsx`
- Modify: `components/platform/Topbar.tsx`
- Modify: `app/plataforma/layout.tsx`

**Interfaces:**
- Consumes: `getEmpresaActiva`, `COOKIE_EMPRESA_ACTIVA` from Task 1's `lib/platform/empresa-activa.ts`. `createClient` from `lib/supabase/server.ts`. Existing `Empresa` type.
- Produces: nothing consumed by later tasks — Tasks 3-6 only depend on Task 1's `getEmpresaActiva`, not on this task. This task is independently testable/mergeable and can be done in any order relative to Tasks 3-6.

This is the only user-facing behavior change in the whole plan: after this task, the switcher in the Topbar actually works. With today's production data (a single empresa in the demo tenant), this task's own manual test cannot exercise the "switch to a different empresa and see it persist" path — that requires a tenant with 2+ empresas, which does not exist in production today. Task 2's manual check below covers what CAN be verified with one empresa (no visible regression, switcher still collapses correctly); the full switch-between-two-empresas behavior is covered in Task 7's manual verification, to be run whenever a second empresa exists (dev/staging, or a future real customer).

- [ ] **Step 1: Write the Route Handler**

Create `app/api/platform/empresa-activa/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { COOKIE_EMPRESA_ACTIVA } from '@/lib/platform/empresa-activa'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { empresaId } = (await request.json()) as { empresaId: string }

  const { data: empresaValida } = await supabase.from('empresas').select('id').eq('id', empresaId).maybeSingle()

  if (!empresaValida) {
    return NextResponse.json({ error: 'Empresa no encontrada para este tenant.' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_EMPRESA_ACTIVA, empresaId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
```

Note on the validation query: `supabase` here is the regular RLS-scoped client (`createClient()`, not `createAdminClient()`). The `empresas` table's SELECT policy already scopes rows to the caller's own tenant (same RLS every other page in this project already relies on for `empresas`) — so if `empresaId` belongs to a different tenant, this query returns no row and `empresaValida` is `null`, correctly rejected with 400. No manual `tenant_id` check needed, unlike the admin-client-based validation in `app/api/platform/importaciones/ejecutar/route.ts` (that one uses `createAdminClient()`, which bypasses RLS, so it must check `tenant_id` manually — this handler doesn't bypass RLS, so it doesn't need to).

- [ ] **Step 2: Wire the EmpresaSwitcher to actually switch**

Replace the full content of `components/platform/EmpresaSwitcher.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import type { Empresa } from '@/lib/platform/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function EmpresaSwitcher({
  empresas,
  empresaActivaId,
}: {
  empresas: Empresa[]
  empresaActivaId: string
}) {
  const router = useRouter()

  if (empresas.length <= 1) {
    return (
      <span className="text-sm font-medium text-foreground">
        {empresas[0]?.nombre ?? 'Sin empresa'}
      </span>
    )
  }

  async function handleChange(empresaId: string | null) {
    if (empresaId === null) return
    await fetch('/api/platform/empresa-activa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId }),
    })
    router.refresh()
  }

  return (
    <Select value={empresaActivaId} onValueChange={handleChange}>
      <SelectTrigger className="w-48">
        <SelectValue>{(id: string) => empresas.find((empresa) => empresa.id === id)?.nombre ?? id}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {empresas.map((empresa) => (
          <SelectItem key={empresa.id} value={empresa.id}>
            {empresa.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 3: Pass `empresaActivaId` through the Topbar**

In `components/platform/Topbar.tsx`, replace:

```tsx
export function Topbar({
  usuario,
  rol,
  empresas,
}: {
  usuario: Usuario
  rol: Rol
  empresas: Empresa[]
}) {
```

with:

```tsx
export function Topbar({
  usuario,
  rol,
  empresas,
  empresaActivaId,
}: {
  usuario: Usuario
  rol: Rol
  empresas: Empresa[]
  empresaActivaId: string
}) {
```

And replace:

```tsx
      <EmpresaSwitcher empresas={empresas} />
```

with:

```tsx
      <EmpresaSwitcher empresas={empresas} empresaActivaId={empresaActivaId} />
```

- [ ] **Step 4: Resolve and pass the active empresa from the layout**

In `app/plataforma/layout.tsx`, add the import:

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*')
  const empresas = (empresaRows ?? []).map(mapEmpresaRow)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar rolClave={rol.clave} />
      <div className="flex flex-1 flex-col">
        <Topbar usuario={usuario} rol={rol} empresas={empresas} />
```

with:

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*')
  const empresas = (empresaRows ?? []).map(mapEmpresaRow)
  const empresaActiva = await getEmpresaActiva(supabase)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar rolClave={rol.clave} />
      <div className="flex flex-1 flex-col">
        <Topbar usuario={usuario} rol={rol} empresas={empresas} empresaActivaId={empresaActiva?.id ?? ''} />
```

(`layout.tsx` still fetches the full `empresas` list itself for the switcher's dropdown options — `getEmpresaActiva` does its own separate, tiny query to resolve just the one active empresa. Two small queries to the same table per page load is consistent with this project's existing style — e.g. `cargos`/`turnos`/`sucursales` are already independently re-queried by nearly every page rather than shared — not a new pattern.)

- [ ] **Step 5: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 6: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 7: Build check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, route list includes `/api/platform/empresa-activa`.

- [ ] **Step 8: Commit**

```bash
git add app/api/platform/empresa-activa/route.ts components/platform/EmpresaSwitcher.tsx components/platform/Topbar.tsx app/plataforma/layout.tsx
git commit -m "feat: wire EmpresaSwitcher to persist the active empresa via cookie"
```

---

### Task 3: Migrate 5 pages (id-only variant, batch A)

**Files:**
- Modify: `app/plataforma/alertas/page.tsx`
- Modify: `app/plataforma/campanas/page.tsx`
- Modify: `app/plataforma/encuestas/page.tsx`
- Modify: `app/plataforma/ergonomia/page.tsx`
- Modify: `app/plataforma/intervenciones/page.tsx`

**Interfaces:**
- Consumes: `getEmpresaActiva` from Task 1's `lib/platform/empresa-activa.ts`.
- Produces: nothing consumed by later tasks.

All 5 files share the exact same 5-line block today (confirmed byte-identical via `grep` across the whole codebase before writing this plan): a `.select('id').limit(1)` query, an `empresaId` derived from the first row, and a not-found guard. The fix is identical in each file: add the import, replace the block, and rename `empresaId` to come from `empresa.id` instead of the removed `empresas` array.

- [ ] **Step 1: `app/plataforma/alertas/page.tsx`**

Add to the imports (after the existing `mapUsuarioRow, mapRolRow` import line):

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id
```

- [ ] **Step 2: `app/plataforma/campanas/page.tsx`**

Add to the imports (after `mapUsuarioRow, mapRolRow`):

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id
```

- [ ] **Step 3: `app/plataforma/encuestas/page.tsx`**

Add to the imports (after `mapUsuarioRow, mapRolRow`):

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id
```

- [ ] **Step 4: `app/plataforma/ergonomia/page.tsx`**

Add to the imports (after `mapUsuarioRow, mapRolRow`):

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id
```

- [ ] **Step 5: `app/plataforma/intervenciones/page.tsx`**

Add to the imports (after `mapUsuarioRow, mapRolRow`):

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id
```

- [ ] **Step 6: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 7: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add app/plataforma/alertas/page.tsx app/plataforma/campanas/page.tsx app/plataforma/encuestas/page.tsx app/plataforma/ergonomia/page.tsx app/plataforma/intervenciones/page.tsx
git commit -m "refactor: use getEmpresaActiva in alertas, campanas, encuestas, ergonomia, intervenciones"
```

---

### Task 4: Migrate remaining id-only pages + the import wizard

**Files:**
- Modify: `app/plataforma/organizacion/page.tsx`
- Modify: `app/plataforma/profesionales/page.tsx`
- Modify: `app/plataforma/resumen/page.tsx`
- Modify: `app/plataforma/seguridad/page.tsx`
- Modify: `app/plataforma/importar/page.tsx`
- Modify: `app/api/platform/importaciones/ejecutar/route.ts`

**Interfaces:**
- Consumes: `getEmpresaActiva` from Task 1's `lib/platform/empresa-activa.ts`.
- Produces: nothing consumed by later tasks.

The first 4 files follow the exact same pattern as Task 3. The import wizard is different in kind: `app/plataforma/importar/page.tsx` is a **Client Component** (`'use client'` at the top) — it cannot call `getEmpresaActiva()` directly, because that function uses `cookies()` from `next/headers`, which is server-only. The correct fix here is to stop resolving `empresaId` on the client entirely and let the server-side Route Handler it already calls (`app/api/platform/importaciones/ejecutar/route.ts`) resolve the active empresa itself — that Route Handler already runs on the server and can call `getEmpresaActiva()`.

- [ ] **Step 1: `app/plataforma/organizacion/page.tsx`**

Add to the imports (the multi-line `mapSucursalRow, ...` import block already present):

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id
```

- [ ] **Step 2: `app/plataforma/profesionales/page.tsx`**

Add to the imports (after `mapUsuarioRow, mapRolRow`):

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id
```

- [ ] **Step 3: `app/plataforma/resumen/page.tsx`**

Add to the imports (after `mapUsuarioRow, mapRolRow`):

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id
```

- [ ] **Step 4: `app/plataforma/seguridad/page.tsx`**

Add to the imports (after `mapUsuarioRow, mapRolRow`):

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id
```

- [ ] **Step 5: `app/plataforma/importar/page.tsx`** — remove the client-side empresa resolution

Remove these lines from `handleEjecutar` (the client no longer resolves or sends `empresaId` — the server now decides):

```ts
    const supabase = createClient()
    const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
    const empresaId = empresas?.[0]?.id

```

And remove the now-unused `empresaId` from the fetch body — replace:

```ts
      body: JSON.stringify({
        archivoNombre: file.name,
        archivoHash,
        empresaId,
        forzarReimportacion,
        rows: mappedRows.filter((_, index) => !excludedRows.has(index)),
      }),
```

with:

```ts
      body: JSON.stringify({
        archivoNombre: file.name,
        archivoHash,
        forzarReimportacion,
        rows: mappedRows.filter((_, index) => !excludedRows.has(index)),
      }),
```

Since `createClient` (the client-side Supabase helper) is no longer used anywhere else in this file, also remove its now-unused import line:

```ts
import { createClient } from '@/lib/supabase/client'
```

- [ ] **Step 6: `app/api/platform/importaciones/ejecutar/route.ts`** — resolve the empresa server-side instead of trusting the client

Add the import:

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace the request body type (remove `empresaId` — the client no longer sends it):

```ts
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

  const admin = createAdminClient()

  const { data: empresaValida } = await admin
    .from('empresas')
    .select('id')
    .eq('id', body.empresaId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!empresaValida) {
    return NextResponse.json({ error: 'Empresa no encontrada para este tenant.' }, { status: 400 })
  }
```

with:

```ts
  const body = (await request.json()) as {
    archivoNombre: string
    archivoHash: string
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

  const empresaActiva = await getEmpresaActiva(supabase)
  if (!empresaActiva) {
    return NextResponse.json({ error: 'Esta cuenta todavía no tiene una empresa configurada.' }, { status: 400 })
  }
  const empresaId = empresaActiva.id

  const admin = createAdminClient()
```

(`getEmpresaActiva(supabase)` is called with the regular, RLS-scoped `supabase` client already created earlier in this handler — the same one used for the `caller`/`usuarios` lookup — not `admin`, matching Task 2's Route Handler, which resolves the same way.)

There are 4 remaining uses of `body.empresaId` further down this same file — replace each with the local `empresaId` variable now defined above:

Replace:

```ts
  const { data: sucursalRows } = await admin
    .from('sucursales')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', body.empresaId)
```

with:

```ts
  const { data: sucursalRows } = await admin
    .from('sucursales')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', empresaId)
```

Replace:

```ts
  const { data: cargoRows } = await admin
    .from('cargos')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', body.empresaId)
```

with:

```ts
  const { data: cargoRows } = await admin
    .from('cargos')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', empresaId)
```

Replace:

```ts
  const { data: turnoRows } = await admin
    .from('turnos')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', body.empresaId)
```

with:

```ts
  const { data: turnoRows } = await admin
    .from('turnos')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', empresaId)
```

Replace:

```ts
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
```

with:

```ts
      const { data: newPersona, error: personaError } = await admin
        .from('personas')
        .insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          codigo: row.codigoPersona ?? rutHash.slice(0, 8),
          rut_hash: rutHash,
          unidad_id: unidadId,
          cargo_id: cargoId,
          turno_id: turnoId,
        })
        .select()
        .single()
```

- [ ] **Step 7: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0. (This step will surface any `body.empresaId` occurrence missed in Step 6 as a type error, since `body` no longer has an `empresaId` field — treat any such error as a signal to finish replacing that occurrence, not as a pre-existing issue.)

- [ ] **Step 8: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 9: Commit**

```bash
git add app/plataforma/organizacion/page.tsx app/plataforma/profesionales/page.tsx app/plataforma/resumen/page.tsx app/plataforma/seguridad/page.tsx app/plataforma/importar/page.tsx app/api/platform/importaciones/ejecutar/route.ts
git commit -m "refactor: use getEmpresaActiva in organizacion, profesionales, resumen, seguridad, and the import wizard"
```

---

### Task 5: Migrate 4 reportes pages (full-row variant, batch A)

**Files:**
- Modify: `app/plataforma/reportes/ejecutivo/page.tsx`
- Modify: `app/plataforma/reportes/gerencia/page.tsx`
- Modify: `app/plataforma/ausencias/page.tsx`
- Modify: `app/plataforma/bienestar/page.tsx`

**Interfaces:**
- Consumes: `getEmpresaActiva` from Task 1's `lib/platform/empresa-activa.ts`.
- Produces: nothing consumed by later tasks.

These 4 files share the "full-row" variant: they call `mapEmpresaRow` directly and use the resulting `empresa` object (not just its id) for a display string (e.g. `empresa.nombre`) elsewhere in the page. The fix drops the manual `mapEmpresaRow` call — `getEmpresaActiva` already returns the mapped `Empresa` object — and removes `mapEmpresaRow` from each file's imports since it becomes unused there.

- [ ] **Step 1: `app/plataforma/reportes/ejecutivo/page.tsx`**

Replace the import line:

```ts
import { mapUsuarioRow, mapRolRow, mapEmpresaRow } from '@/lib/platform/types'
```

with:

```ts
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
  const empresaId = empresa.id
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresaId = empresa.id
```

- [ ] **Step 2: `app/plataforma/reportes/gerencia/page.tsx`**

Replace the import line:

```ts
import { mapEmpresaRow } from '@/lib/platform/types'
```

with:

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

- [ ] **Step 3: `app/plataforma/ausencias/page.tsx`**

Replace the import line:

```ts
import { mapEmpresaRow } from '@/lib/platform/types'
```

with:

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

- [ ] **Step 4: `app/plataforma/bienestar/page.tsx`**

Replace the import line:

```ts
import { mapEmpresaRow } from '@/lib/platform/types'
```

with:

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

- [ ] **Step 5: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 6: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add app/plataforma/reportes/ejecutivo/page.tsx app/plataforma/reportes/gerencia/page.tsx app/plataforma/ausencias/page.tsx app/plataforma/bienestar/page.tsx
git commit -m "refactor: use getEmpresaActiva in reportes ejecutivo, gerencia, ausencias, bienestar"
```

---

### Task 6: Migrate remaining reportes pages + recomendaciones

**Files:**
- Modify: `app/plataforma/reportes/prevencion/page.tsx`
- Modify: `app/plataforma/reportes/privacidad/page.tsx`
- Modify: `app/plataforma/reportes/recursos-humanos/page.tsx`
- Modify: `app/plataforma/reportes/campanas/page.tsx`
- Modify: `app/plataforma/recomendaciones/page.tsx`

**Interfaces:**
- Consumes: `getEmpresaActiva` from Task 1's `lib/platform/empresa-activa.ts`.
- Produces: nothing — this is the last task in the plan.

Same "full-row" variant as Task 5. Two of these files (`recursos-humanos`, `campanas`) additionally have a role gate (`isAdminRole`) that runs BEFORE the empresa block — that gate's position and logic must not change, only the empresa block below it.

- [ ] **Step 1: `app/plataforma/reportes/prevencion/page.tsx`**

Replace the import line:

```ts
import { mapEmpresaRow } from '@/lib/platform/types'
```

with:

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

- [ ] **Step 2: `app/plataforma/reportes/privacidad/page.tsx`**

Replace the import line:

```ts
import { mapEmpresaRow } from '@/lib/platform/types'
```

with:

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

- [ ] **Step 3: `app/plataforma/reportes/recursos-humanos/page.tsx`**

Replace the import line:

```ts
import { mapEmpresaRow, mapRolRow } from '@/lib/platform/types'
```

with:

```ts
import { mapRolRow } from '@/lib/platform/types'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace (this block comes AFTER the existing `isAdminRole` gate — leave that gate untouched, only replace the empresa block below it):

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

- [ ] **Step 4: `app/plataforma/reportes/campanas/page.tsx`**

Replace the import line:

```ts
import { mapEmpresaRow, mapRolRow } from '@/lib/platform/types'
```

with:

```ts
import { mapRolRow } from '@/lib/platform/types'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace (same as Step 3 — this comes after the existing `isAdminRole` gate, leave that untouched):

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

- [ ] **Step 5: `app/plataforma/recomendaciones/page.tsx`**

Replace the import line:

```ts
import { mapEmpresaRow } from '@/lib/platform/types'
```

with:

```ts
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
```

Replace:

```ts
  const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
  const empresaRow = empresaRows?.[0]
  if (!empresaRow) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
  const empresa = mapEmpresaRow(empresaRow)
```

with:

```ts
  const empresa = await getEmpresaActiva(supabase)
  if (!empresa) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }
```

- [ ] **Step 6: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 7: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 8: Build check (final — confirms every migrated route still compiles and lists correctly)**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, route list matches Task 2's build check (same routes, including `/api/platform/empresa-activa` — this task only changes internal query logic in existing pages, no route added or removed).

- [ ] **Step 9: Commit**

```bash
git add app/plataforma/reportes/prevencion/page.tsx app/plataforma/reportes/privacidad/page.tsx app/plataforma/reportes/recursos-humanos/page.tsx app/plataforma/reportes/campanas/page.tsx app/plataforma/recomendaciones/page.tsx
git commit -m "refactor: use getEmpresaActiva in remaining reportes pages and recomendaciones"
```

---

## Task 7: Manual verification (controller-only, deferred)

Not a code task — no subagent dispatch needed for this one. Left here as the checklist for whoever can log in with real credentials (this project's established pattern: the controller never authenticates on the user's behalf).

- [ ] With today's single-empresa tenant, confirm the Topbar still shows a plain label (not a dropdown) and every page still shows the same data as before this plan — no regression from having exactly one empresa.
- [ ] In a dev/staging environment (or by temporarily inserting a second `empresas` row for a test tenant), confirm: the Topbar shows a real dropdown with both empresas; switching selection updates every page's data (spot-check 3-4 pages across both variants, e.g. `ausencias`, `alertas`, `reportes/ejecutivo`) without a full page reload feeling broken; the choice survives a browser refresh (cookie persisted); switching back and forth doesn't leak the other empresa's data at any point.
- [ ] Confirm importing a new file via the wizard assigns the imported `personas`/`episodios` to whichever empresa is currently active (not always the first).
- [ ] Confirm a direct POST to `/api/platform/empresa-activa` with an `empresaId` from a different tenant is rejected with 400 (cannot be fully verified without a second tenant + second user session, but worth a quick attempt with an obviously-invalid random UUID, which must also be rejected with 400).
