# HealthScope Data Ingestion MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data ingestion core of the private HealthScope platform — pseudonymized
people, contracts, absence episodes, a 10-step Excel/CSV import wizard with column mapping,
validation, preview and revert, and a fixed-rule classification engine (no ML/LLM) — so a
tenant can load real absence data and have it land as classified, auditable episodes. This is
the first of several plans implementing `docs/superpowers/specs/2026-07-17-data-platform-mvp.md`
(sub-plan A: data model + ingestion + classification). Indicators/dashboard, alerts, and PDF
reports are separate follow-up plans that read from the `episodios` table this plan produces.

**Architecture:** Same stack as the platform-foundation plan already in production — Next.js 16
(App Router) + Supabase (Postgres + Auth), no separate backend service. All classification is
pure-function rule evaluation (duration + frequency + administrative type against fixed
thresholds), never a trained model — this matches the spec's requirement that indicators be
reproducible and auditable. Bulk import execution is the one privileged write path (a Route
Handler using the service-role client, matching the pattern `usuarios/invitar` already
established), because inserting hundreds of episode rows per person through per-row RLS checks
from the browser is both slow and gives the browser client visibility into rows across the
whole file before they're committed; every other read/write (viewing episodes, viewing import
history, viewing quality errors) goes through the browser client with RLS as the enforcement
boundary, same as the rest of the platform.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui
(`base-nova` style) + `@supabase/ssr` + `xlsx` (SheetJS, MIT-licensed, parses both `.xlsx` and
`.csv`) + `react-hook-form` + `zod` + Vitest.

## Global Constraints

- This plan implements section 1, 2 and 4 of
  `docs/superpowers/specs/2026-07-17-data-platform-mvp.md` (ingestion channel, classification,
  minimum data model) for the subset of entities it lists as MVP-required:
  Persona, Contrato, Episodio de ausencia, Registro fuente, Tipo administrativo, Importación,
  Error de calidad. It does **not** implement indicators/formulas, alerts, PDF reports,
  campaigns, providers, or cases — those are separate follow-up plans per the spec's "Fuera de
  alcance" section.
- **No AI/ML anywhere in this plan.** Column mapping suggestions use plain string-similarity
  heuristics (exact match, then case/accent-insensitive match, then substring match) — never a
  model call. Classification is threshold-based rule evaluation. This is a hard requirement
  from the spec's own rationale (section on "por qué sin IA"), not a style preference.
- The company **never sees an individual diagnosis**. `personas` stores no name, RUT, or other
  direct identifier in the clear — only a `codigo` the tenant assigns (matching their own HRIS
  export) and a `rut_hash` (SHA-256, computed at import time, used only to detect duplicate
  people across imports, never displayed or reversible in the app). `tipo_administrativo` is
  the finest-grained clinical signal ever exposed to the employer-facing UI in this plan.
- Every table storing tenant data has `tenant_id uuid not null references tenants(id)` and RLS
  enabled with policies **and** the matching base `grant` in the same migration step — the
  platform-foundation plan shipped to production with RLS policies that were unreachable for
  weeks because the base grants were missing (found during that plan's manual verification).
  Every step in this plan that creates a table does both in the same SQL block.
- `@base-ui/react` quirks already discovered (still apply): `Button` has no `asChild` — use
  `render={<a .../>}` plus `nativeButton={false}` when the host isn't a real `<button>`.
  `Accordion`/`Select` use `multiple={false}`/plain value props, not Radix's
  `type="single" collapsible`.
- All new shadcn primitives are added via the CLI (`npx shadcn@latest add <name>`), never hand
  written.
- WCAG 2.2 AA: visible focus rings, labeled form fields, keyboard-operable wizard steps and
  tables.
- Every step that changes code shows the code. No "similar to Task N", no TODOs.
- This machine OOMs `tsc`/`vitest` at default heap size — run every verification as
  `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` /
  `... vitest run <path>` (small heap, local binary, not npx).

## File Structure

```
supabase/
  schema.sql                        (MODIFY — append ingestion schema, below the platform-foundation block)
lib/
  ingestion/
    types.ts                        (CREATE — shared TS types + mapRow* functions)
    classification.ts               (CREATE — clasificarEpisodio() rule engine + tests)
    parseFile.ts                    (CREATE — xlsx/csv → header + row extraction + tests)
    columnMapping.ts                (CREATE — heuristic mapping suggestions + tests)
    validate.ts                     (CREATE — quality rule checks + tests)
    rutHash.ts                      (CREATE — SHA-256 pseudonymization helper + tests)
app/
  plataforma/
    importar/
      page.tsx                     (CREATE — the 10-step import wizard, client-driven)
      historial/page.tsx            (CREATE — list of past imports + quality panel + revert)
  api/
    platform/
      importaciones/
        ejecutar/route.ts          (CREATE — the one privileged Route Handler, service-role)
        revertir/route.ts          (CREATE — revert Route Handler, service-role)
components/
  platform/
    import/
      FileDropzone.tsx              (CREATE)
      ColumnMappingStep.tsx          (CREATE)
      QualityErrorsTable.tsx        (CREATE)
      ImportPreviewTable.tsx        (CREATE)
      ImportSummary.tsx              (CREATE)
      ImportHistoryTable.tsx        (CREATE)
```

---

### Task 1: Schema — catálogo de tipos administrativos, personas y contratos

**Files:**
- Modify: `supabase/schema.sql` (append)
- Create: `lib/ingestion/types.ts`

**Interfaces:**
- Produces: SQL tables `tipos_administrativos`, `personas`, `contratos`. TS types
  `TipoAdministrativo`, `Persona`, `Contrato` in `lib/ingestion/types.ts` — every later task
  importing these types imports from here. Each type gets a `mapRow*()` function converting
  snake_case DB rows to camelCase, same convention as `lib/platform/types.ts`.

- [ ] **Step 1: Append the catalog and people schema to `supabase/schema.sql`**

```sql
-- ============================================================
-- INGESTION: tipos administrativos, personas, contratos
-- ============================================================

create table tipos_administrativos (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null
);

alter table tipos_administrativos enable row level security;

create policy "tipos_administrativos_select_authenticated" on tipos_administrativos
  for select to authenticated using (true);

grant select on tipos_administrativos to authenticated;
grant all on tipos_administrativos to service_role;

-- Fixed catalog from the master doc's legal leave-type taxonomy (section 12). Clave is the
-- stable key classification.ts and validate.ts check against.
insert into tipos_administrativos (clave, nombre) values
  ('enfermedad_comun', 'Enfermedad o accidente común'),
  ('prorroga_medicina_preventiva', 'Prórroga de medicina preventiva'),
  ('maternal', 'Maternal'),
  ('enfermedad_grave_hijo_menor', 'Enfermedad grave de hijo menor'),
  ('accidente_laboral', 'Accidente laboral'),
  ('accidente_trayecto', 'Accidente de trayecto'),
  ('enfermedad_profesional', 'Enfermedad profesional'),
  ('patologia_embarazo', 'Patología del embarazo'),
  ('permiso_administrativo', 'Permiso administrativo'),
  ('ausencia_injustificada', 'Ausencia injustificada'),
  ('vacaciones', 'Vacaciones'),
  ('otros', 'Otros');

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

alter table personas enable row level security;

create policy "personas_select_same_tenant" on personas
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "personas_write_admin" on personas
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update, delete on personas to authenticated;
grant all on personas to service_role;

create table contratos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  created_at timestamptz not null default now(),
  fecha_inicio date not null,
  fecha_fin date,
  tipo_contrato text not null default 'indefinido' check (tipo_contrato in ('indefinido', 'plazo_fijo', 'obra_o_faena')),
  jornada_horas_semanales numeric not null default 45
);

alter table contratos enable row level security;

create policy "contratos_select_same_tenant" on contratos
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "contratos_write_admin" on contratos
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update, delete on contratos to authenticated;
grant all on contratos to service_role;
```

- [ ] **Step 2: Create `lib/ingestion/types.ts`**

```typescript
export type TipoAdministrativoClave =
  | 'enfermedad_comun'
  | 'prorroga_medicina_preventiva'
  | 'maternal'
  | 'enfermedad_grave_hijo_menor'
  | 'accidente_laboral'
  | 'accidente_trayecto'
  | 'enfermedad_profesional'
  | 'patologia_embarazo'
  | 'permiso_administrativo'
  | 'ausencia_injustificada'
  | 'vacaciones'
  | 'otros'

export type TipoAdministrativo = {
  id: string
  clave: TipoAdministrativoClave
  nombre: string
}

export type Persona = {
  id: string
  tenantId: string
  empresaId: string
  createdAt: string
  codigo: string
  rutHash: string
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
  estado: 'activo' | 'inactivo'
}

export type Contrato = {
  id: string
  tenantId: string
  personaId: string
  createdAt: string
  fechaInicio: string
  fechaFin: string | null
  tipoContrato: 'indefinido' | 'plazo_fijo' | 'obra_o_faena'
  jornadaHorasSemanales: number
}

export function mapTipoAdministrativoRow(row: {
  id: string
  clave: string
  nombre: string
}): TipoAdministrativo {
  return {
    id: row.id,
    clave: row.clave as TipoAdministrativoClave,
    nombre: row.nombre,
  }
}

export function mapPersonaRow(row: {
  id: string
  tenant_id: string
  empresa_id: string
  created_at: string
  codigo: string
  rut_hash: string
  unidad_id: string | null
  cargo_id: string | null
  turno_id: string | null
  estado: 'activo' | 'inactivo'
}): Persona {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    empresaId: row.empresa_id,
    createdAt: row.created_at,
    codigo: row.codigo,
    rutHash: row.rut_hash,
    unidadId: row.unidad_id,
    cargoId: row.cargo_id,
    turnoId: row.turno_id,
    estado: row.estado,
  }
}

export function mapContratoRow(row: {
  id: string
  tenant_id: string
  persona_id: string
  created_at: string
  fecha_inicio: string
  fecha_fin: string | null
  tipo_contrato: 'indefinido' | 'plazo_fijo' | 'obra_o_faena'
  jornada_horas_semanales: number
}): Contrato {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    createdAt: row.created_at,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    tipoContrato: row.tipo_contrato,
    jornadaHorasSemanales: row.jornada_horas_semanales,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql lib/ingestion/types.ts
git commit -m "feat: add tipos_administrativos, personas and contratos schema"
```

---

### Task 2: Schema — importaciones, errores de calidad, episodios

**Files:**
- Modify: `supabase/schema.sql` (append)
- Modify: `lib/ingestion/types.ts` (append `Importacion`, `ErrorCalidad`, `Episodio` types)

**Interfaces:**
- Consumes: `tenants`, `personas`, `tipos_administrativos` (Task 1).
- Produces: SQL tables `importaciones`, `errores_calidad`, `episodios`. TS types
  `Importacion`, `ErrorCalidad`, `Episodio`, plus `mapImportacionRow`, `mapErrorCalidadRow`,
  `mapEpisodioRow`.

- [ ] **Step 1: Append to `supabase/schema.sql`**

```sql
-- ============================================================
-- INGESTION: importaciones, errores de calidad, episodios
-- ============================================================

create table importaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  responsable_id uuid not null references usuarios(id),
  archivo_nombre text not null,
  archivo_hash text not null,
  estado text not null default 'en_progreso'
    check (estado in ('en_progreso', 'completada', 'revertida', 'fallida')),
  filas_procesadas integer not null default 0,
  filas_rechazadas integer not null default 0,
  advertencias integer not null default 0
);

alter table importaciones enable row level security;

create policy "importaciones_select_same_tenant" on importaciones
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "importaciones_write_admin" on importaciones
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update on importaciones to authenticated;
grant all on importaciones to service_role;

create table errores_calidad (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  importacion_id uuid not null references importaciones(id) on delete cascade,
  fila integer not null,
  severidad text not null check (severidad in ('critico', 'advertencia')),
  tipo text not null,
  mensaje text not null
);

alter table errores_calidad enable row level security;

create policy "errores_calidad_select_same_tenant" on errores_calidad
  for select to authenticated using (tenant_id = auth_tenant_id());

grant select on errores_calidad to authenticated;
grant all on errores_calidad to service_role;

create table episodios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  created_at timestamptz not null default now(),
  importacion_id uuid references importaciones(id),
  tipo_administrativo_id uuid not null references tipos_administrativos(id),
  fecha_inicio date not null,
  fecha_fin date,
  dias integer not null,
  clasificacion_analitica text not null default 'sin_clasificar' check (
    clasificacion_analitica in (
      'corto', 'mediano', 'prolongado', 'recurrente', 'continuacion',
      'accidente', 'enfermedad_profesional', 'maternal', 'cuidado_familiar',
      'sin_clasificar', 'calidad_insuficiente'
    )
  ),
  estado text not null default 'cerrado' check (estado in ('abierto', 'cerrado'))
);

alter table episodios enable row level security;

create policy "episodios_select_same_tenant" on episodios
  for select to authenticated using (tenant_id = auth_tenant_id());

create policy "episodios_write_admin" on episodios
  for all to authenticated
  using (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']))
  with check (tenant_id = auth_tenant_id() and auth_has_role(array['superadmin', 'admin_cliente']));

grant select, insert, update, delete on episodios to authenticated;
grant all on episodios to service_role;
```

- [ ] **Step 2: Append types to `lib/ingestion/types.ts`**

```typescript
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

export type ErrorCalidad = {
  id: string
  tenantId: string
  importacionId: string
  fila: number
  severidad: 'critico' | 'advertencia'
  tipo: string
  mensaje: string
}

export type ClasificacionAnalitica =
  | 'corto'
  | 'mediano'
  | 'prolongado'
  | 'recurrente'
  | 'continuacion'
  | 'accidente'
  | 'enfermedad_profesional'
  | 'maternal'
  | 'cuidado_familiar'
  | 'sin_clasificar'
  | 'calidad_insuficiente'

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

export function mapImportacionRow(row: {
  id: string
  tenant_id: string
  created_at: string
  responsable_id: string
  archivo_nombre: string
  archivo_hash: string
  estado: 'en_progreso' | 'completada' | 'revertida' | 'fallida'
  filas_procesadas: number
  filas_rechazadas: number
  advertencias: number
}): Importacion {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    responsableId: row.responsable_id,
    archivoNombre: row.archivo_nombre,
    archivoHash: row.archivo_hash,
    estado: row.estado,
    filasProcesadas: row.filas_procesadas,
    filasRechazadas: row.filas_rechazadas,
    advertencias: row.advertencias,
  }
}

export function mapErrorCalidadRow(row: {
  id: string
  tenant_id: string
  importacion_id: string
  fila: number
  severidad: 'critico' | 'advertencia'
  tipo: string
  mensaje: string
}): ErrorCalidad {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    importacionId: row.importacion_id,
    fila: row.fila,
    severidad: row.severidad,
    tipo: row.tipo,
    mensaje: row.mensaje,
  }
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
}): Episodio {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    createdAt: row.created_at,
    importacionId: row.importacion_id,
    tipoAdministrativoId: row.tipo_administrativo_id,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    dias: row.dias,
    clasificacionAnalitica: row.clasificacion_analitica,
    estado: row.estado,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql lib/ingestion/types.ts
git commit -m "feat: add importaciones, errores_calidad and episodios schema"
```

---

### Task 3: Classification rule engine

**Files:**
- Create: `lib/ingestion/classification.ts`
- Test: `lib/ingestion/classification.test.ts`

**Interfaces:**
- Consumes: `TipoAdministrativoClave` (Task 1).
- Produces: `clasificarEpisodio(input: ClasificacionInput): ClasificacionAnalitica` — called by
  Task 9's import execution Route Handler for every row, and reusable later by a
  reclassification job if thresholds change.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/ingestion/classification.test.ts
import { describe, expect, it } from 'vitest'
import { clasificarEpisodio } from './classification'

describe('clasificarEpisodio', () => {
  it('classifies accidents by administrative type regardless of duration', () => {
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'accidente_laboral', dias: 2, episodiosPrevios12Meses: 0 })
    ).toBe('accidente')
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'accidente_trayecto', dias: 30, episodiosPrevios12Meses: 0 })
    ).toBe('accidente')
  })

  it('classifies enfermedad_profesional and maternal by administrative type', () => {
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'enfermedad_profesional', dias: 5, episodiosPrevios12Meses: 0 })
    ).toBe('enfermedad_profesional')
    expect(clasificarEpisodio({ tipoAdministrativo: 'maternal', dias: 100, episodiosPrevios12Meses: 0 })).toBe(
      'maternal'
    )
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'patologia_embarazo', dias: 20, episodiosPrevios12Meses: 0 })
    ).toBe('maternal')
  })

  it('classifies enfermedad_grave_hijo_menor as cuidado_familiar', () => {
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'enfermedad_grave_hijo_menor', dias: 3, episodiosPrevios12Meses: 0 })
    ).toBe('cuidado_familiar')
  })

  it('classifies common-illness episodes by duration when not recurrent', () => {
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: 2, episodiosPrevios12Meses: 0 })).toBe(
      'corto'
    )
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: 5, episodiosPrevios12Meses: 0 })).toBe(
      'mediano'
    )
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: 31, episodiosPrevios12Meses: 0 })).toBe(
      'prolongado'
    )
  })

  it('classifies as recurrente when the person has 2+ prior episodes in 12 months, overriding duration', () => {
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: 2, episodiosPrevios12Meses: 2 })).toBe(
      'recurrente'
    )
  })

  it('treats prorroga_medicina_preventiva as continuacion', () => {
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'prorroga_medicina_preventiva', dias: 10, episodiosPrevios12Meses: 0 })
    ).toBe('continuacion')
  })

  it('classifies non-clinical administrative types (permits, vacation, unjustified) as sin_clasificar', () => {
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'permiso_administrativo', dias: 1, episodiosPrevios12Meses: 0 })
    ).toBe('sin_clasificar')
    expect(clasificarEpisodio({ tipoAdministrativo: 'vacaciones', dias: 15, episodiosPrevios12Meses: 0 })).toBe(
      'sin_clasificar'
    )
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'ausencia_injustificada', dias: 1, episodiosPrevios12Meses: 0 })
    ).toBe('sin_clasificar')
    expect(clasificarEpisodio({ tipoAdministrativo: 'otros', dias: 4, episodiosPrevios12Meses: 0 })).toBe(
      'sin_clasificar'
    )
  })

  it('returns calidad_insuficiente when dias is not a positive number', () => {
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: 0, episodiosPrevios12Meses: 0 })).toBe(
      'calidad_insuficiente'
    )
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: -1, episodiosPrevios12Meses: 0 })).toBe(
      'calidad_insuficiente'
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/classification.test.ts`
Expected: FAIL with "Cannot find module './classification'"

- [ ] **Step 3: Write `lib/ingestion/classification.ts`**

```typescript
import type { ClasificacionAnalitica, TipoAdministrativoClave } from './types'

export type ClasificacionInput = {
  tipoAdministrativo: TipoAdministrativoClave
  dias: number
  episodiosPrevios12Meses: number
}

const CORTO_MAX_DIAS = 3
const MEDIANO_MAX_DIAS = 30

// Fixed-threshold rule table, not a trained model — see Global Constraints. Order matters:
// administrative type overrides (accident/professional-illness/maternal/family-care/
// continuation/non-clinical) are checked before the duration-and-recurrence rules, since
// those types carry their own clinical meaning regardless of how long the episode lasted.
export function clasificarEpisodio(input: ClasificacionInput): ClasificacionAnalitica {
  if (!Number.isFinite(input.dias) || input.dias <= 0) {
    return 'calidad_insuficiente'
  }

  switch (input.tipoAdministrativo) {
    case 'accidente_laboral':
    case 'accidente_trayecto':
      return 'accidente'
    case 'enfermedad_profesional':
      return 'enfermedad_profesional'
    case 'maternal':
    case 'patologia_embarazo':
      return 'maternal'
    case 'enfermedad_grave_hijo_menor':
      return 'cuidado_familiar'
    case 'prorroga_medicina_preventiva':
      return 'continuacion'
    case 'permiso_administrativo':
    case 'ausencia_injustificada':
    case 'vacaciones':
    case 'otros':
      return 'sin_clasificar'
    case 'enfermedad_comun':
      break
  }

  if (input.episodiosPrevios12Meses >= 2) {
    return 'recurrente'
  }
  if (input.dias <= CORTO_MAX_DIAS) {
    return 'corto'
  }
  if (input.dias <= MEDIANO_MAX_DIAS) {
    return 'mediano'
  }
  return 'prolongado'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/classification.test.ts`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add lib/ingestion/classification.ts lib/ingestion/classification.test.ts
git commit -m "feat: add fixed-rule episode classification engine"
```

---

### Task 4: Pseudonymization helper (RUT hashing)

**Files:**
- Create: `lib/ingestion/rutHash.ts`
- Test: `lib/ingestion/rutHash.test.ts`

**Interfaces:**
- Produces: `hashRut(rut: string): Promise<string>` — normalizes a Chilean RUT (strips dots,
  dashes, uppercases the check digit) then SHA-256 hashes it via the Web Crypto API (available
  in both the browser and the Next.js Node/Edge runtime, no extra dependency). Task 6
  (validation) and Task 9 (import execution) both call this to detect the same person across
  imports without ever storing or displaying the RUT itself.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/ingestion/rutHash.test.ts
import { describe, expect, it } from 'vitest'
import { hashRut, normalizeRut } from './rutHash'

describe('normalizeRut', () => {
  it('strips dots and dashes and uppercases the check digit', () => {
    expect(normalizeRut('12.345.678-9')).toBe('123456789')
    expect(normalizeRut('12345678-k')).toBe('12345678K')
  })
})

describe('hashRut', () => {
  it('produces the same hash for equivalent RUT formats', async () => {
    const a = await hashRut('12.345.678-9')
    const b = await hashRut('12345678-9')
    expect(a).toBe(b)
  })

  it('produces different hashes for different RUTs', async () => {
    const a = await hashRut('12.345.678-9')
    const b = await hashRut('11.111.111-1')
    expect(a).not.toBe(b)
  })

  it('produces a 64-character hex digest', async () => {
    const hash = await hashRut('12.345.678-9')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/rutHash.test.ts`
Expected: FAIL with "Cannot find module './rutHash'"

- [ ] **Step 3: Write `lib/ingestion/rutHash.ts`**

```typescript
export function normalizeRut(rut: string): string {
  return rut.replace(/[.\-\s]/g, '').toUpperCase()
}

export async function hashRut(rut: string): Promise<string> {
  const normalized = normalizeRut(rut)
  const bytes = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/rutHash.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add lib/ingestion/rutHash.ts lib/ingestion/rutHash.test.ts
git commit -m "feat: add RUT pseudonymization helper"
```

---

### Task 5: File parsing (Excel/CSV → rows)

**Files:**
- Modify: `package.json` (add `xlsx`)
- Create: `lib/ingestion/parseFile.ts`
- Test: `lib/ingestion/parseFile.test.ts`

**Interfaces:**
- Produces: `parseSpreadsheet(file: ArrayBuffer): ParsedSpreadsheet` where
  `ParsedSpreadsheet = { headers: string[]; rows: Record<string, unknown>[] }` — Task 7's
  upload step calls this in the browser immediately after file selection (SheetJS runs
  client-side, no upload to a server needed just to read headers).

- [ ] **Step 1: Install `xlsx`**

```bash
npm install xlsx
```

- [ ] **Step 2: Write the failing test**

```typescript
// lib/ingestion/parseFile.test.ts
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseSpreadsheet } from './parseFile'

function buildWorkbookBuffer(rows: (string | number)[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

describe('parseSpreadsheet', () => {
  it('extracts headers from the first row and rows as header-keyed objects', () => {
    const buffer = buildWorkbookBuffer([
      ['RUT', 'Fecha inicio', 'Días'],
      ['12.345.678-9', '2026-01-05', 3],
      ['11.111.111-1', '2026-02-10', 10],
    ])

    const result = parseSpreadsheet(buffer)

    expect(result.headers).toEqual(['RUT', 'Fecha inicio', 'Días'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ RUT: '12.345.678-9', 'Fecha inicio': '2026-01-05', Días: 3 })
  })

  it('returns an empty rows array for a header-only file', () => {
    const buffer = buildWorkbookBuffer([['RUT', 'Fecha inicio', 'Días']])
    const result = parseSpreadsheet(buffer)
    expect(result.headers).toEqual(['RUT', 'Fecha inicio', 'Días'])
    expect(result.rows).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/parseFile.test.ts`
Expected: FAIL with "Cannot find module './parseFile'"

- [ ] **Step 4: Write `lib/ingestion/parseFile.ts`**

```typescript
import * as XLSX from 'xlsx'

export type ParsedSpreadsheet = {
  headers: string[]
  rows: Record<string, unknown>[]
}

export function parseSpreadsheet(file: ArrayBuffer): ParsedSpreadsheet {
  const workbook = XLSX.read(file, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null })
  const headers = rows.length > 0 ? Object.keys(rows[0]) : (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[] | undefined) ?? []

  return { headers, rows }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/parseFile.test.ts`
Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/ingestion/parseFile.ts lib/ingestion/parseFile.test.ts
git commit -m "feat: add spreadsheet parsing for the import wizard"
```

---

### Task 6: Column mapping heuristics

**Files:**
- Create: `lib/ingestion/columnMapping.ts`
- Test: `lib/ingestion/columnMapping.test.ts`

**Interfaces:**
- Consumes: `headers: string[]` (Task 5's output).
- Produces: `CANONICAL_FIELDS` (the fixed list of model fields a file can map to) and
  `suggestColumnMapping(headers: string[]): Record<CanonicalField, string | null>` — Task 7's
  mapping step pre-fills the UI with this, the user confirms or overrides every field (never
  applied without confirmation, per the spec).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/ingestion/columnMapping.test.ts
import { describe, expect, it } from 'vitest'
import { suggestColumnMapping } from './columnMapping'

describe('suggestColumnMapping', () => {
  it('matches headers that exactly equal a canonical field label', () => {
    const result = suggestColumnMapping(['RUT', 'Fecha inicio', 'Fecha fin', 'Tipo'])
    expect(result.rut).toBe('RUT')
    expect(result.fechaInicio).toBe('Fecha inicio')
    expect(result.fechaFin).toBe('Fecha fin')
    expect(result.tipoAdministrativo).toBe('Tipo')
  })

  it('matches case- and accent-insensitively', () => {
    const result = suggestColumnMapping(['rut', 'FECHA DE INICIO', 'dias'])
    expect(result.rut).toBe('rut')
    expect(result.dias).toBe('dias')
  })

  it('leaves a field unmapped (null) when no header is a plausible match', () => {
    const result = suggestColumnMapping(['columna_desconocida'])
    expect(result.rut).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/columnMapping.test.ts`
Expected: FAIL with "Cannot find module './columnMapping'"

- [ ] **Step 3: Write `lib/ingestion/columnMapping.ts`**

```typescript
export const CANONICAL_FIELDS = ['rut', 'fechaInicio', 'fechaFin', 'dias', 'tipoAdministrativo', 'codigoPersona'] as const
export type CanonicalField = (typeof CANONICAL_FIELDS)[number]

// Plain string-similarity aliases, no model — see Global Constraints. Listed in priority
// order per field; the first header that matches any alias wins.
const ALIASES: Record<CanonicalField, string[]> = {
  rut: ['rut', 'rut trabajador', 'run'],
  fechaInicio: ['fecha inicio', 'fecha de inicio', 'inicio'],
  fechaFin: ['fecha fin', 'fecha de termino', 'fecha de término', 'termino', 'término'],
  dias: ['dias', 'días', 'dias ausencia', 'días de ausencia'],
  tipoAdministrativo: ['tipo', 'tipo licencia', 'tipo de licencia', 'tipo administrativo'],
  codigoPersona: ['codigo', 'código', 'codigo persona', 'código persona', 'legajo'],
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

export function suggestColumnMapping(headers: string[]): Record<CanonicalField, string | null> {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalize(header) }))
  const result = {} as Record<CanonicalField, string | null>

  for (const field of CANONICAL_FIELDS) {
    const aliases = ALIASES[field]
    const match = normalizedHeaders.find((candidate) => aliases.includes(candidate.normalized))
    result[field] = match?.header ?? null
  }

  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/columnMapping.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add lib/ingestion/columnMapping.ts lib/ingestion/columnMapping.test.ts
git commit -m "feat: add heuristic column mapping suggestions"
```

---

### Task 7: Validation / quality rules

**Files:**
- Create: `lib/ingestion/validate.ts`
- Test: `lib/ingestion/validate.test.ts`

**Interfaces:**
- Consumes: `CanonicalField` (Task 6), `TipoAdministrativoClave` (Task 1).
- Produces: `validateRows(input: ValidateRowsInput): ValidationResult` where
  `ValidationResult = { filaErrors: Map<number, RowError[]>, resumen: { criticos: number,
  advertencias: number } }` — Task 8's preview step and Task 9's execution step both call this;
  execution refuses to insert a row with any `critico` error.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/ingestion/validate.test.ts
import { describe, expect, it } from 'vitest'
import { validateRows } from './validate'

const tiposValidos = ['enfermedad_comun', 'accidente_laboral']

describe('validateRows', () => {
  it('flags a missing required field as critical', () => {
    const result = validateRows({
      rows: [{ rut: null, fechaInicio: '2026-01-05', dias: 3, tipoAdministrativo: 'enfermedad_comun' }],
      tiposValidos,
    })
    expect(result.resumen.criticos).toBe(1)
    expect(result.filaErrors.get(0)?.[0].tipo).toBe('campo_obligatorio_faltante')
  })

  it('flags negative or zero dias as critical', () => {
    const result = validateRows({
      rows: [{ rut: '12345678-9', fechaInicio: '2026-01-05', dias: -1, tipoAdministrativo: 'enfermedad_comun' }],
      tiposValidos,
    })
    expect(result.filaErrors.get(0)?.some((e) => e.tipo === 'duracion_invalida')).toBe(true)
  })

  it('flags an unrecognized tipoAdministrativo as critical', () => {
    const result = validateRows({
      rows: [{ rut: '12345678-9', fechaInicio: '2026-01-05', dias: 3, tipoAdministrativo: 'inventado' }],
      tiposValidos,
    })
    expect(result.filaErrors.get(0)?.some((e) => e.tipo === 'tipo_no_reconocido')).toBe(true)
  })

  it('flags an impossible date (fechaFin before fechaInicio) as critical', () => {
    const result = validateRows({
      rows: [
        {
          rut: '12345678-9',
          fechaInicio: '2026-02-01',
          fechaFin: '2026-01-01',
          dias: 3,
          tipoAdministrativo: 'enfermedad_comun',
        },
      ],
      tiposValidos,
    })
    expect(result.filaErrors.get(0)?.some((e) => e.tipo === 'fecha_imposible')).toBe(true)
  })

  it('flags a duplicate row (same rut + fechaInicio) as a warning, keeping the first', () => {
    const result = validateRows({
      rows: [
        { rut: '12345678-9', fechaInicio: '2026-01-05', dias: 3, tipoAdministrativo: 'enfermedad_comun' },
        { rut: '12345678-9', fechaInicio: '2026-01-05', dias: 3, tipoAdministrativo: 'enfermedad_comun' },
      ],
      tiposValidos,
    })
    expect(result.filaErrors.get(0)).toBeUndefined()
    expect(result.filaErrors.get(1)?.[0]).toEqual({ tipo: 'fila_duplicada', severidad: 'advertencia', mensaje: expect.any(String) })
    expect(result.resumen.advertencias).toBe(1)
  })

  it('flags overlapping periods for the same person as critical', () => {
    const result = validateRows({
      rows: [
        {
          rut: '12345678-9',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-01-10',
          dias: 10,
          tipoAdministrativo: 'enfermedad_comun',
        },
        {
          rut: '12345678-9',
          fechaInicio: '2026-01-05',
          fechaFin: '2026-01-15',
          dias: 11,
          tipoAdministrativo: 'enfermedad_comun',
        },
      ],
      tiposValidos,
    })
    expect(result.filaErrors.get(1)?.some((e) => e.tipo === 'periodo_superpuesto')).toBe(true)
  })

  it('returns zero errors for a clean, non-overlapping row set', () => {
    const result = validateRows({
      rows: [
        { rut: '12345678-9', fechaInicio: '2026-01-05', dias: 3, tipoAdministrativo: 'enfermedad_comun' },
        { rut: '11111111-1', fechaInicio: '2026-02-10', dias: 5, tipoAdministrativo: 'accidente_laboral' },
      ],
      tiposValidos,
    })
    expect(result.resumen.criticos).toBe(0)
    expect(result.resumen.advertencias).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/validate.test.ts`
Expected: FAIL with "Cannot find module './validate'"

- [ ] **Step 3: Write `lib/ingestion/validate.ts`**

```typescript
export type MappedRow = {
  rut: string | null
  fechaInicio: string | null
  fechaFin?: string | null
  dias: number | null
  tipoAdministrativo: string | null
}

export type RowError = {
  tipo: string
  severidad: 'critico' | 'advertencia'
  mensaje: string
}

export type ValidationResult = {
  filaErrors: Map<number, RowError[]>
  resumen: { criticos: number; advertencias: number }
}

function addError(filaErrors: Map<number, RowError[]>, fila: number, error: RowError) {
  const existing = filaErrors.get(fila) ?? []
  existing.push(error)
  filaErrors.set(fila, existing)
}

export function validateRows(input: { rows: MappedRow[]; tiposValidos: string[] }): ValidationResult {
  const filaErrors = new Map<number, RowError[]>()
  const seenKeys = new Map<string, number>()
  const periodsByRut = new Map<string, Array<{ fila: number; inicio: string; fin: string }>>()

  input.rows.forEach((row, fila) => {
    if (!row.rut || !row.fechaInicio || !row.tipoAdministrativo) {
      addError(filaErrors, fila, {
        tipo: 'campo_obligatorio_faltante',
        severidad: 'critico',
        mensaje: 'Falta RUT, fecha de inicio o tipo administrativo.',
      })
      return
    }

    if (row.dias === null || !Number.isFinite(row.dias) || row.dias <= 0) {
      addError(filaErrors, fila, {
        tipo: 'duracion_invalida',
        severidad: 'critico',
        mensaje: 'Los días de ausencia deben ser un número positivo.',
      })
    }

    if (!input.tiposValidos.includes(row.tipoAdministrativo)) {
      addError(filaErrors, fila, {
        tipo: 'tipo_no_reconocido',
        severidad: 'critico',
        mensaje: `El tipo administrativo "${row.tipoAdministrativo}" no está en el catálogo.`,
      })
    }

    const fin = row.fechaFin ?? row.fechaInicio
    if (row.fechaFin && new Date(row.fechaFin) < new Date(row.fechaInicio)) {
      addError(filaErrors, fila, {
        tipo: 'fecha_imposible',
        severidad: 'critico',
        mensaje: 'La fecha de fin es anterior a la fecha de inicio.',
      })
    }

    const dedupeKey = `${row.rut}|${row.fechaInicio}`
    const firstSeenAt = seenKeys.get(dedupeKey)
    if (firstSeenAt !== undefined) {
      addError(filaErrors, fila, {
        tipo: 'fila_duplicada',
        severidad: 'advertencia',
        mensaje: `Fila duplicada de la fila ${firstSeenAt + 1}.`,
      })
    } else {
      seenKeys.set(dedupeKey, fila)
    }

    const periods = periodsByRut.get(row.rut) ?? []
    for (const previous of periods) {
      const overlaps = new Date(row.fechaInicio) <= new Date(previous.fin) && new Date(fin) >= new Date(previous.inicio)
      if (overlaps) {
        addError(filaErrors, fila, {
          tipo: 'periodo_superpuesto',
          severidad: 'critico',
          mensaje: `Se superpone con el período de la fila ${previous.fila + 1}.`,
        })
      }
    }
    periods.push({ fila, inicio: row.fechaInicio, fin })
    periodsByRut.set(row.rut, periods)
  })

  let criticos = 0
  let advertencias = 0
  for (const errors of filaErrors.values()) {
    for (const error of errors) {
      if (error.severidad === 'critico') criticos += 1
      else advertencias += 1
    }
  }

  return { filaErrors, resumen: { criticos, advertencias } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run lib/ingestion/validate.test.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add lib/ingestion/validate.ts lib/ingestion/validate.test.ts
git commit -m "feat: add import quality validation rules"
```

---

### Task 8: Import wizard — steps 1-3 (upload, detect, map)

**Files:**
- Create: `app/plataforma/importar/page.tsx`
- Create: `components/platform/import/FileDropzone.tsx`
- Create: `components/platform/import/ColumnMappingStep.tsx`

**Interfaces:**
- Consumes: `parseSpreadsheet` (Task 5), `suggestColumnMapping`, `CANONICAL_FIELDS`,
  `CanonicalField` (Task 6).
- Produces: wizard state `{ step, file, parsed, mapping }` held in `page.tsx`, passed down —
  Task 9 continues this same state machine for steps 4-6.

- [ ] **Step 1: Install the shadcn primitives this task needs**

```bash
npx shadcn@latest add progress
```

- [ ] **Step 2: Create `components/platform/import/FileDropzone.tsx`**

```tsx
'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'

export function FileDropzone({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) onFileSelected(file)
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
      <p className="text-sm text-muted-foreground">Selecciona un archivo Excel (.xlsx) o CSV.</p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleChange}
        className="hidden"
        aria-label="Seleccionar archivo de importación"
      />
      <Button type="button" className="mt-4" onClick={() => inputRef.current?.click()}>
        Elegir archivo
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/platform/import/ColumnMappingStep.tsx`**

```tsx
'use client'

import { CANONICAL_FIELDS, type CanonicalField } from '@/lib/ingestion/columnMapping'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const FIELD_LABELS: Record<CanonicalField, string> = {
  rut: 'RUT (obligatorio)',
  fechaInicio: 'Fecha de inicio (obligatorio)',
  fechaFin: 'Fecha de fin',
  dias: 'Días de ausencia (obligatorio)',
  tipoAdministrativo: 'Tipo administrativo (obligatorio)',
  codigoPersona: 'Código de persona',
}

export function ColumnMappingStep({
  headers,
  mapping,
  onChange,
  onConfirm,
}: {
  headers: string[]
  mapping: Record<CanonicalField, string | null>
  onChange: (field: CanonicalField, header: string | null) => void
  onConfirm: () => void
}) {
  const requiredFields: CanonicalField[] = ['rut', 'fechaInicio', 'dias', 'tipoAdministrativo']
  const missingRequired = requiredFields.filter((field) => !mapping[field])

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">Mapear columnas</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {CANONICAL_FIELDS.map((field) => (
          <div key={field} className="space-y-1.5">
            <label className="text-sm text-muted-foreground">{FIELD_LABELS[field]}</label>
            <Select
              value={mapping[field] ?? '__none__'}
              onValueChange={(value) => onChange(field, value === '__none__' ? null : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin mapear</SelectItem>
                {headers.map((header) => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {missingRequired.length > 0 ? (
        <p className="text-sm text-destructive">
          Faltan campos obligatorios: {missingRequired.map((field) => FIELD_LABELS[field]).join(', ')}.
        </p>
      ) : null}
      <Button type="button" disabled={missingRequired.length > 0} onClick={onConfirm}>
        Continuar
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/plataforma/importar/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { parseSpreadsheet, type ParsedSpreadsheet } from '@/lib/ingestion/parseFile'
import { suggestColumnMapping, type CanonicalField } from '@/lib/ingestion/columnMapping'
import { FileDropzone } from '@/components/platform/import/FileDropzone'
import { ColumnMappingStep } from '@/components/platform/import/ColumnMappingStep'

type WizardStep = 'subir' | 'mapear' | 'validar' | 'confirmar' | 'resumen'

export default function ImportarPage() {
  const [step, setStep] = useState<WizardStep>('subir')
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null)
  const [mapping, setMapping] = useState<Record<CanonicalField, string | null> | null>(null)

  async function handleFileSelected(file: File) {
    const buffer = await file.arrayBuffer()
    const result = parseSpreadsheet(buffer)
    setParsed(result)
    setMapping(suggestColumnMapping(result.headers))
    setStep('mapear')
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Importar datos</h1>

      {step === 'subir' ? <FileDropzone onFileSelected={handleFileSelected} /> : null}

      {step === 'mapear' && parsed && mapping ? (
        <ColumnMappingStep
          headers={parsed.headers}
          mapping={mapping}
          onChange={(field, header) => setMapping((prev) => (prev ? { ...prev, [field]: header } : prev))}
          onConfirm={() => setStep('validar')}
        />
      ) : null}

      {step === 'validar' ? (
        <p className="text-sm text-muted-foreground">Validación — continúa en la Tarea 9.</p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/plataforma/importar components/platform/import/FileDropzone.tsx components/platform/import/ColumnMappingStep.tsx components/ui/progress.tsx
git commit -m "feat: add import wizard upload and column mapping steps"
```

---

### Task 9: Import wizard — steps 4-7 (validate, errors, preview, confirm)

**Files:**
- Modify: `app/plataforma/importar/page.tsx`
- Create: `components/platform/import/QualityErrorsTable.tsx`
- Create: `components/platform/import/ImportPreviewTable.tsx`

**Interfaces:**
- Consumes: `validateRows`, `MappedRow`, `RowError` (Task 7).
- Produces: wizard state gains `mappedRows: MappedRow[]` and `validation: ValidationResult` —
  Task 10 consumes both when the user clicks "Ejecutar importación".

- [ ] **Step 1: Create `components/platform/import/QualityErrorsTable.tsx`**

```tsx
import type { RowError } from '@/lib/ingestion/validate'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export function QualityErrorsTable({ filaErrors }: { filaErrors: Map<number, RowError[]> }) {
  const entries = Array.from(filaErrors.entries())

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No se encontraron errores de calidad.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fila</TableHead>
          <TableHead>Severidad</TableHead>
          <TableHead>Mensaje</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.flatMap(([fila, errors]) =>
          errors.map((error, index) => (
            <TableRow key={`${fila}-${index}`}>
              <TableCell>{fila + 1}</TableCell>
              <TableCell>
                <Badge variant={error.severidad === 'critico' ? 'destructive' : 'secondary'}>
                  {error.severidad === 'critico' ? 'Crítico' : 'Advertencia'}
                </Badge>
              </TableCell>
              <TableCell>{error.mensaje}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Create `components/platform/import/ImportPreviewTable.tsx`**

```tsx
import type { MappedRow } from '@/lib/ingestion/validate'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ImportPreviewTable({ rows, excludedRows }: { rows: MappedRow[]; excludedRows: Set<number> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fila</TableHead>
          <TableHead>RUT</TableHead>
          <TableHead>Fecha inicio</TableHead>
          <TableHead>Días</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Se importará</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={index}>
            <TableCell>{index + 1}</TableCell>
            <TableCell>{row.rut}</TableCell>
            <TableCell>{row.fechaInicio}</TableCell>
            <TableCell>{row.dias}</TableCell>
            <TableCell>{row.tipoAdministrativo}</TableCell>
            <TableCell>{excludedRows.has(index) ? 'No' : 'Sí'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 3: Extend `app/plataforma/importar/page.tsx` with validation and preview**

Replace the file's contents:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { parseSpreadsheet, type ParsedSpreadsheet } from '@/lib/ingestion/parseFile'
import { suggestColumnMapping, type CanonicalField } from '@/lib/ingestion/columnMapping'
import { validateRows, type MappedRow } from '@/lib/ingestion/validate'
import { FileDropzone } from '@/components/platform/import/FileDropzone'
import { ColumnMappingStep } from '@/components/platform/import/ColumnMappingStep'
import { QualityErrorsTable } from '@/components/platform/import/QualityErrorsTable'
import { ImportPreviewTable } from '@/components/platform/import/ImportPreviewTable'
import { Button } from '@/components/ui/button'

type WizardStep = 'subir' | 'mapear' | 'validar' | 'confirmar' | 'resumen'

const TIPOS_VALIDOS = [
  'enfermedad_comun',
  'prorroga_medicina_preventiva',
  'maternal',
  'enfermedad_grave_hijo_menor',
  'accidente_laboral',
  'accidente_trayecto',
  'enfermedad_profesional',
  'patologia_embarazo',
  'permiso_administrativo',
  'ausencia_injustificada',
  'vacaciones',
  'otros',
]

function toMappedRows(
  parsed: ParsedSpreadsheet,
  mapping: Record<CanonicalField, string | null>
): MappedRow[] {
  return parsed.rows.map((row) => ({
    rut: mapping.rut ? String(row[mapping.rut] ?? '') || null : null,
    fechaInicio: mapping.fechaInicio ? String(row[mapping.fechaInicio] ?? '') || null : null,
    fechaFin: mapping.fechaFin ? String(row[mapping.fechaFin] ?? '') || null : null,
    dias: mapping.dias ? Number(row[mapping.dias]) : null,
    tipoAdministrativo: mapping.tipoAdministrativo ? String(row[mapping.tipoAdministrativo] ?? '') || null : null,
  }))
}

export default function ImportarPage() {
  const [step, setStep] = useState<WizardStep>('subir')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null)
  const [mapping, setMapping] = useState<Record<CanonicalField, string | null> | null>(null)

  const mappedRows = useMemo(() => (parsed && mapping ? toMappedRows(parsed, mapping) : []), [parsed, mapping])
  const validation = useMemo(() => validateRows({ rows: mappedRows, tiposValidos: TIPOS_VALIDOS }), [mappedRows])
  const excludedRows = useMemo(() => {
    const excluded = new Set<number>()
    for (const [fila, errors] of validation.filaErrors) {
      if (errors.some((error) => error.severidad === 'critico')) excluded.add(fila)
    }
    return excluded
  }, [validation])

  async function handleFileSelected(selected: File) {
    const buffer = await selected.arrayBuffer()
    const result = parseSpreadsheet(buffer)
    setFile(selected)
    setParsed(result)
    setMapping(suggestColumnMapping(result.headers))
    setStep('mapear')
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Importar datos</h1>

      {step === 'subir' ? <FileDropzone onFileSelected={handleFileSelected} /> : null}

      {step === 'mapear' && parsed && mapping ? (
        <ColumnMappingStep
          headers={parsed.headers}
          mapping={mapping}
          onChange={(field, header) => setMapping((prev) => (prev ? { ...prev, [field]: header } : prev))}
          onConfirm={() => setStep('validar')}
        />
      ) : null}

      {step === 'validar' ? (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Calidad de datos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {validation.resumen.criticos} errores críticos (excluidos de la importación),{' '}
              {validation.resumen.advertencias} advertencias.
            </p>
          </div>
          <QualityErrorsTable filaErrors={validation.filaErrors} />
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Vista previa</h2>
            <div className="mt-3">
              <ImportPreviewTable rows={mappedRows} excludedRows={excludedRows} />
            </div>
          </div>
          <Button type="button" onClick={() => setStep('confirmar')}>
            Continuar a confirmación
          </Button>
        </div>
      ) : null}

      {step === 'confirmar' ? (
        <p className="text-sm text-muted-foreground">
          Confirmación y ejecución — continúa en la Tarea 10 ({file?.name}, {mappedRows.length - excludedRows.size}{' '}
          filas a importar).
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/importar/page.tsx components/platform/import/QualityErrorsTable.tsx components/platform/import/ImportPreviewTable.tsx
git commit -m "feat: add import wizard validation and preview steps"
```

---

### Task 10: Import execution (privileged Route Handler) + summary

**Files:**
- Create: `app/api/platform/importaciones/ejecutar/route.ts`
- Create: `components/platform/import/ImportSummary.tsx`
- Modify: `app/plataforma/importar/page.tsx`

**Interfaces:**
- Consumes: `createAdminClient` (`lib/supabase/admin.ts`, existing), `clasificarEpisodio`
  (Task 3), `hashRut` (Task 4), `MappedRow` (Task 7).
- Produces: `POST /api/platform/importaciones/ejecutar` — the one privileged write path for
  this plan; it authenticates the caller with the browser-cookie session first (same
  session → role-check pattern as `usuarios/invitar`), then uses the service-role client only
  for the actual bulk insert.

- [ ] **Step 1: Create `app/api/platform/importaciones/ejecutar/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clasificarEpisodio } from '@/lib/ingestion/classification'
import { hashRut } from '@/lib/ingestion/rutHash'
import type { MappedRow } from '@/lib/ingestion/validate'
import type { TipoAdministrativoClave } from '@/lib/ingestion/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { data: usuarioRow } = await supabase.from('usuarios').select('tenant_id, roles(clave)').eq('id', user.id).single()
  if (!usuarioRow) {
    return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 403 })
  }
  const rolClave = (usuarioRow.roles as unknown as { clave: string }).clave
  if (rolClave !== 'superadmin' && rolClave !== 'admin_cliente') {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
  }
  const tenantId = usuarioRow.tenant_id as string

  const body = (await request.json()) as {
    archivoNombre: string
    archivoHash: string
    empresaId: string
    forzarReimportacion?: boolean
    rows: Array<MappedRow & { codigoPersona: string | null }>
  }

  const admin = createAdminClient()

  const { data: archivoRepetido } = await admin
    .from('importaciones')
    .select('id, created_at')
    .eq('tenant_id', tenantId)
    .eq('archivo_hash', body.archivoHash)
    .neq('estado', 'revertida')
    .maybeSingle()

  if (archivoRepetido && !body.forzarReimportacion) {
    return NextResponse.json(
      {
        error: 'archivo_repetido',
        importacionExistente: archivoRepetido.id,
        mensaje: `Este archivo ya fue importado el ${new Date(archivoRepetido.created_at).toLocaleDateString('es-CL')}. Vuelve a intentarlo confirmando la reimportación si es intencional.`,
      },
      { status: 409 }
    )
  }

  const { data: importacion, error: importacionError } = await admin
    .from('importaciones')
    .insert({
      tenant_id: tenantId,
      responsable_id: user.id,
      archivo_nombre: body.archivoNombre,
      archivo_hash: body.archivoHash,
      estado: 'en_progreso',
    })
    .select()
    .single()

  if (importacionError || !importacion) {
    return NextResponse.json({ error: importacionError?.message ?? 'No se pudo crear la importación.' }, { status: 500 })
  }

  let filasProcesadas = 0
  let filasRechazadas = 0
  const episodiosPreviosPorRut = new Map<string, number>()

  for (const row of body.rows) {
    if (!row.rut || !row.fechaInicio || !row.dias || !row.tipoAdministrativo) {
      filasRechazadas += 1
      continue
    }

    const rutHash = await hashRut(row.rut)

    const { data: existingPersona } = await admin
      .from('personas')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('rut_hash', rutHash)
      .maybeSingle()

    let personaId = existingPersona?.id as string | undefined
    if (!personaId) {
      const { data: newPersona, error: personaError } = await admin
        .from('personas')
        .insert({
          tenant_id: tenantId,
          empresa_id: body.empresaId,
          codigo: row.codigoPersona ?? rutHash.slice(0, 8),
          rut_hash: rutHash,
        })
        .select()
        .single()
      if (personaError || !newPersona) {
        filasRechazadas += 1
        continue
      }
      personaId = newPersona.id as string
    }

    const { data: tipo } = await admin
      .from('tipos_administrativos')
      .select('id')
      .eq('clave', row.tipoAdministrativo)
      .single()
    if (!tipo) {
      filasRechazadas += 1
      continue
    }

    const episodiosPrevios12Meses = episodiosPreviosPorRut.get(rutHash) ?? 0
    const clasificacion = clasificarEpisodio({
      tipoAdministrativo: row.tipoAdministrativo as TipoAdministrativoClave,
      dias: row.dias,
      episodiosPrevios12Meses,
    })
    episodiosPreviosPorRut.set(rutHash, episodiosPrevios12Meses + 1)

    const { error: episodioError } = await admin.from('episodios').insert({
      tenant_id: tenantId,
      persona_id: personaId,
      importacion_id: importacion.id,
      tipo_administrativo_id: tipo.id,
      fecha_inicio: row.fechaInicio,
      fecha_fin: row.fechaFin ?? null,
      dias: row.dias,
      clasificacion_analitica: clasificacion,
    })

    if (episodioError) {
      filasRechazadas += 1
      continue
    }

    filasProcesadas += 1
  }

  await admin
    .from('importaciones')
    .update({ estado: 'completada', filas_procesadas: filasProcesadas, filas_rechazadas: filasRechazadas })
    .eq('id', importacion.id)

  return NextResponse.json({ importacionId: importacion.id, filasProcesadas, filasRechazadas })
}
```

- [ ] **Step 2: Create `components/platform/import/ImportSummary.tsx`**

```tsx
export function ImportSummary({ filasProcesadas, filasRechazadas }: { filasProcesadas: number; filasRechazadas: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="font-heading text-lg font-semibold text-foreground">Importación completada</p>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Filas procesadas</dt>
          <dd className="font-heading text-2xl font-semibold text-foreground">{filasProcesadas}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Filas rechazadas</dt>
          <dd className="font-heading text-2xl font-semibold text-foreground">{filasRechazadas}</dd>
        </div>
      </dl>
    </div>
  )
}
```

- [ ] **Step 3: Wire execution into `app/plataforma/importar/page.tsx`**

Replace the `'confirmar'` branch and add the needed imports/state (apply on top of Task 9's
version of the file):

```tsx
// Add to imports:
import { ImportSummary } from '@/components/platform/import/ImportSummary'
import { createClient } from '@/lib/supabase/client'

// Add alongside the other useState calls:
const [resumen, setResumen] = useState<{ filasProcesadas: number; filasRechazadas: number } | null>(null)
const [ejecutando, setEjecutando] = useState(false)
const [archivoRepetidoAviso, setArchivoRepetidoAviso] = useState<string | null>(null)

// Add this function inside the component:
async function handleEjecutar(forzarReimportacion = false) {
  if (!file) return
  setEjecutando(true)
  setArchivoRepetidoAviso(null)

  const supabase = createClient()
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id

  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const archivoHash = Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  const response = await fetch('/api/platform/importaciones/ejecutar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      archivoNombre: file.name,
      archivoHash,
      empresaId,
      forzarReimportacion,
      rows: mappedRows
        .filter((_, index) => !excludedRows.has(index))
        .map((row) => ({ ...row, codigoPersona: null })),
    }),
  })

  if (response.status === 409) {
    const data = await response.json()
    setArchivoRepetidoAviso(data.mensaje)
    setEjecutando(false)
    return
  }

  const data = await response.json()
  setResumen({ filasProcesadas: data.filasProcesadas, filasRechazadas: data.filasRechazadas })
  setEjecutando(false)
  setStep('resumen')
}

// Replace the 'confirmar' step's JSX:
{step === 'confirmar' ? (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Se importarán {mappedRows.length - excludedRows.size} de {mappedRows.length} filas de "{file?.name}".
      Las filas con errores críticos serán excluidas.
    </p>
    {archivoRepetidoAviso ? (
      <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{archivoRepetidoAviso}</p>
        <Button type="button" variant="outline" disabled={ejecutando} onClick={() => handleEjecutar(true)}>
          Reimportar de todas formas
        </Button>
      </div>
    ) : (
      <Button type="button" disabled={ejecutando} onClick={() => handleEjecutar(false)}>
        {ejecutando ? 'Importando…' : 'Ejecutar importación'}
      </Button>
    )}
  </div>
) : null}

{step === 'resumen' && resumen ? (
  <ImportSummary filasProcesadas={resumen.filasProcesadas} filasRechazadas={resumen.filasRechazadas} />
) : null}
```

Note for the implementer: `usuarioRow` fetched above isn't used by this step (empresaId comes
from the separate `empresas` query, matching the pattern already used in
`app/plataforma/organizacion/page.tsx`) — remove that unused query rather than leaving dead
code; it was included in this brief only to show the shape, not because it should ship as-is.

- [ ] **Step 4: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors (remove the unused `usuarioRow` query per the note above if it flags as unused)

- [ ] **Step 5: Commit**

```bash
git add app/api/platform/importaciones app/plataforma/importar/page.tsx components/platform/import/ImportSummary.tsx
git commit -m "feat: add import execution Route Handler and wizard summary step"
```

---

### Task 11: Import history, quality panel and revert

**Files:**
- Create: `app/plataforma/importar/historial/page.tsx`
- Create: `components/platform/import/ImportHistoryTable.tsx`
- Create: `app/api/platform/importaciones/revertir/route.ts`

**Interfaces:**
- Consumes: `Importacion`, `mapImportacionRow` (Task 2), `createAdminClient` (existing).
- Produces: `POST /api/platform/importaciones/revertir` — deletes every `episodios` row whose
  `importacion_id` matches, and every `personas` row created by that import that has no
  remaining episodes from other imports, then marks the import `revertida`. This is the "revert
  a complete import" step from the spec (step 10 of the wizard).

- [ ] **Step 1: Create `app/api/platform/importaciones/revertir/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { data: usuarioRow } = await supabase.from('usuarios').select('tenant_id, roles(clave)').eq('id', user.id).single()
  const rolClave = (usuarioRow?.roles as unknown as { clave: string } | undefined)?.clave
  if (!usuarioRow || (rolClave !== 'superadmin' && rolClave !== 'admin_cliente')) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
  }

  const { importacionId } = (await request.json()) as { importacionId: string }
  const admin = createAdminClient()

  const { data: importacion } = await admin
    .from('importaciones')
    .select('*')
    .eq('id', importacionId)
    .eq('tenant_id', usuarioRow.tenant_id)
    .single()

  if (!importacion) {
    return NextResponse.json({ error: 'Importación no encontrada.' }, { status: 404 })
  }

  const { data: episodiosDeLaImportacion } = await admin
    .from('episodios')
    .select('id, persona_id')
    .eq('importacion_id', importacionId)

  const personaIds = Array.from(new Set((episodiosDeLaImportacion ?? []).map((e) => e.persona_id as string)))

  await admin.from('episodios').delete().eq('importacion_id', importacionId)

  for (const personaId of personaIds) {
    const { count } = await admin
      .from('episodios')
      .select('id', { count: 'exact', head: true })
      .eq('persona_id', personaId)
    if ((count ?? 0) === 0) {
      await admin.from('personas').delete().eq('id', personaId)
    }
  }

  await admin.from('importaciones').update({ estado: 'revertida' }).eq('id', importacionId)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create `components/platform/import/ImportHistoryTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { Importacion } from '@/lib/ingestion/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const ESTADO_LABELS: Record<Importacion['estado'], string> = {
  en_progreso: 'En progreso',
  completada: 'Completada',
  revertida: 'Revertida',
  fallida: 'Fallida',
}

export function ImportHistoryTable({ initialImportaciones }: { initialImportaciones: Importacion[] }) {
  const [importaciones, setImportaciones] = useState(initialImportaciones)
  const [revirtiendoId, setRevirtiendoId] = useState<string | null>(null)

  async function handleRevertir(importacionId: string) {
    setRevirtiendoId(importacionId)
    const response = await fetch('/api/platform/importaciones/revertir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importacionId }),
    })
    if (response.ok) {
      setImportaciones((prev) =>
        prev.map((imp) => (imp.id === importacionId ? { ...imp, estado: 'revertida' } : imp))
      )
    }
    setRevirtiendoId(null)
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Archivo</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Procesadas</TableHead>
          <TableHead>Rechazadas</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {importaciones.map((importacion) => (
          <TableRow key={importacion.id}>
            <TableCell>{importacion.archivoNombre}</TableCell>
            <TableCell>{new Date(importacion.createdAt).toLocaleDateString('es-CL')}</TableCell>
            <TableCell>
              <Badge variant={importacion.estado === 'completada' ? 'secondary' : 'outline'}>
                {ESTADO_LABELS[importacion.estado]}
              </Badge>
            </TableCell>
            <TableCell>{importacion.filasProcesadas}</TableCell>
            <TableCell>{importacion.filasRechazadas}</TableCell>
            <TableCell className="text-right">
              {importacion.estado === 'completada' ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={revirtiendoId === importacion.id}
                  onClick={() => handleRevertir(importacion.id)}
                >
                  {revirtiendoId === importacion.id ? 'Revirtiendo…' : 'Revertir'}
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 3: Create `app/plataforma/importar/historial/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapImportacionRow } from '@/lib/ingestion/types'
import { ImportHistoryTable } from '@/components/platform/import/ImportHistoryTable'

export default async function HistorialImportacionesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await supabase.from('importaciones').select('*').order('created_at', { ascending: false })
  const importaciones = (rows ?? []).map(mapImportacionRow)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Historial de importaciones</h1>
      <ImportHistoryTable initialImportaciones={importaciones} />
    </div>
  )
}
```

- [ ] **Step 4: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/importar/historial app/api/platform/importaciones/revertir components/platform/import/ImportHistoryTable.tsx
git commit -m "feat: add import history, quality panel and revert"
```

---

### Task 12: Add "Importar datos" to the platform Sidebar

**Files:**
- Modify: `components/platform/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new consumed elsewhere — this is a leaf UI change.

- [ ] **Step 1: Add the nav items**

In `components/platform/Sidebar.tsx`, extend `NAV_ITEMS`:

```typescript
const NAV_ITEMS = [
  { href: '/plataforma/resumen', label: 'Resumen', adminOnly: false },
  { href: '/plataforma/organizacion', label: 'Organización', adminOnly: true },
  { href: '/plataforma/importar', label: 'Importar datos', adminOnly: true },
  { href: '/plataforma/importar/historial', label: 'Historial de importaciones', adminOnly: true },
  { href: '/plataforma/usuarios', label: 'Usuarios y permisos', adminOnly: true },
  { href: '/plataforma/auditoria', label: 'Auditoría', adminOnly: true },
] as const
```

- [ ] **Step 2: Run typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/platform/Sidebar.tsx
git commit -m "feat: add import pages to the platform sidebar"
```

---

### Task 13: Manual verification (controller-only)

This step cannot be delegated to an implementer subagent — it requires uploading a real file
through the live deployed app and inspecting the live Supabase project, same constraint as the
platform-foundation plan's Task 11.

- [ ] **Step 1: Full check suite**

```bash
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .
NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/vitest run
npm run build
```

Expected: all three pass clean.

- [ ] **Step 2: Apply the schema to the live Supabase project**

Via the SQL Editor, run everything appended since the last applied version (Tasks 1-2 of this
plan: `tipos_administrativos` through `episodios`, including the grants — verify with the same
`information_schema.role_table_grants` query used to catch the platform-foundation plan's
missing-grants bug before trusting RLS alone).

- [ ] **Step 3: Build a small real test file**

Create a `.xlsx` with columns RUT, Fecha inicio, Fecha fin, Días, Tipo, containing at least: one
clean row, one row reusing a RUT already in the file (to exercise recurrence classification),
one row with an unrecognized tipo, one row with a negative días, and two rows with overlapping
periods for the same RUT.

- [ ] **Step 4: Browser walkthrough**

Using claude-in-chrome + chrome-devtools against `npm run dev` locally (pointed at the live
Supabase project via `.env.local`), logged in as the tenant's admin:

1. Go to `/plataforma/importar`, upload the test file → confirm headers and preview appear.
2. Confirm the mapping step pre-fills RUT/Fecha inicio/Días/Tipo correctly from the heuristic
   matcher, then continue.
3. Confirm the quality step shows the expected critical errors (unrecognized tipo, negative
   días, overlapping period) and the expected duplicate warning, with the right row numbers.
4. Continue to confirmation, confirm the row count excludes only the critical-error rows, then
   execute the import.
5. Confirm the summary shows the right processed/rejected counts.
6. Go to `/plataforma/importar/historial` → confirm the import appears as "Completada" with
   matching counts.
7. Query `episodios` and `personas` directly in the SQL editor → confirm rows exist, tenant_id
   is correct, and `clasificacion_analitica` matches what Task 3's rules predict for each row
   (in particular the recurrence case).
8. Click "Revertir" on the import → confirm its state becomes "Revertida", and confirm (via
   SQL) that the episodios rows are gone and the persona row was deleted (since it had no other
   episodes).
9. Upload the exact same test file again (without reverting first, on a fresh non-reverted
   import) → confirm the "archivo repetido" warning appears and blocks execution until
   "Reimportar de todas formas" is clicked.

- [ ] **Step 5: Record the outcome**

Append a `Progress Ledger` entry for this plan to `.superpowers/sdd/progress.md`, following the
same convention as the platform-foundation and Home page plans, including any deferred nits.

---

## Explicitly deferred (not in this plan)

- Indicators/formulas, dashboard, filters — next plan, reads from `episodios` this plan
  produces. Per the spec's formula table (tasa de ausentismo, frecuencia, severidad, etc.).
- Alerts engine — depends on indicators existing.
- PDF reports — depends on the dashboard existing.
- AI-assisted column mapping, statistical anomaly detection, narrative summaries — Fase 5 per
  the spec, always with human review, never in this plan.
- Direct HRIS integrations, SFTP, webhooks — Fase 4 per the spec.
- Clinical-level aggregated classification (salud mental, musculoesquelético, etc.) — requires
  a legally authorized provider relationship the tenant doesn't have yet; only administrative
  and analytic-tier classification ship in this plan.
- **Org-unit validation on import** ("unidad organizacional inexistente", "persona sin unidad
  asignada" from the spec's quality-rule list): this plan's column mapping has no `unidad`
  field, and `personas` rows created during import get no `unidad_id`/`cargo_id`/`turno_id` —
  those stay `null` until someone assigns them manually via the Organización/Usuarios pages.
  Adding a mapped `unidad` column plus a lookup against the tenant's real `unidades` (created
  in the platform-foundation plan) is a reasonably small follow-up, but it's deferred here
  rather than silently unimplemented — flag it before this plan is considered a full read of
  the spec's quality-rule list. "Diferencias inesperadas respecto de la carga anterior" (e.g.
  detecting a corrupted export by comparing row-count/shape against the tenant's last import)
  is deferred for the same reason: it's explicitly framed in the spec as a nice-to-have
  anomaly check, not a blocking correctness rule like the others this plan does implement.
