# HealthScope Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the multi-tenant foundation of the private HealthScope platform — real
authentication, tenant/organization structure (empresas, sucursales, unidades, centros de
costo, cargos, turnos), roles/permissions, and an append-only audit log — so a logged-in user
can manage their organization's structure with role-gated access, fully isolated from other
tenants. This is the dependency root every later subsystem (import, episodes, dashboard,
alerts) builds on.

**Architecture:** Pure Next.js 16 (App Router) + Supabase (Postgres + Auth), no separate
backend service. This is a deliberate simplification from the NestJS direction discussed in
chat: the project already runs entirely on Next.js + Supabase (same as the Home page and as
`condor-crm`), already deploys to Vercel, and already has a live Supabase project connected.
Standing up a second service (NestJS) would mean deciding and wiring new hosting, CI and
secrets before writing a single domain feature — pure YAGNI for an MVP at this scale. Revisit
a standalone API only when Fase 4 (external integrations, third-party API consumers) actually
needs one.

Tenant isolation is enforced at the database level via Postgres RLS (the hard boundary, not
just app-side checks) using two `security definer` helper functions (`auth_tenant_id()`,
`auth_has_role()`). Almost all reads/writes go straight from client components through
`@supabase/ssr`'s browser client, same pattern the Home page already established for
`demo_requests`. The one operation that cannot go through RLS — provisioning a new Supabase
Auth user when an admin invites a teammate — goes through a single Route Handler using a
service-role client, isolated and clearly marked as the one privileged code path in this plan.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui
(`base-nova` style, already configured) + `@supabase/ssr` + `react-hook-form` + `zod` +
Vitest.

## Global Constraints

- This plan implements section 21 (subset), 10 and 18 of the master doc
  (`_source/inbstrucciones.txt`) — org structure, roles, platform nav shell, RBAC. It does
  **not** implement import, episodes, dashboard indicators, alerts or reports — those are
  separate future plans (see `2026-07-17-data-platform-mvp.md`).
- Platform UI lives under `/plataforma/*` (not `/app/*`, to avoid clashing with the Next.js
  `app/` router directory name, and not yet mapped to the `app.healthscope.cl` subdomain from
  the master doc — that's a deployment/DNS task, not a coding task, and is explicitly out of
  scope here).
- Platform UI uses **light backgrounds and shadcn semantic tokens** (`bg-background`,
  `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `bg-primary`) — this
  is a different visual mode from the marketing Home's hardcoded navy hex sections. Master doc
  section 5: "Plataforma diaria: fondos claros y descansados." Only use the brand hex tokens
  (`#00B8F5` cyan, `#1455E6` blue) for small accents (active nav indicator, focus rings already
  themed) — never a dark navy background in the platform shell.
- Every table that stores tenant data has a `tenant_id uuid not null references tenants(id)`
  column and RLS enabled with **no exceptions** — a table without RLS is a cross-tenant leak.
  Write the policy in the same migration step that creates the table, never as a follow-up.
- `@base-ui/react` quirks discovered while building the Home page (still apply here):
  `Button` has no `asChild` — use the `render={<a .../>}` prop instead, plus
  `nativeButton={false}` when the rendered host isn't a real `<button>`. Accordion has no
  `type="single" collapsible` — use `multiple={false}` (the default) and a typed array
  `defaultValue`.
- No Server Actions anywhere in this plan, and no privileged write path outside Task 9's
  Route Handler (user invite, which uses the service-role client because it must call the
  Supabase Admin API) — every other write goes through the browser Supabase client, relying
  on RLS as the enforcement boundary, same pattern as the Home page's demo form.
- All new shadcn primitives are added via the CLI (`npx shadcn@latest add <name>`), not hand
  written — Task 3 of the Home plan found hand-writing `form.tsx` was a process deviation; this
  plan avoids repeating it.
- WCAG 2.2 AA: visible focus rings (already themed via `focus-visible:ring-ring/50` on shared
  primitives), labeled form fields, keyboard-operable tables/menus — no new custom widgets that
  bypass this.
- Every step that changes code shows the code. No "similar to Task N", no TODOs.

## File Structure

```
supabase/
  schema.sql                      (MODIFY — append platform tables, in order, below demo_requests)
lib/
  supabase/
    admin.ts                      (CREATE — service-role client, server-only import)
  platform/
    types.ts                      (CREATE — shared TS types for every platform entity)
    audit.ts                      (CREATE — logAudit() helper + tests)
    permissions.ts                (CREATE — role-check helpers + tests)
    roles.ts                      (CREATE — the 13 role keys as a typed const + tests)
app/
  login/
    page.tsx                      (REWRITE — real Supabase Auth login form)
  plataforma/
    layout.tsx                    (CREATE — auth-gated shell: sidebar + topbar)
    resumen/page.tsx               (CREATE — placeholder landing, proves the shell works)
    organizacion/
      page.tsx                    (CREATE — tabs: Sucursales / Unidades / Centros de costo / Cargos / Turnos)
    usuarios/page.tsx              (CREATE — list + invite + role change + deactivate)
    auditoria/page.tsx             (CREATE — audit log viewer)
  api/
    platform/
      usuarios/
        invitar/route.ts          (CREATE — the one privileged Route Handler, service-role)
proxy.ts                           (CREATE — protects /plataforma/**, redirects to /login)
components/
  platform/
    Sidebar.tsx                   (CREATE)
    Topbar.tsx                    (CREATE)
    EmpresaSwitcher.tsx            (CREATE)
    SucursalesTable.tsx            (CREATE)
    SucursalSheet.tsx              (CREATE — create/edit form)
    UnidadesTable.tsx              (CREATE)
    UnidadSheet.tsx                (CREATE)
    CentrosCostoTable.tsx          (CREATE)
    CentroCostoSheet.tsx           (CREATE)
    CargosTable.tsx                (CREATE)
    CargoSheet.tsx                 (CREATE)
    TurnosTable.tsx                (CREATE)
    TurnoSheet.tsx                 (CREATE)
    UsuariosTable.tsx              (CREATE)
    InvitarUsuarioSheet.tsx        (CREATE)
    AuditoriaTable.tsx             (CREATE)
  ui/
    table.tsx, select.tsx, dialog.tsx, dropdown-menu.tsx, badge.tsx  (CREATE — via shadcn CLI)
```

---

### Task 1: Schema — tenants and organization structure

**Files:**
- Modify: `supabase/schema.sql` (append)
- Create: `lib/platform/types.ts`

**Interfaces:**
- Produces: SQL tables `tenants`, `empresas`, `sucursales`, `unidades`, `centros_costo`,
  `cargos`, `turnos`. TS types `Tenant`, `Empresa`, `Sucursal`, `Unidad`, `CentroCosto`,
  `Cargo`, `Turno` in `lib/platform/types.ts` — every later task importing org-structure
  types imports from here, field names match the SQL columns exactly (camelCase in TS, the
  Supabase client returns snake_case from Postgres, so every type also gets a
  `mapRow*()` function that converts snake_case DB rows to the camelCase TS type).

- [ ] **Step 1: Append the org-structure schema to `supabase/schema.sql`**

Append after the existing `demo_requests` block:

```sql
-- ============================================================
-- PLATFORM: tenants and organization structure
-- ============================================================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  estado text not null default 'activo' check (estado in ('activo', 'suspendido'))
);

alter table tenants enable row level security;

create table empresas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  rut text
);

alter table empresas enable row level security;

create table sucursales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  ciudad text
);

alter table sucursales enable row level security;

create table unidades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null
);

alter table unidades enable row level security;

create table centros_costo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  codigo text not null,
  nombre text not null
);

alter table centros_costo enable row level security;

create table cargos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null
);

alter table cargos enable row level security;

create table turnos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  hora_inicio time,
  hora_fin time
);

alter table turnos enable row level security;
```

RLS policies for these tables are written in Task 2, after the role-check helper function
exists — writing them here would reference a function that doesn't exist yet, and every one
of these tables has RLS *enabled* already (so they deny all access until Task 2 adds
policies, which is the safe default — never leave a window where RLS is off).

- [ ] **Step 2: Create `lib/platform/types.ts`**

```typescript
export type Tenant = {
  id: string
  createdAt: string
  nombre: string
  estado: 'activo' | 'suspendido'
}

export type Empresa = {
  id: string
  tenantId: string
  createdAt: string
  nombre: string
  rut: string | null
}

export type Sucursal = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  nombre: string
  ciudad: string | null
}

export type Unidad = {
  id: string
  tenantId: string
  sucursalId: string
  createdAt: string
  nombre: string
}

export type CentroCosto = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  codigo: string
  nombre: string
}

export type Cargo = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  nombre: string
}

export type Turno = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  nombre: string
  horaInicio: string | null
  horaFin: string | null
}

export function mapSucursalRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  nombre: string
  ciudad: string | null
}): Sucursal {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    nombre: row.nombre,
    ciudad: row.ciudad,
  }
}

export function mapUnidadRow(row: {
  id: string
  tenant_id: string
  sucursal_id: string
  created_at: string
  nombre: string
}): Unidad {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sucursalId: row.sucursal_id,
    createdAt: row.created_at,
    nombre: row.nombre,
  }
}

export function mapCentroCostoRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  codigo: string
  nombre: string
}): CentroCosto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    codigo: row.codigo,
    nombre: row.nombre,
  }
}

export function mapCargoRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  nombre: string
}): Cargo {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    nombre: row.nombre,
  }
}

export function mapTurnoRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  nombre: string
  hora_inicio: string | null
  hora_fin: string | null
}): Turno {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    nombre: row.nombre,
    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql lib/platform/types.ts
git commit -m "feat: add org-structure schema and shared platform types"
```

---

### Task 2: Schema — usuarios, roles, auditoría, RLS helper functions and policies

**Files:**
- Modify: `supabase/schema.sql` (append)
- Modify: `lib/platform/types.ts` (append `Usuario`, `Rol`, `Auditoria` types)
- Create: `lib/platform/roles.ts`
- Test: `lib/platform/roles.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: SQL tables `roles`, `usuarios`, `auditoria`; SQL functions `auth_tenant_id()`
  and `auth_has_role(claves text[])`; RLS policies on every table from Task 1 plus these
  three. TS: `ROLE_KEYS` (readonly array of the 13 role slugs), `ADMIN_ROLE_KEYS` (the 2 keys
  allowed to edit org structure), both from `lib/platform/roles.ts` — Task 5+ imports
  `ADMIN_ROLE_KEYS` for RLS-consistent client-side UI gating (hiding edit buttons for
  non-admins, purely a UX nicety — RLS is still the actual enforcement).

- [ ] **Step 1: Append roles, usuarios, auditoría and the RLS helper functions**

```sql
-- ============================================================
-- PLATFORM: roles, usuarios, auditoría, RLS helpers
-- ============================================================

create table roles (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  descripcion text not null
);

alter table roles enable row level security;

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  nombre text not null,
  email text not null,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  rol_id uuid not null references roles(id)
);

alter table usuarios enable row level security;

create table auditoria (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  actor_id uuid not null references usuarios(id),
  entidad text not null,
  entidad_id uuid not null,
  accion text not null check (accion in ('crear', 'actualizar', 'eliminar')),
  datos_antes jsonb,
  datos_despues jsonb
);

alter table auditoria enable row level security;

-- Returns the tenant of the currently authenticated user. security definer so it can read
-- `usuarios` even though `usuarios` itself has RLS enabled (this function is the one
-- controlled bypass; it never returns data, only the caller's own tenant_id).
create function auth_tenant_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select tenant_id from usuarios where id = auth.uid()
$$;

-- Returns true if the current user's role matches one of the given role keys.
create function auth_has_role(claves text[]) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from usuarios u
    join roles r on r.id = u.rol_id
    where u.id = auth.uid() and r.clave = any(claves)
  )
$$;

-- roles: readable by any authenticated user (needed to render role names in the usuarios
-- table and the invite form's role picker), never writable from the client — role catalog
-- changes are a manual/seed operation, not a product feature in the MVP.
create policy "roles_select_authenticated" on roles
  for select to authenticated using (true);

-- usuarios: a user can see every usuario in their own tenant (needed for the Usuarios page),
-- but only admin roles can insert/update/delete — and insert is in practice never called
-- from the client (see Task 9's Route Handler), this policy exists so the constraint is
-- enforced at the database even if a future code path tries to bypass the Route Handler.
create policy "usuarios_select_same_tenant" on usuarios
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "usuarios_update_admin_same_tenant" on usuarios
  for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id());

-- auditoria: append-only. Any authenticated user in the tenant can insert a row for their
-- own actor_id (the app calls this right after every mutation); nobody can update or delete
-- (no policy for those actions = denied by default with RLS enabled); only superadmin and
-- auditor can read the full log.
create policy "auditoria_insert_own_actor" on auditoria
  for insert to authenticated
  with check (tenant_id = auth_tenant_id() and actor_id = auth.uid());

create policy "auditoria_select_admin_auditor" on auditoria
  for select to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente', 'auditor']));

-- tenants: a user can see only their own tenant row (used by EmpresaSwitcher/Topbar to show
-- the tenant name); no client-side insert/update — tenant provisioning is controller-only.
create policy "tenants_select_own" on tenants
  for select to authenticated using (id = auth_tenant_id());

-- empresas: readable by anyone in the tenant, writable only by admin roles.
create policy "empresas_select_same_tenant" on empresas
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "empresas_write_admin" on empresas
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

-- sucursales / unidades / centros_costo / cargos / turnos: same shape — read by anyone in
-- the tenant, write only by admin roles.
create policy "sucursales_select_same_tenant" on sucursales
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "sucursales_write_admin" on sucursales
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "unidades_select_same_tenant" on unidades
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "unidades_write_admin" on unidades
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "centros_costo_select_same_tenant" on centros_costo
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "centros_costo_write_admin" on centros_costo
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "cargos_select_same_tenant" on cargos
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "cargos_write_admin" on cargos
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

create policy "turnos_select_same_tenant" on turnos
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "turnos_write_admin" on turnos
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

-- Seed the 13 roles from the master doc (section 18). Fixed catalog — clave is the stable
-- key the app code checks against, nombre is what's shown in the UI.
insert into roles (clave, nombre, descripcion) values
  ('superadmin', 'Superadministrador', 'Acceso total, incluye soporte HealthScope'),
  ('admin_cliente', 'Administrador cliente', 'Administra la cuenta de la empresa cliente'),
  ('rrhh_corporativo', 'RR.HH. corporativo', 'Ve y gestiona todas las sucursales'),
  ('rrhh_local', 'RR.HH. local', 'Ve y gestiona su sucursal'),
  ('gerencia', 'Gerencia', 'Ve información agregada, compara áreas y períodos'),
  ('jefatura', 'Jefatura', 'Ve información agregada de su área, recibe alertas'),
  ('prevencion', 'Prevención', 'Administra campañas e intervenciones preventivas'),
  ('salud_ocupacional', 'Salud ocupacional', 'Prioriza evaluaciones y coordina derivaciones'),
  ('prestador', 'Prestador', 'Acceso limitado a casos derivados'),
  ('profesional', 'Profesional', 'Acceso limitado a sus atenciones'),
  ('auditor', 'Auditor', 'Solo lectura, incluye el log de auditoría completo'),
  ('trabajador', 'Trabajador', 'Accede a campañas, encuestas y su propia información'),
  ('solo_lectura', 'Solo lectura', 'Ve el dashboard y reportes sin poder editar nada');
```

- [ ] **Step 2: Append `Usuario`, `Rol`, `Auditoria` types to `lib/platform/types.ts`**

Append to the same file created in Task 1:

```typescript
export type Rol = {
  id: string
  clave: string
  nombre: string
  descripcion: string
}

export type Usuario = {
  id: string
  tenantId: string
  createdAt: string
  nombre: string
  email: string
  estado: 'activo' | 'inactivo'
  rolId: string
}

export type Auditoria = {
  id: string
  tenantId: string
  createdAt: string
  actorId: string
  entidad: string
  entidadId: string
  accion: 'crear' | 'actualizar' | 'eliminar'
  datosAntes: unknown
  datosDespues: unknown
}

export function mapUsuarioRow(row: {
  id: string
  tenant_id: string
  created_at: string
  nombre: string
  email: string
  estado: 'activo' | 'inactivo'
  rol_id: string
}): Usuario {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    nombre: row.nombre,
    email: row.email,
    estado: row.estado,
    rolId: row.rol_id,
  }
}

export function mapAuditoriaRow(row: {
  id: string
  tenant_id: string
  created_at: string
  actor_id: string
  entidad: string
  entidad_id: string
  accion: 'crear' | 'actualizar' | 'eliminar'
  datos_antes: unknown
  datos_despues: unknown
}): Auditoria {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    actorId: row.actor_id,
    entidad: row.entidad,
    entidadId: row.entidad_id,
    accion: row.accion,
    datosAntes: row.datos_antes,
    datosDespues: row.datos_despues,
  }
}
```

- [ ] **Step 3: Create `lib/platform/roles.ts`**

```typescript
export const ROLE_KEYS = [
  'superadmin',
  'admin_cliente',
  'rrhh_corporativo',
  'rrhh_local',
  'gerencia',
  'jefatura',
  'prevencion',
  'salud_ocupacional',
  'prestador',
  'profesional',
  'auditor',
  'trabajador',
  'solo_lectura',
] as const

export type RoleKey = (typeof ROLE_KEYS)[number]

export const ADMIN_ROLE_KEYS: readonly RoleKey[] = ['superadmin', 'admin_cliente']

export function isAdminRole(clave: string): boolean {
  return (ADMIN_ROLE_KEYS as readonly string[]).includes(clave)
}
```

- [ ] **Step 4: Write `lib/platform/roles.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { ADMIN_ROLE_KEYS, isAdminRole, ROLE_KEYS } from './roles'

describe('roles', () => {
  it('has exactly the 13 roles from the master doc', () => {
    expect(ROLE_KEYS).toHaveLength(13)
    expect(ROLE_KEYS).toContain('superadmin')
    expect(ROLE_KEYS).toContain('solo_lectura')
  })

  it('isAdminRole is true only for superadmin and admin_cliente', () => {
    expect(isAdminRole('superadmin')).toBe(true)
    expect(isAdminRole('admin_cliente')).toBe(true)
    expect(isAdminRole('rrhh_local')).toBe(false)
    expect(isAdminRole('solo_lectura')).toBe(false)
  })

  it('ADMIN_ROLE_KEYS is a subset of ROLE_KEYS', () => {
    for (const key of ADMIN_ROLE_KEYS) {
      expect(ROLE_KEYS).toContain(key)
    }
  })
})
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/platform/roles.test.ts`
Expected: 3 passed (this machine OOMs on default heap size — see Home plan's Task 4 note;
use this exact invocation for every `vitest`/`tsc` run in this plan).

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql lib/platform/types.ts lib/platform/roles.ts lib/platform/roles.test.ts
git commit -m "feat: add roles/usuarios/auditoria schema, RLS policies and role helpers"
```

---

### Task 3: Audit logging helper

**Files:**
- Create: `lib/platform/audit.ts`
- Test: `lib/platform/audit.test.ts`

**Interfaces:**
- Consumes: `Auditoria` type shape from `lib/platform/types.ts` (Task 2), a Supabase client
  instance (browser or server, both share the same `.from().insert()` shape).
- Produces: `logAudit(supabase, params: LogAuditParams): Promise<void>` — every CRUD task
  (6, 7, 8) calls this immediately after a successful mutation with the exact signature
  `{ tenantId, actorId, entidad, entidadId, accion, datosAntes, datosDespues }`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/platform/audit.test.ts
import { describe, expect, it, vi } from 'vitest'
import { logAudit } from './audit'

describe('logAudit', () => {
  it('inserts one row into auditoria with the exact given fields', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ insert })
    const supabase = { from } as unknown as Parameters<typeof logAudit>[0]

    await logAudit(supabase, {
      tenantId: 'tenant-1',
      actorId: 'user-1',
      entidad: 'sucursales',
      entidadId: 'suc-1',
      accion: 'crear',
      datosAntes: null,
      datosDespues: { nombre: 'Sucursal Centro' },
    })

    expect(from).toHaveBeenCalledWith('auditoria')
    expect(insert).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      actor_id: 'user-1',
      entidad: 'sucursales',
      entidad_id: 'suc-1',
      accion: 'crear',
      datos_antes: null,
      datos_despues: { nombre: 'Sucursal Centro' },
    })
  })

  it('throws if the insert fails, so callers know the audit trail is incomplete', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    const from = vi.fn().mockReturnValue({ insert })
    const supabase = { from } as unknown as Parameters<typeof logAudit>[0]

    await expect(
      logAudit(supabase, {
        tenantId: 'tenant-1',
        actorId: 'user-1',
        entidad: 'sucursales',
        entidadId: 'suc-1',
        accion: 'eliminar',
        datosAntes: { nombre: 'Sucursal Centro' },
        datosDespues: null,
      })
    ).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/platform/audit.test.ts`
Expected: FAIL with "Cannot find module './audit'"

- [ ] **Step 3: Write `lib/platform/audit.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

type LogAuditParams = {
  tenantId: string
  actorId: string
  entidad: string
  entidadId: string
  accion: 'crear' | 'actualizar' | 'eliminar'
  datosAntes: unknown
  datosDespues: unknown
}

export async function logAudit(
  supabase: SupabaseClient,
  params: LogAuditParams
): Promise<void> {
  const { error } = await supabase.from('auditoria').insert({
    tenant_id: params.tenantId,
    actor_id: params.actorId,
    entidad: params.entidad,
    entidad_id: params.entidadId,
    accion: params.accion,
    datos_antes: params.datosAntes,
    datos_despues: params.datosDespues,
  })

  if (error) {
    throw new Error(error.message)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/platform/audit.test.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add lib/platform/audit.ts lib/platform/audit.test.ts
git commit -m "feat: add logAudit helper for the platform's append-only audit trail"
```

---

### Task 4: Service-role Supabase client (server-only)

**Files:**
- Create: `lib/supabase/admin.ts`

**Interfaces:**
- Produces: `createAdminClient(): SupabaseClient` — consumed only by Task 9's Route Handler.
  Never imported from a `'use client'` file (the service-role key must never reach the
  browser bundle).

- [ ] **Step 1: Create `lib/supabase/admin.ts`**

```typescript
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

The `server-only` package throws a build error if this file is ever imported from client
code — install it if not already present.

- [ ] **Step 2: Verify `server-only` is a dependency**

Run: `grep '"server-only"' package.json`
Expected: no output (not installed yet) — then run:
`npm install server-only`

- [ ] **Step 3: Add the service-role key to Vercel and local env (controller-only)**

This step cannot be delegated to an implementer subagent — it requires the Supabase project
dashboard (to copy the `service_role` key, which is only shown once per rotation) and the
already-authenticated Vercel CLI session. The controller runs:

```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production --value "<from Supabase dashboard>" --yes
vercel env add SUPABASE_SERVICE_ROLE_KEY preview --value "<from Supabase dashboard>" --yes
vercel env add SUPABASE_SERVICE_ROLE_KEY development --value "<from Supabase dashboard>" --yes
```

And appends the same value to `.env.local` (already gitignored — verify with
`grep .env.local .gitignore` before writing to it).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/admin.ts package.json package-lock.json
git commit -m "feat: add server-only Supabase admin client for privileged operations"
```

---

### Task 5: Real login + route protection (`proxy.ts`)

**Files:**
- Rewrite: `app/login/page.tsx`
- Create: `proxy.ts`
- Test: none (Next.js proxy/auth flow is verified via Task 12's manual walkthrough — the
  Home plan established this project doesn't have a local Supabase test harness, only the
  live project, so auth-flow correctness is checked by hand against real Supabase Auth)

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts` (browser) and
  `lib/supabase/server.ts` (server), both already exist and are unchanged.
- Produces: unauthenticated requests to `/plataforma/**` redirect to `/login`; a successful
  login redirects to `/plataforma/resumen`. Task 6's layout relies on this — it does NOT
  re-check auth itself, `proxy.ts` is the single enforcement point.

- [ ] **Step 1: Rewrite `app/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (signInError) {
      setError('Correo o contraseña incorrectos.')
      return
    }

    router.push('/plataforma/resumen')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#03142F] px-6 text-center">
      <Image src="/logo.png" alt="HealthScope" width={64} height={64} className="rounded" />
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 text-left">
        <h1 className="text-center font-heading text-2xl font-semibold text-white">
          Ingresar a la plataforma
        </h1>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white">Correo</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white">Contraseña</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 2: Create `proxy.ts` at the project root**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/plataforma')) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/plataforma/:path*'],
}
```

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx proxy.ts
git commit -m "feat: add real Supabase Auth login and proxy-based route protection"
```

---

### Task 6: Platform shell — layout, Sidebar, Topbar

**Files:**
- Create: `app/plataforma/layout.tsx`
- Create: `app/plataforma/resumen/page.tsx`
- Create: `components/platform/Sidebar.tsx`
- Create: `components/platform/Topbar.tsx`
- Create: `components/platform/EmpresaSwitcher.tsx`

**Interfaces:**
- Consumes: `Usuario`, `Rol`, `Empresa` types (Task 1/2), `lib/supabase/server.ts`.
- Produces: every page created in Tasks 7–10 renders inside this layout automatically (Next.js
  layout nesting) — they only need to export a default page component, no auth/shell logic.

- [ ] **Step 1: Install the shadcn primitives this task and later tasks need**

```bash
npx shadcn@latest add table select dialog dropdown-menu badge avatar
```

Expected: `components/ui/table.tsx`, `select.tsx`, `dialog.tsx`, `dropdown-menu.tsx`,
`badge.tsx`, `avatar.tsx` created.

- [ ] **Step 2: Create `app/plataforma/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow, mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { Sidebar } from '@/components/platform/Sidebar'
import { Topbar } from '@/components/platform/Topbar'

export default async function PlataformaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: usuarioRow } = await supabase
    .from('usuarios')
    .select('*, roles(*)')
    .eq('id', user.id)
    .single()

  if (!usuarioRow) {
    redirect('/login')
  }

  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresaRows } = await supabase.from('empresas').select('*')
  const empresas = (empresaRows ?? []).map(mapEmpresaRow)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar rolClave={rol.clave} />
      <div className="flex flex-1 flex-col">
        <Topbar usuario={usuario} rol={rol} empresas={empresas} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

This requires a `mapRolRow` function — add it to `lib/platform/types.ts` (append):

```typescript
export function mapRolRow(row: { id: string; clave: string; nombre: string; descripcion: string }): Rol {
  return {
    id: row.id,
    clave: row.clave,
    nombre: row.nombre,
    descripcion: row.descripcion,
  }
}

export function mapEmpresaRow(row: {
  id: string
  tenant_id: string
  created_at: string
  nombre: string
  rut: string | null
}): Empresa {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    nombre: row.nombre,
    rut: row.rut,
  }
}
```

- [ ] **Step 3: Create `components/platform/Sidebar.tsx`**

```tsx
import Link from 'next/link'
import { isAdminRole } from '@/lib/platform/roles'

const NAV_ITEMS = [
  { href: '/plataforma/resumen', label: 'Resumen', adminOnly: false },
  { href: '/plataforma/organizacion', label: 'Organización', adminOnly: true },
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

`Organización`, `Usuarios y permisos` and `Auditoría` are hidden for non-admin roles here as
a UX nicety — the actual enforcement is the RLS policies from Task 2, which is why this
component only needs `rolClave`, no permission-fetching logic of its own.

- [ ] **Step 4: Create `components/platform/EmpresaSwitcher.tsx`**

```tsx
'use client'

import type { Empresa } from '@/lib/platform/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function EmpresaSwitcher({ empresas }: { empresas: Empresa[] }) {
  if (empresas.length <= 1) {
    return (
      <span className="text-sm font-medium text-foreground">
        {empresas[0]?.nombre ?? 'Sin empresa'}
      </span>
    )
  }

  return (
    <Select defaultValue={empresas[0].id}>
      <SelectTrigger className="w-48">
        <SelectValue />
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

This is intentionally a display-only switcher for the MVP (no filtering wired yet — that
lands with the dashboard plan, once there's data to filter). It proves the multi-empresa
data model works end-to-end without over-building.

- [ ] **Step 5: Create `components/platform/Topbar.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import type { Empresa, Rol, Usuario } from '@/lib/platform/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { EmpresaSwitcher } from './EmpresaSwitcher'

export function Topbar({
  usuario,
  rol,
  empresas,
}: {
  usuario: Usuario
  rol: Rol
  empresas: Empresa[]
}) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
      <EmpresaSwitcher empresas={empresas} />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">{usuario.nombre}</p>
          <p className="text-xs text-muted-foreground">{rol.nombre}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 6: Create `app/plataforma/resumen/page.tsx`**

```tsx
export default function ResumenPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-foreground">Resumen</h1>
      <p className="mt-2 text-muted-foreground">
        El dashboard de indicadores llega en el siguiente plan, una vez exista importación de
        datos. Esta página confirma que el shell autenticado funciona.
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors (fix any before continuing — `mapRolRow`/`mapEmpresaRow` must be
exported from `lib/platform/types.ts` for this to pass)

- [ ] **Step 8: Commit**

```bash
git add app/plataforma lib/platform/types.ts components/platform/Sidebar.tsx components/platform/Topbar.tsx components/platform/EmpresaSwitcher.tsx components/ui
git commit -m "feat: add authenticated platform shell with role-aware sidebar"
```

---

### Task 7: Organización — Sucursales CRUD

**Files:**
- Create: `app/plataforma/organizacion/page.tsx`
- Create: `components/platform/SucursalesTable.tsx`
- Create: `components/platform/SucursalSheet.tsx`

**Interfaces:**
- Consumes: `Sucursal`, `mapSucursalRow` (Task 1), `logAudit` (Task 3), `createClient`
  (browser, existing), `isAdminRole` (Task 2).
- Produces: `SucursalesTable` and `SucursalSheet` establish the CRUD pattern Tasks 8 reuses
  verbatim for Unidades/Centros de costo/Cargos/Turnos — same table/sheet/audit shape, just a
  different entity and field set.

- [ ] **Step 1: Create `components/platform/SucursalSheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapSucursalRow, type Sucursal } from '@/lib/platform/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  ciudad: z.string().optional(),
})

export function SucursalSheet({
  tenantId,
  empresaId,
  actorId,
  sucursal,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  sucursal?: Sucursal
  onSaved: (sucursal: Sucursal) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: sucursal?.nombre ?? '', ciudad: sucursal?.ciudad ?? '' },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()

    if (sucursal) {
      const { data, error } = await supabase
        .from('sucursales')
        .update({ nombre: values.nombre, ciudad: values.ciudad || null })
        .eq('id', sucursal.id)
        .select()
        .single()

      if (error || !data) return

      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'sucursales',
        entidadId: sucursal.id,
        accion: 'actualizar',
        datosAntes: sucursal,
        datosDespues: values,
      })

      onSaved(mapSucursalRow(data))
    } else {
      const { data, error } = await supabase
        .from('sucursales')
        .insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          nombre: values.nombre,
          ciudad: values.ciudad || null,
        })
        .select()
        .single()

      if (error || !data) return

      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'sucursales',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: values,
      })

      onSaved(mapSucursalRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        {sucursal ? 'Editar' : 'Nueva sucursal'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{sucursal ? 'Editar sucursal' : 'Nueva sucursal'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ciudad">Ciudad</Label>
            <Input id="ciudad" {...form.register('ciudad')} />
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

`SheetTrigger` uses `render={<Button size="sm" />}` instead of `asChild` — the Base UI quirk
from the Global Constraints. `sheet.tsx` already wraps Base UI's Dialog primitive (verified in
the Home plan's Task 3), so `SheetTrigger`'s `render` prop works the same way.

- [ ] **Step 2: Create `components/platform/SucursalesTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { type Sucursal } from '@/lib/platform/types'
import { isAdminRole } from '@/lib/platform/roles'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { SucursalSheet } from './SucursalSheet'

export function SucursalesTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialSucursales,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialSucursales: Sucursal[]
}) {
  const [sucursales, setSucursales] = useState(initialSucursales)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(sucursal: Sucursal) {
    setSucursales((prev) => {
      const exists = prev.some((s) => s.id === sucursal.id)
      return exists ? prev.map((s) => (s.id === sucursal.id ? sucursal : s)) : [...prev, sucursal]
    })
  }

  async function handleDelete(sucursal: Sucursal) {
    const supabase = createClient()
    const { error } = await supabase.from('sucursales').delete().eq('id', sucursal.id)
    if (error) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'sucursales',
      entidadId: sucursal.id,
      accion: 'eliminar',
      datosAntes: sucursal,
      datosDespues: null,
    })

    setSucursales((prev) => prev.filter((s) => s.id !== sucursal.id))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <SucursalSheet
            tenantId={tenantId}
            empresaId={empresaId}
            actorId={actorId}
            onSaved={handleSaved}
          />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Ciudad</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sucursales.map((sucursal) => (
            <TableRow key={sucursal.id}>
              <TableCell>{sucursal.nombre}</TableCell>
              <TableCell>{sucursal.ciudad ?? '—'}</TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <SucursalSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    sucursal={sucursal}
                    onSaved={handleSaved}
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(sucursal)}>
                    Eliminar
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/plataforma/organizacion/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapSucursalRow, mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { SucursalesTable } from '@/components/platform/SucursalesTable'

export default async function OrganizacionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase
    .from('usuarios')
    .select('*, roles(*)')
    .eq('id', user.id)
    .single()
  if (!usuarioRow) redirect('/login')

  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }

  const { data: sucursalRows } = await supabase
    .from('sucursales')
    .select('*')
    .eq('empresa_id', empresaId)
  const sucursales = (sucursalRows ?? []).map(mapSucursalRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Organización</h1>
      <SucursalesTable
        tenantId={usuario.tenantId}
        empresaId={empresaId}
        actorId={usuario.id}
        rolClave={rol.clave}
        initialSucursales={sucursales}
      />
    </div>
  )
}
```

This page only wires Sucursales for now — Task 8 extends it with Unidades, Centros de costo,
Cargos and Turnos as tabs, reusing this exact data-fetching shape.

- [ ] **Step 4: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/organizacion components/platform/SucursalesTable.tsx components/platform/SucursalSheet.tsx
git commit -m "feat: add Sucursales CRUD to Organización page"
```

---

### Task 8: Organización — Unidades, Centros de costo, Cargos, Turnos (tabs)

**Files:**
- Modify: `app/plataforma/organizacion/page.tsx` (wrap in tabs, add the 4 new queries)
- Create: `components/platform/UnidadesTable.tsx`, `UnidadSheet.tsx`
- Create: `components/platform/CentrosCostoTable.tsx`, `CentroCostoSheet.tsx`
- Create: `components/platform/CargosTable.tsx`, `CargoSheet.tsx`
- Create: `components/platform/TurnosTable.tsx`, `TurnoSheet.tsx`

**Interfaces:**
- Consumes: same pattern as Task 7 (`logAudit`, `isAdminRole`, the respective `map*Row`
  functions from `lib/platform/types.ts`), plus needs `npx shadcn@latest add tabs` (new
  primitive, Task 6 didn't install it).
- Produces: the complete Organización page — no further org-structure work remains after
  this task.

- [ ] **Step 1: Install the `tabs` primitive**

```bash
npx shadcn@latest add tabs
```

- [ ] **Step 2: Create `components/platform/UnidadSheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapUnidadRow, type Unidad } from '@/lib/platform/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const schema = z.object({ nombre: z.string().min(1, 'Requerido') })

export function UnidadSheet({
  tenantId,
  sucursalId,
  actorId,
  unidad,
  onSaved,
}: {
  tenantId: string
  sucursalId: string
  actorId: string
  unidad?: Unidad
  onSaved: (unidad: Unidad) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: unidad?.nombre ?? '' },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()

    if (unidad) {
      const { data, error } = await supabase
        .from('unidades')
        .update({ nombre: values.nombre })
        .eq('id', unidad.id)
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'unidades',
        entidadId: unidad.id,
        accion: 'actualizar',
        datosAntes: unidad,
        datosDespues: values,
      })
      onSaved(mapUnidadRow(data))
    } else {
      const { data, error } = await supabase
        .from('unidades')
        .insert({ tenant_id: tenantId, sucursal_id: sucursalId, nombre: values.nombre })
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'unidades',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: values,
      })
      onSaved(mapUnidadRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        {unidad ? 'Editar' : 'Nueva unidad'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{unidad ? 'Editar unidad' : 'Nueva unidad'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Create `components/platform/UnidadesTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { type Unidad } from '@/lib/platform/types'
import { isAdminRole } from '@/lib/platform/roles'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { UnidadSheet } from './UnidadSheet'

export function UnidadesTable({
  tenantId,
  sucursalId,
  actorId,
  rolClave,
  initialUnidades,
}: {
  tenantId: string
  sucursalId: string
  actorId: string
  rolClave: string
  initialUnidades: Unidad[]
}) {
  const [unidades, setUnidades] = useState(initialUnidades)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(unidad: Unidad) {
    setUnidades((prev) => {
      const exists = prev.some((u) => u.id === unidad.id)
      return exists ? prev.map((u) => (u.id === unidad.id ? unidad : u)) : [...prev, unidad]
    })
  }

  async function handleDelete(unidad: Unidad) {
    const supabase = createClient()
    const { error } = await supabase.from('unidades').delete().eq('id', unidad.id)
    if (error) return
    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'unidades',
      entidadId: unidad.id,
      accion: 'eliminar',
      datosAntes: unidad,
      datosDespues: null,
    })
    setUnidades((prev) => prev.filter((u) => u.id !== unidad.id))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <UnidadSheet
            tenantId={tenantId}
            sucursalId={sucursalId}
            actorId={actorId}
            onSaved={handleSaved}
          />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {unidades.map((unidad) => (
            <TableRow key={unidad.id}>
              <TableCell>{unidad.nombre}</TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <UnidadSheet
                    tenantId={tenantId}
                    sucursalId={sucursalId}
                    actorId={actorId}
                    unidad={unidad}
                    onSaved={handleSaved}
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(unidad)}>
                    Eliminar
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/platform/CentroCostoSheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapCentroCostoRow, type CentroCosto } from '@/lib/platform/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const schema = z.object({
  codigo: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
})

export function CentroCostoSheet({
  tenantId,
  empresaId,
  actorId,
  centroCosto,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  centroCosto?: CentroCosto
  onSaved: (centroCosto: CentroCosto) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigo: centroCosto?.codigo ?? '',
      nombre: centroCosto?.nombre ?? '',
    },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()

    if (centroCosto) {
      const { data, error } = await supabase
        .from('centros_costo')
        .update(values)
        .eq('id', centroCosto.id)
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'centros_costo',
        entidadId: centroCosto.id,
        accion: 'actualizar',
        datosAntes: centroCosto,
        datosDespues: values,
      })
      onSaved(mapCentroCostoRow(data))
    } else {
      const { data, error } = await supabase
        .from('centros_costo')
        .insert({ tenant_id: tenantId, empresa_id: empresaId, ...values })
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'centros_costo',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: values,
      })
      onSaved(mapCentroCostoRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        {centroCosto ? 'Editar' : 'Nuevo centro de costo'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{centroCosto ? 'Editar centro de costo' : 'Nuevo centro de costo'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="codigo">Código</Label>
            <Input id="codigo" {...form.register('codigo')} />
            {form.formState.errors.codigo ? (
              <p className="text-sm text-destructive">{form.formState.errors.codigo.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 5: Create `components/platform/CentrosCostoTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { type CentroCosto } from '@/lib/platform/types'
import { isAdminRole } from '@/lib/platform/roles'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { CentroCostoSheet } from './CentroCostoSheet'

export function CentrosCostoTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialCentrosCosto,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialCentrosCosto: CentroCosto[]
}) {
  const [centrosCosto, setCentrosCosto] = useState(initialCentrosCosto)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(centroCosto: CentroCosto) {
    setCentrosCosto((prev) => {
      const exists = prev.some((c) => c.id === centroCosto.id)
      return exists
        ? prev.map((c) => (c.id === centroCosto.id ? centroCosto : c))
        : [...prev, centroCosto]
    })
  }

  async function handleDelete(centroCosto: CentroCosto) {
    const supabase = createClient()
    const { error } = await supabase.from('centros_costo').delete().eq('id', centroCosto.id)
    if (error) return
    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'centros_costo',
      entidadId: centroCosto.id,
      accion: 'eliminar',
      datosAntes: centroCosto,
      datosDespues: null,
    })
    setCentrosCosto((prev) => prev.filter((c) => c.id !== centroCosto.id))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <CentroCostoSheet
            tenantId={tenantId}
            empresaId={empresaId}
            actorId={actorId}
            onSaved={handleSaved}
          />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {centrosCosto.map((centroCosto) => (
            <TableRow key={centroCosto.id}>
              <TableCell>{centroCosto.codigo}</TableCell>
              <TableCell>{centroCosto.nombre}</TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <CentroCostoSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    centroCosto={centroCosto}
                    onSaved={handleSaved}
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(centroCosto)}>
                    Eliminar
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 6: Create `components/platform/CargoSheet.tsx` and `components/platform/CargosTable.tsx`**

Same shape as Sucursal (single `nombre` field), scoped to `empresa_id` instead of
`sucursal_id`, table name `cargos`. Copy `SucursalSheet.tsx`/`SucursalesTable.tsx` from Task
7 field-for-field, renaming `Sucursal` → `Cargo`, `sucursales` → `cargos`, dropping the
`ciudad` field, and swapping the `empresaId` prop wiring (`Cargo` already has `empresaId`, no
`sucursalId`) — same as `CentroCosto` minus the `codigo` field:

`components/platform/CargoSheet.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapCargoRow, type Cargo } from '@/lib/platform/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const schema = z.object({ nombre: z.string().min(1, 'Requerido') })

export function CargoSheet({
  tenantId,
  empresaId,
  actorId,
  cargo,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  cargo?: Cargo
  onSaved: (cargo: Cargo) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: cargo?.nombre ?? '' },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()

    if (cargo) {
      const { data, error } = await supabase
        .from('cargos')
        .update({ nombre: values.nombre })
        .eq('id', cargo.id)
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'cargos',
        entidadId: cargo.id,
        accion: 'actualizar',
        datosAntes: cargo,
        datosDespues: values,
      })
      onSaved(mapCargoRow(data))
    } else {
      const { data, error } = await supabase
        .from('cargos')
        .insert({ tenant_id: tenantId, empresa_id: empresaId, nombre: values.nombre })
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'cargos',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: values,
      })
      onSaved(mapCargoRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        {cargo ? 'Editar' : 'Nuevo cargo'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{cargo ? 'Editar cargo' : 'Nuevo cargo'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

`components/platform/CargosTable.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { type Cargo } from '@/lib/platform/types'
import { isAdminRole } from '@/lib/platform/roles'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { CargoSheet } from './CargoSheet'

export function CargosTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialCargos,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialCargos: Cargo[]
}) {
  const [cargos, setCargos] = useState(initialCargos)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(cargo: Cargo) {
    setCargos((prev) => {
      const exists = prev.some((c) => c.id === cargo.id)
      return exists ? prev.map((c) => (c.id === cargo.id ? cargo : c)) : [...prev, cargo]
    })
  }

  async function handleDelete(cargo: Cargo) {
    const supabase = createClient()
    const { error } = await supabase.from('cargos').delete().eq('id', cargo.id)
    if (error) return
    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'cargos',
      entidadId: cargo.id,
      accion: 'eliminar',
      datosAntes: cargo,
      datosDespues: null,
    })
    setCargos((prev) => prev.filter((c) => c.id !== cargo.id))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <CargoSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargos.map((cargo) => (
            <TableRow key={cargo.id}>
              <TableCell>{cargo.nombre}</TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <CargoSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    cargo={cargo}
                    onSaved={handleSaved}
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(cargo)}>
                    Eliminar
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 7: Create `components/platform/TurnoSheet.tsx` and `components/platform/TurnosTable.tsx`**

Same shape again, table `turnos`, fields `nombre`, `horaInicio` (`time` input), `horaFin`
(`time` input).

`components/platform/TurnoSheet.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { mapTurnoRow, type Turno } from '@/lib/platform/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  horaInicio: z.string().optional(),
  horaFin: z.string().optional(),
})

export function TurnoSheet({
  tenantId,
  empresaId,
  actorId,
  turno,
  onSaved,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  turno?: Turno
  onSaved: (turno: Turno) => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: turno?.nombre ?? '',
      horaInicio: turno?.horaInicio ?? '',
      horaFin: turno?.horaFin ?? '',
    },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const supabase = createClient()
    const payload = {
      nombre: values.nombre,
      hora_inicio: values.horaInicio || null,
      hora_fin: values.horaFin || null,
    }

    if (turno) {
      const { data, error } = await supabase
        .from('turnos')
        .update(payload)
        .eq('id', turno.id)
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'turnos',
        entidadId: turno.id,
        accion: 'actualizar',
        datosAntes: turno,
        datosDespues: values,
      })
      onSaved(mapTurnoRow(data))
    } else {
      const { data, error } = await supabase
        .from('turnos')
        .insert({ tenant_id: tenantId, empresa_id: empresaId, ...payload })
        .select()
        .single()
      if (error || !data) return
      await logAudit(supabase, {
        tenantId,
        actorId,
        entidad: 'turnos',
        entidadId: data.id,
        accion: 'crear',
        datosAntes: null,
        datosDespues: values,
      })
      onSaved(mapTurnoRow(data))
    }

    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        {turno ? 'Editar' : 'Nuevo turno'}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{turno ? 'Editar turno' : 'Nuevo turno'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="horaInicio">Hora inicio</Label>
            <Input id="horaInicio" type="time" {...form.register('horaInicio')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="horaFin">Hora fin</Label>
            <Input id="horaFin" type="time" {...form.register('horaFin')} />
          </div>
          <Button type="submit">Guardar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

`components/platform/TurnosTable.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import { type Turno } from '@/lib/platform/types'
import { isAdminRole } from '@/lib/platform/roles'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { TurnoSheet } from './TurnoSheet'

export function TurnosTable({
  tenantId,
  empresaId,
  actorId,
  rolClave,
  initialTurnos,
}: {
  tenantId: string
  empresaId: string
  actorId: string
  rolClave: string
  initialTurnos: Turno[]
}) {
  const [turnos, setTurnos] = useState(initialTurnos)
  const canEdit = isAdminRole(rolClave)

  function handleSaved(turno: Turno) {
    setTurnos((prev) => {
      const exists = prev.some((t) => t.id === turno.id)
      return exists ? prev.map((t) => (t.id === turno.id ? turno : t)) : [...prev, turno]
    })
  }

  async function handleDelete(turno: Turno) {
    const supabase = createClient()
    const { error } = await supabase.from('turnos').delete().eq('id', turno.id)
    if (error) return
    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'turnos',
      entidadId: turno.id,
      accion: 'eliminar',
      datosAntes: turno,
      datosDespues: null,
    })
    setTurnos((prev) => prev.filter((t) => t.id !== turno.id))
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <TurnoSheet tenantId={tenantId} empresaId={empresaId} actorId={actorId} onSaved={handleSaved} />
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Hora inicio</TableHead>
            <TableHead>Hora fin</TableHead>
            {canEdit ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {turnos.map((turno) => (
            <TableRow key={turno.id}>
              <TableCell>{turno.nombre}</TableCell>
              <TableCell>{turno.horaInicio ?? '—'}</TableCell>
              <TableCell>{turno.horaFin ?? '—'}</TableCell>
              {canEdit ? (
                <TableCell className="flex justify-end gap-2">
                  <TurnoSheet
                    tenantId={tenantId}
                    empresaId={empresaId}
                    actorId={actorId}
                    turno={turno}
                    onSaved={handleSaved}
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(turno)}>
                    Eliminar
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 8: Rewrite `app/plataforma/organizacion/page.tsx` with tabs wiring all five entities**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  mapSucursalRow,
  mapUnidadRow,
  mapCentroCostoRow,
  mapCargoRow,
  mapTurnoRow,
  mapUsuarioRow,
  mapRolRow,
} from '@/lib/platform/types'
import { SucursalesTable } from '@/components/platform/SucursalesTable'
import { UnidadesTable } from '@/components/platform/UnidadesTable'
import { CentrosCostoTable } from '@/components/platform/CentrosCostoTable'
import { CargosTable } from '@/components/platform/CargosTable'
import { TurnosTable } from '@/components/platform/TurnosTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function OrganizacionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase
    .from('usuarios')
    .select('*, roles(*)')
    .eq('id', user.id)
    .single()
  if (!usuarioRow) redirect('/login')

  const usuario = mapUsuarioRow(usuarioRow)
  const rol = mapRolRow(usuarioRow.roles)

  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) {
    return <p className="text-muted-foreground">Esta cuenta todavía no tiene una empresa configurada.</p>
  }

  const [sucursalesRes, centrosCostoRes, cargosRes, turnosRes] = await Promise.all([
    supabase.from('sucursales').select('*').eq('empresa_id', empresaId),
    supabase.from('centros_costo').select('*').eq('empresa_id', empresaId),
    supabase.from('cargos').select('*').eq('empresa_id', empresaId),
    supabase.from('turnos').select('*').eq('empresa_id', empresaId),
  ])

  const sucursales = (sucursalesRes.data ?? []).map(mapSucursalRow)
  const centrosCosto = (centrosCostoRes.data ?? []).map(mapCentroCostoRow)
  const cargos = (cargosRes.data ?? []).map(mapCargoRow)
  const turnos = (turnosRes.data ?? []).map(mapTurnoRow)

  const primerSucursalId = sucursales[0]?.id
  const { data: unidadRows } = primerSucursalId
    ? await supabase.from('unidades').select('*').eq('sucursal_id', primerSucursalId)
    : { data: [] }
  const unidades = (unidadRows ?? []).map(mapUnidadRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Organización</h1>
      <Tabs defaultValue="sucursales">
        <TabsList>
          <TabsTrigger value="sucursales">Sucursales</TabsTrigger>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="centros-costo">Centros de costo</TabsTrigger>
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="turnos">Turnos</TabsTrigger>
        </TabsList>
        <TabsContent value="sucursales">
          <SucursalesTable
            tenantId={usuario.tenantId}
            empresaId={empresaId}
            actorId={usuario.id}
            rolClave={rol.clave}
            initialSucursales={sucursales}
          />
        </TabsContent>
        <TabsContent value="unidades">
          {primerSucursalId ? (
            <UnidadesTable
              tenantId={usuario.tenantId}
              sucursalId={primerSucursalId}
              actorId={usuario.id}
              rolClave={rol.clave}
              initialUnidades={unidades}
            />
          ) : (
            <p className="text-muted-foreground">Crea una sucursal primero.</p>
          )}
        </TabsContent>
        <TabsContent value="centros-costo">
          <CentrosCostoTable
            tenantId={usuario.tenantId}
            empresaId={empresaId}
            actorId={usuario.id}
            rolClave={rol.clave}
            initialCentrosCosto={centrosCosto}
          />
        </TabsContent>
        <TabsContent value="cargos">
          <CargosTable
            tenantId={usuario.tenantId}
            empresaId={empresaId}
            actorId={usuario.id}
            rolClave={rol.clave}
            initialCargos={cargos}
          />
        </TabsContent>
        <TabsContent value="turnos">
          <TurnosTable
            tenantId={usuario.tenantId}
            empresaId={empresaId}
            actorId={usuario.id}
            rolClave={rol.clave}
            initialTurnos={turnos}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

Unidades is scoped to "the first sucursal" for the MVP rather than a sucursal picker — a
picker is a two-minute follow-up once there's more than one sucursal in real test data;
noted as a deferred nit, not silently dropped.

- [ ] **Step 9: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add app/plataforma/organizacion components/platform/UnidadesTable.tsx components/platform/UnidadSheet.tsx components/platform/CentrosCostoTable.tsx components/platform/CentroCostoSheet.tsx components/platform/CargosTable.tsx components/platform/CargoSheet.tsx components/platform/TurnosTable.tsx components/platform/TurnoSheet.tsx components/ui/tabs.tsx
git commit -m "feat: complete Organización page with Unidades, Centros de costo, Cargos, Turnos"
```

---

### Task 9: Usuarios y permisos — invite, list, change role, deactivate

**Files:**
- Create: `app/api/platform/usuarios/invitar/route.ts`
- Create: `app/plataforma/usuarios/page.tsx`
- Create: `components/platform/UsuariosTable.tsx`
- Create: `components/platform/InvitarUsuarioSheet.tsx`

**Interfaces:**
- Consumes: `createAdminClient` (Task 4), `logAudit` (Task 3), `Usuario`/`Rol` types
  (Task 1/2).
- Produces: `POST /api/platform/usuarios/invitar` accepting
  `{ email: string, nombre: string, rolClave: string }`, returning `201` with the created
  `Usuario` or `4xx` with `{ error: string }` — this is the only privileged write path in the
  whole plan; every other mutation in this plan goes through the browser client + RLS.

- [ ] **Step 1: Create `app/api/platform/usuarios/invitar/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminRole } from '@/lib/platform/roles'
import { mapUsuarioRow } from '@/lib/platform/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: caller } = await supabase
    .from('usuarios')
    .select('*, roles(clave)')
    .eq('id', user.id)
    .single()

  if (!caller || !isAdminRole(caller.roles.clave)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { email, nombre, rolClave } = body as {
    email: string
    nombre: string
    rolClave: string
  }

  if (!email || !nombre || !rolClave) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: rolRow, error: rolError } = await supabase
    .from('roles')
    .select('id')
    .eq('clave', rolClave)
    .single()

  if (rolError || !rolRow) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }

  const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(email)

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? 'No se pudo invitar al usuario' },
      { status: 400 }
    )
  }

  const { data: usuarioRow, error: usuarioError } = await admin
    .from('usuarios')
    .insert({
      id: created.user.id,
      tenant_id: caller.tenant_id,
      nombre,
      email,
      rol_id: rolRow.id,
    })
    .select()
    .single()

  if (usuarioError || !usuarioRow) {
    return NextResponse.json(
      { error: usuarioError?.message ?? 'No se pudo crear el perfil del usuario' },
      { status: 400 }
    )
  }

  await admin.from('auditoria').insert({
    tenant_id: caller.tenant_id,
    actor_id: user.id,
    entidad: 'usuarios',
    entidad_id: usuarioRow.id,
    accion: 'crear',
    datos_antes: null,
    datos_despues: { email, nombre, rolClave },
  })

  return NextResponse.json(mapUsuarioRow(usuarioRow), { status: 201 })
}
```

The audit insert here uses `admin` (service-role), not the browser client, because this
whole request runs server-side with no user session cookie forwarded to a second client —
consistent with "every privileged action is explicit," not a workaround.

- [ ] **Step 2: Create `components/platform/InvitarUsuarioSheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ROLE_KEYS, type RoleKey } from '@/lib/platform/roles'
import type { Usuario } from '@/lib/platform/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  email: z.string().email('Correo inválido'),
  rolClave: z.enum(ROLE_KEYS as unknown as [RoleKey, ...RoleKey[]]),
})

export function InvitarUsuarioSheet({ onInvited }: { onInvited: (usuario: Usuario) => void }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', email: '', rolClave: 'solo_lectura' },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    setServerError(null)
    const response = await fetch('/api/platform/usuarios/invitar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    if (!response.ok) {
      const { error } = await response.json()
      setServerError(error)
      return
    }

    const usuario: Usuario = await response.json()
    onInvited(usuario)
    setOpen(false)
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>Invitar usuario</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Invitar usuario</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rolClave">Rol</Label>
            <Select
              defaultValue="solo_lectura"
              onValueChange={(value) => form.setValue('rolClave', value as RoleKey)}
            >
              <SelectTrigger id="rolClave" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_KEYS.map((clave) => (
                  <SelectItem key={clave} value={clave}>
                    {clave}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
          <Button type="submit">Invitar</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Create `components/platform/UsuariosTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/platform/audit'
import type { Rol, Usuario } from '@/lib/platform/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InvitarUsuarioSheet } from './InvitarUsuarioSheet'

export function UsuariosTable({
  tenantId,
  actorId,
  initialUsuarios,
  roles,
}: {
  tenantId: string
  actorId: string
  initialUsuarios: Usuario[]
  roles: Rol[]
}) {
  const [usuarios, setUsuarios] = useState(initialUsuarios)
  const roleName = (rolId: string) => roles.find((r) => r.id === rolId)?.nombre ?? rolId

  async function handleToggleEstado(usuario: Usuario) {
    const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo'
    const supabase = createClient()
    const { data, error } = await supabase
      .from('usuarios')
      .update({ estado: nuevoEstado })
      .eq('id', usuario.id)
      .select()
      .single()

    if (error || !data) return

    await logAudit(supabase, {
      tenantId,
      actorId,
      entidad: 'usuarios',
      entidadId: usuario.id,
      accion: 'actualizar',
      datosAntes: { estado: usuario.estado },
      datosDespues: { estado: nuevoEstado },
    })

    setUsuarios((prev) =>
      prev.map((u) => (u.id === usuario.id ? { ...u, estado: nuevoEstado } : u))
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <InvitarUsuarioSheet onInvited={(usuario) => setUsuarios((prev) => [...prev, usuario])} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell>{usuario.nombre}</TableCell>
              <TableCell>{usuario.email}</TableCell>
              <TableCell>{roleName(usuario.rolId)}</TableCell>
              <TableCell>
                <Badge variant={usuario.estado === 'activo' ? 'default' : 'secondary'}>
                  {usuario.estado}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => handleToggleEstado(usuario)}>
                  {usuario.estado === 'activo' ? 'Desactivar' : 'Reactivar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

Role change (moving an existing user to a different `rol_id`) is deferred past this task —
deactivate/reactivate proves the RLS-gated update path end to end, and role reassignment is
the same one-line `update` call, added when a real test scenario needs it rather than
speculatively now.

- [ ] **Step 4: Create `app/plataforma/usuarios/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapUsuarioRow, mapRolRow } from '@/lib/platform/types'
import { UsuariosTable } from '@/components/platform/UsuariosTable'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase
    .from('usuarios')
    .select('*, roles(*)')
    .eq('id', user.id)
    .single()
  if (!usuarioRow) redirect('/login')

  const usuario = mapUsuarioRow(usuarioRow)

  const [usuariosRes, rolesRes] = await Promise.all([
    supabase.from('usuarios').select('*'),
    supabase.from('roles').select('*'),
  ])

  const usuarios = (usuariosRes.data ?? []).map(mapUsuarioRow)
  const roles = (rolesRes.data ?? []).map(mapRolRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Usuarios y permisos</h1>
      <UsuariosTable
        tenantId={usuario.tenantId}
        actorId={usuario.id}
        initialUsuarios={usuarios}
        roles={roles}
      />
    </div>
  )
}
```

- [ ] **Step 5: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/api/platform/usuarios app/plataforma/usuarios components/platform/UsuariosTable.tsx components/platform/InvitarUsuarioSheet.tsx components/ui/badge.tsx
git commit -m "feat: add Usuarios y permisos page with the invite Route Handler"
```

---

### Task 10: Auditoría viewer

**Files:**
- Create: `app/plataforma/auditoria/page.tsx`
- Create: `components/platform/AuditoriaTable.tsx`

**Interfaces:**
- Consumes: `Auditoria`, `mapAuditoriaRow`, `Usuario` (Task 2).
- Produces: nothing later tasks consume — this is a leaf page.

- [ ] **Step 1: Create `components/platform/AuditoriaTable.tsx`**

```tsx
import type { Auditoria, Usuario } from '@/lib/platform/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function AuditoriaTable({
  registros,
  usuarios,
}: {
  registros: Auditoria[]
  usuarios: Usuario[]
}) {
  const nombreActor = (actorId: string) =>
    usuarios.find((u) => u.id === actorId)?.nombre ?? actorId

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Usuario</TableHead>
          <TableHead>Entidad</TableHead>
          <TableHead>Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {registros.map((registro) => (
          <TableRow key={registro.id}>
            <TableCell>{new Date(registro.createdAt).toLocaleString('es-CL')}</TableCell>
            <TableCell>{nombreActor(registro.actorId)}</TableCell>
            <TableCell>{registro.entidad}</TableCell>
            <TableCell className="capitalize">{registro.accion}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Create `app/plataforma/auditoria/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapAuditoriaRow, mapUsuarioRow } from '@/lib/platform/types'
import { AuditoriaTable } from '@/components/platform/AuditoriaTable'

export default async function AuditoriaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [registrosRes, usuariosRes] = await Promise.all([
    supabase.from('auditoria').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('usuarios').select('*'),
  ])

  if (registrosRes.error) {
    return (
      <p className="text-muted-foreground">
        No tienes permiso para ver el registro de auditoría completo.
      </p>
    )
  }

  const registros = (registrosRes.data ?? []).map(mapAuditoriaRow)
  const usuarios = (usuariosRes.data ?? []).map(mapUsuarioRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Auditoría</h1>
      <AuditoriaTable registros={registros} usuarios={usuarios} />
    </div>
  )
}
```

The `auditoria_select_admin_auditor` RLS policy from Task 2 means this query returns an
empty (not error) result set for non-privileged roles by default — Supabase's `select` under
RLS filters rows silently rather than erroring, so `registrosRes.error` will actually be
`null` even when the user has no access, just with `data: []`. The friendlier message here
still helps a `solo_lectura` user understand why the page looks empty, even though it's not
strictly triggered by an auth error — this is a known, acceptable simplification for the MVP
(worth revisiting if `solo_lectura` users routinely land on this page, since the sidebar
already hides the link for them per Task 6).

- [ ] **Step 3: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/plataforma/auditoria components/platform/AuditoriaTable.tsx
git commit -m "feat: add Auditoría log viewer page"
```

---

### Task 11: Manual verification (controller-only)

This step cannot be delegated to an implementer subagent — it requires applying the schema
to the live `healthscope-platform` Supabase project and creating real Auth users, which only
the controller's authenticated browser session can do (same constraint as the Home plan's
Task 3 and Task 14).

- [ ] **Step 1: Apply the full `supabase/schema.sql` (Tasks 1–2 additions) to the live project**

Via the Supabase SQL Editor, run everything appended since the last applied version
(`demo_requests` is already live — only the new `tenants` through `roles` seed block needs
running).

- [ ] **Step 2: Seed one tenant, one empresa and a superadmin user**

```sql
insert into tenants (nombre) values ('HealthScope Demo') returning id;
-- copy the returned id, then:
insert into empresas (tenant_id, nombre, rut) values ('<tenant-id>', 'Empresa Demo SpA', '76.000.000-0') returning id;
```

Create the first Auth user via Supabase Dashboard → Authentication → Add user (email +
password, e.g. `admin@healthscope.cl`), then link it to the tenant:

```sql
insert into usuarios (id, tenant_id, nombre, email, rol_id)
values (
  '<auth-user-id-from-dashboard>',
  '<tenant-id>',
  'Admin Demo',
  'admin@healthscope.cl',
  (select id from roles where clave = 'superadmin')
);
```

- [ ] **Step 3: Full check suite**

```bash
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run
npm run build
```

Expected: all three pass clean.

- [ ] **Step 4: Browser walkthrough**

Using claude-in-chrome + chrome-devtools against the deployed preview (or `npm run dev`
locally with `.env.local` pointed at the live Supabase project):

1. Visit `/plataforma/resumen` while logged out → confirm redirect to `/login`.
2. Log in as `admin@healthscope.cl` → confirm redirect to `/plataforma/resumen` and the
   Sidebar shows all 4 items (superadmin is an admin role).
3. Go to Organización → create a Sucursal, a Centro de costo, a Cargo, a Turno → confirm each
   appears in its table immediately after saving.
4. Go to Auditoría → confirm 4 new rows appear (one `crear` per entity just created), each
   attributed to `Admin Demo`.
5. Go to Usuarios y permisos → invite a second user with rol `solo_lectura` (real email you
   control, to confirm the Supabase invite email arrives) → confirm the new user appears in
   the table with estado `activo`.
6. Log out, log in as the second user (after setting their password via the invite email) →
   confirm the Sidebar shows only "Resumen" (non-admin role) and that navigating directly to
   `/plataforma/organizacion` renders the page shell but the tables are empty (RLS blocks the
   read for `solo_lectura`… actually re-check: the `_select_same_tenant` policies in Task 2
   allow read for **any** authenticated role in the tenant, only write is admin-gated — so
   confirm the tables show the same rows as step 3, but with no "Nueva…"/"Editar"/"Eliminar"
   buttons visible, since `canEdit` is false client-side and the RLS write policies would
   reject any attempt regardless).
7. As the second user, confirm `/plataforma/usuarios` and `/plataforma/auditoria` are absent
   from the Sidebar (both admin-only per Task 6), and that navigating to
   `/plataforma/auditoria` directly renders the "no tienes permiso" message from Task 10 Step 2
   (RLS returns zero rows for a non-admin, non-auditor role).

- [ ] **Step 5: Record the outcome**

Append a `Progress Ledger`-style note to this plan file's bottom (same convention as
`.superpowers/sdd/progress.md` used for the Home page plan) once verification passes,
including any deferred nits found (role-reassignment UI, sucursal picker for Unidades) so
they're triaged before the next plan (import + episodes + dashboard) rather than lost.

---

## Explicitly deferred (not in this plan)

- Import wizard, quality engine, episodios, clasificación — next plan, per
  `docs/superpowers/specs/2026-07-17-data-platform-mvp.md`.
- Dashboard indicators/formulas, filtros, alertas — depend on episodios existing.
- MFA, SSO OIDC/SAML — master doc section 19, not MVP-blocking; email/password is enough to
  prove the RLS/RBAC model, upgrade before real customer data goes in.
- ABAC by campo/finalidad/sensibilidad — this plan only does RBAC (role → allowed actions).
  Field-level and purpose-based restriction is called out in the master doc as a later
  refinement, not part of the MVP acceptance criteria (section 27 lists "aplica roles", not
  "aplica ABAC").
- Role reassignment UI and a sucursal picker for the Unidades tab (both noted inline above as
  one-line follow-ups once real test data exists).
