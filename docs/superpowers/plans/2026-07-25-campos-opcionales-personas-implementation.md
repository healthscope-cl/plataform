# Campos Opcionales de Personas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the import wizard capture 3 new, entirely optional fields per persona (email, teléfono, fecha de ingreso) without touching how RUT is stored (still hashed-only) or any existing required-field behavior.

**Architecture:** Same pattern as the 10 existing import fields: a schema column per field (all nullable), a canonical-field entry with header aliases for auto-suggestion, a UI label, a row-mapping line, and an insert-time value — no new components, no new abstraction.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres, `xlsx` (already used for parsing).

## Global Constraints

- All 3 new fields are nullable in the database and optional in the wizard — none may become a required/blocking field, matching the spec's explicit requirement.
- RUT storage is unchanged: still `rut_hash` only (SHA-256), never plaintext. No task in this plan touches `hashRut()` or adds a plaintext RUT column.
- `nombre`, `fechaNacimiento`, `sexo` are explicitly OUT OF SCOPE — deliberately dropped after a critical review (privacy risk with no offsetting product use, see the spec's rationale). Do not add them "for consistency" with the other fields.
- These 3 fields are set ONLY when a persona row is first inserted (`!existingPersona` branch in `app/api/platform/importaciones/ejecutar/route.ts`). A later re-import for the same `rut_hash` does NOT update them — this matches the existing, deliberate behavior of `unidad_id`/`cargo_id`/`turno_id`, confirmed as the desired behavior for these new fields too.
- Do not modify `components/platform/dashboard/PersonaDetalleTable.tsx`, `lib/indicators/porPersona.ts`, or `lib/ingestion/types.ts`'s `Persona`/`mapPersonaRow` — displaying these new fields anywhere is explicitly out of scope for this plan.
- Schema changes must reach production BEFORE the code that writes to the new columns deploys — this project's established rule after a past incident where a column was referenced by code before the migration existed (see the Campañas module's history). Task 1 (schema) must be applied and confirmed present in production before Task 2's code ships.
- This repo has no `supabase/migrations/` directory — schema changes are applied directly to production via the Supabase SQL Editor, and `supabase/schema.sql` is kept as an up-to-date reference copy (not an executable migration runner). Follow this same pattern.

---

### Task 1: Apply the schema change to production (controller-only, not a subagent task)

**Files:**
- Modify: `supabase/schema.sql` (reference copy only — the actual change is applied directly to the production database via the Supabase SQL Editor, not by running this file)

**Interfaces:**
- Produces: 3 new nullable columns on `personas` — `email text`, `telefono text`, `fecha_ingreso date` — consumed by Task 2's `ejecutar/route.ts` insert.

This task is NOT dispatched to an implementer subagent — applying a production schema change requires interactive access to the Supabase SQL Editor (browser automation), which only the controller (session with browser tools) performs, following this project's established practice for every prior schema change (Campañas, Intervenciones).

- [ ] **Step 1: Apply the migration to production**

Run this exact SQL in the production Supabase SQL Editor:

```sql
alter table personas
  add column email text,
  add column telefono text,
  add column fecha_ingreso date;
```

Expected: statement succeeds, no errors. `personas` already has RLS enabled and existing SELECT/INSERT policies scoped by `tenant_id`/`empresa_id` — adding nullable columns to an already-RLS-enabled table does not require any new policy; the existing policies already cover all columns of the row.

- [ ] **Step 2: Confirm the columns exist in production**

Run this exact SQL in the same SQL Editor to confirm:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'personas'
  and column_name in ('email', 'telefono', 'fecha_ingreso')
order by column_name;
```

Expected: 3 rows returned, all with `is_nullable = 'YES'`.

- [ ] **Step 3: Update the reference schema file**

In `supabase/schema.sql`, find the `personas` table definition:

```sql
create table personas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  codigo text not null,
  rut_hash text not null,
  unidad_id uuid references unidades(id),
  cargo_id uuid references cargos(id),
  turno_id uuid references turnos(id),
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  unique (tenant_id, rut_hash)
);
```

Replace with:

```sql
create table personas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  codigo text not null,
  rut_hash text not null,
  unidad_id uuid references unidades(id),
  cargo_id uuid references cargos(id),
  turno_id uuid references turnos(id),
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  email text,
  telefono text,
  fecha_ingreso date,
  unique (tenant_id, rut_hash)
);
```

- [ ] **Step 4: Commit the reference schema update**

```bash
git add supabase/schema.sql
git commit -m "docs: record personas email/telefono/fecha_ingreso columns in schema reference"
```

---

### Task 2: Wire the 3 new fields through the import wizard

**Files:**
- Modify: `lib/ingestion/columnMapping.ts`
- Modify: `components/platform/import/ColumnMappingStep.tsx`
- Modify: `app/plataforma/importar/page.tsx`
- Modify: `app/api/platform/importaciones/ejecutar/route.ts`

**Interfaces:**
- Consumes: the 3 production columns from Task 1 (`email`, `telefono`, `fecha_ingreso` on `personas`) — Task 1 must be confirmed applied to production before this task's code is deployed (not before it's merged to a local branch — the deploy step, at the end of this plan's execution, is what must wait).
- Produces: nothing consumed by a later task — this is the last code task in this plan.

- [ ] **Step 1: Add the 3 new canonical fields**

In `lib/ingestion/columnMapping.ts`, replace:

```ts
export const CANONICAL_FIELDS = [
  'rut',
  'fechaInicio',
  'fechaFin',
  'dias',
  'tipoAdministrativo',
  'codigoPersona',
  'sucursal',
  'unidad',
  'cargo',
  'turno',
] as const
export type CanonicalField = (typeof CANONICAL_FIELDS)[number]
```

with:

```ts
export const CANONICAL_FIELDS = [
  'rut',
  'fechaInicio',
  'fechaFin',
  'dias',
  'tipoAdministrativo',
  'codigoPersona',
  'sucursal',
  'unidad',
  'cargo',
  'turno',
  'email',
  'telefono',
  'fechaIngreso',
] as const
export type CanonicalField = (typeof CANONICAL_FIELDS)[number]
```

Then replace the `ALIASES` record:

```ts
const ALIASES: Record<CanonicalField, string[]> = {
  rut: ['rut', 'rut trabajador', 'run'],
  fechaInicio: ['fecha inicio', 'fecha de inicio', 'inicio'],
  fechaFin: ['fecha fin', 'fecha de termino', 'fecha de término', 'termino', 'término'],
  dias: ['dias', 'días', 'dias ausencia', 'días de ausencia'],
  tipoAdministrativo: ['tipo', 'tipo licencia', 'tipo de licencia', 'tipo administrativo'],
  codigoPersona: ['codigo', 'código', 'codigo persona', 'código persona', 'legajo'],
  sucursal: ['sucursal', 'sede', 'planta'],
  unidad: ['unidad', 'area', 'área', 'departamento'],
  cargo: ['cargo', 'puesto', 'posicion', 'posición'],
  turno: ['turno'],
}
```

with:

```ts
const ALIASES: Record<CanonicalField, string[]> = {
  rut: ['rut', 'rut trabajador', 'run'],
  fechaInicio: ['fecha inicio', 'fecha de inicio', 'inicio'],
  fechaFin: ['fecha fin', 'fecha de termino', 'fecha de término', 'termino', 'término'],
  dias: ['dias', 'días', 'dias ausencia', 'días de ausencia'],
  tipoAdministrativo: ['tipo', 'tipo licencia', 'tipo de licencia', 'tipo administrativo'],
  codigoPersona: ['codigo', 'código', 'codigo persona', 'código persona', 'legajo'],
  sucursal: ['sucursal', 'sede', 'planta'],
  unidad: ['unidad', 'area', 'área', 'departamento'],
  cargo: ['cargo', 'puesto', 'posicion', 'posición'],
  turno: ['turno'],
  email: ['email', 'correo', 'correo electronico', 'correo electrónico'],
  telefono: ['telefono', 'teléfono', 'celular', 'fono'],
  fechaIngreso: ['fecha ingreso', 'fecha de ingreso', 'fecha contratacion', 'fecha de contratación'],
}
```

- [ ] **Step 2: Add UI labels for the 3 new fields**

In `components/platform/import/ColumnMappingStep.tsx`, replace:

```ts
const FIELD_LABELS: Record<CanonicalField, string> = {
  rut: 'RUT (obligatorio)',
  fechaInicio: 'Fecha de inicio (obligatorio)',
  fechaFin: 'Fecha de fin',
  dias: 'Días de ausencia (obligatorio)',
  tipoAdministrativo: 'Tipo administrativo (obligatorio)',
  codigoPersona: 'Código de persona',
  sucursal: 'Sucursal',
  unidad: 'Unidad',
  cargo: 'Cargo',
  turno: 'Turno',
}
```

with:

```ts
const FIELD_LABELS: Record<CanonicalField, string> = {
  rut: 'RUT (obligatorio)',
  fechaInicio: 'Fecha de inicio (obligatorio)',
  fechaFin: 'Fecha de fin',
  dias: 'Días de ausencia (obligatorio)',
  tipoAdministrativo: 'Tipo administrativo (obligatorio)',
  codigoPersona: 'Código de persona',
  sucursal: 'Sucursal',
  unidad: 'Unidad',
  cargo: 'Cargo',
  turno: 'Turno',
  email: 'Email',
  telefono: 'Teléfono',
  fechaIngreso: 'Fecha de ingreso',
}
```

(`ColumnMappingStep` already iterates generically over `CANONICAL_FIELDS` to render one `Select` per field — no other change is needed in this file. The `requiredFields` array inside the same component already lists only `['rut', 'fechaInicio', 'dias', 'tipoAdministrativo']` — leave it exactly as-is, do not add any of the 3 new fields to it.)

- [ ] **Step 3: Extend the row mapping in the import wizard page**

In `app/plataforma/importar/page.tsx`, replace the `toMappedRows` function:

```ts
function toMappedRows(
  parsed: ParsedSpreadsheet,
  mapping: Record<CanonicalField, string | null>
): Array<
  MappedRow & {
    codigoPersona: string | null
    sucursal: string | null
    unidad: string | null
    cargo: string | null
    turno: string | null
  }
> {
  return parsed.rows.map((row) => ({
    rut: mapping.rut ? String(row[mapping.rut] ?? '') || null : null,
    fechaInicio: mapping.fechaInicio ? String(row[mapping.fechaInicio] ?? '') || null : null,
    fechaFin: mapping.fechaFin ? String(row[mapping.fechaFin] ?? '') || null : null,
    dias: mapping.dias ? Number(row[mapping.dias]) : null,
    tipoAdministrativo: mapping.tipoAdministrativo ? String(row[mapping.tipoAdministrativo] ?? '') || null : null,
    codigoPersona: mapping.codigoPersona ? String(row[mapping.codigoPersona] ?? '') || null : null,
    sucursal: mapping.sucursal ? String(row[mapping.sucursal] ?? '') || null : null,
    unidad: mapping.unidad ? String(row[mapping.unidad] ?? '') || null : null,
    cargo: mapping.cargo ? String(row[mapping.cargo] ?? '') || null : null,
    turno: mapping.turno ? String(row[mapping.turno] ?? '') || null : null,
  }))
}
```

with:

```ts
function toMappedRows(
  parsed: ParsedSpreadsheet,
  mapping: Record<CanonicalField, string | null>
): Array<
  MappedRow & {
    codigoPersona: string | null
    sucursal: string | null
    unidad: string | null
    cargo: string | null
    turno: string | null
    email: string | null
    telefono: string | null
    fechaIngreso: string | null
  }
> {
  return parsed.rows.map((row) => ({
    rut: mapping.rut ? String(row[mapping.rut] ?? '') || null : null,
    fechaInicio: mapping.fechaInicio ? String(row[mapping.fechaInicio] ?? '') || null : null,
    fechaFin: mapping.fechaFin ? String(row[mapping.fechaFin] ?? '') || null : null,
    dias: mapping.dias ? Number(row[mapping.dias]) : null,
    tipoAdministrativo: mapping.tipoAdministrativo ? String(row[mapping.tipoAdministrativo] ?? '') || null : null,
    codigoPersona: mapping.codigoPersona ? String(row[mapping.codigoPersona] ?? '') || null : null,
    sucursal: mapping.sucursal ? String(row[mapping.sucursal] ?? '') || null : null,
    unidad: mapping.unidad ? String(row[mapping.unidad] ?? '') || null : null,
    cargo: mapping.cargo ? String(row[mapping.cargo] ?? '') || null : null,
    turno: mapping.turno ? String(row[mapping.turno] ?? '') || null : null,
    email: mapping.email ? String(row[mapping.email] ?? '') || null : null,
    telefono: mapping.telefono ? String(row[mapping.telefono] ?? '') || null : null,
    fechaIngreso: mapping.fechaIngreso ? String(row[mapping.fechaIngreso] ?? '') || null : null,
  }))
}
```

- [ ] **Step 4: Accept and persist the 3 new fields in the Route Handler**

In `app/api/platform/importaciones/ejecutar/route.ts`, replace the request body type:

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
        email: string | null
        telefono: string | null
        fechaIngreso: string | null
      }
    >
  }
```

Then replace the `personas` insert (inside the `if (!personaId)` branch):

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
          email: row.email,
          telefono: row.telefono,
          fecha_ingreso: row.fechaIngreso,
        })
        .select()
        .single()
```

(This is inside the `if (!personaId)` branch, which only runs when `existingPersona` was not found by `rut_hash` — i.e. only on first creation, matching the plan's Global Constraint that these fields are never updated on re-import, identical to how `unidad_id`/`cargo_id`/`turno_id` already behave in this same insert.)

- [ ] **Step 5: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 6: Run the full test suite (regression check — this task adds no new tests, matching the spec's testing section)**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 7: Build check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, same route list as before (no route added or removed).

- [ ] **Step 8: Commit**

```bash
git add lib/ingestion/columnMapping.ts components/platform/import/ColumnMappingStep.tsx app/plataforma/importar/page.tsx app/api/platform/importaciones/ejecutar/route.ts
git commit -m "feat: add email, telefono, and fecha de ingreso to the import wizard"
```

---

## Task 3: Manual verification — 3 simulated clinic test cases (controller-driven, not a subagent task)

Not a code task. After Task 2 ships to production, the controller runs 3 real end-to-end test
uploads through the actual import wizard (using the already-authenticated browser session), each
exercising a different combination of the new optional fields, and reports the results directly
to Jose — this is explicitly requested as a live functional validation, not an automated test
suite. Beyond "does it work mechanically", the report should also critically assess whether the
captured data would actually be useful to a real clinic/company customer — that critical framing
is why `nombre`/`fechaNacimiento`/`sexo` were dropped from scope before implementation; the same
scrutiny applies when interpreting these 3 test results.

- [ ] Caso 1: archivo con los 3 campos nuevos presentes (email, teléfono, fecha de ingreso) para
      una persona nueva — confirmar que se crea correctamente y que ningún campo obligatorio se
      ve afectado.
- [ ] Caso 2: archivo con ninguno de los 3 campos nuevos mapeados (como los archivos que ya se
      usaban antes de este cambio) — confirmar que la importación sigue funcionando exactamente
      igual que antes, sin pedir estos campos.
- [ ] Caso 3: archivo con una mezcla parcial (ej. solo email, sin teléfono ni fecha de ingreso)
      para una persona nueva, y una fila adicional para una persona que ya existe (mismo RUT que
      un caso anterior) con datos de contacto distintos — confirmar que la persona nueva guarda
      los campos parciales correctamente (los no mapeados quedan `null`, sin error), y que la
      persona ya existente NO actualiza sus campos de contacto con los nuevos valores del archivo
      (comportamiento de no-actualización en reimportación, confirmado en el spec).
