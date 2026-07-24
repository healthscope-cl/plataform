# Reportes: los 6 tipos restantes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/plataforma/reportes` into a menu of 7 report types (moving the existing
Ejecutivo content to its own route, unchanged) and build the 6 new reports: Recursos Humanos,
Prevención, Gerencia, Campañas, Calidad, Privacidad.

**Architecture:** Seven independent static route folders under `app/plataforma/reportes/`
(no dynamic `[tipo]` segment). Every new report reuses already-shipped pure functions and
components unmodified; none introduces a new database table, RLS policy, or pure function
(the Campañas report calls the existing `medirAntesDespues()` once per campaign instead of
once, which is repeated invocation, not new logic).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr` +
`@supabase/supabase-js` admin client for the one privileged read), Tailwind v4, existing
shadcn `Table` primitive.

## Global Constraints

- **No new database table, no RLS/schema changes, no new pure function.** Every report reuses
  functions/components from prior modules exactly as they exist today:
  `calcularIndiceSuficiencia`/`SuficienciaBanner`, `computeIndicadores`/`IndicadoresResumenTabla`,
  `computeIndicadoresPorPersona`, `evaluarReglas`/`AlertasBanner`, `mapEventoSeguridadRow`,
  `mapEvaluacionErgonomicaRow`, `mapCampanaRow`, `medirAntesDespues`, `CalidadDatosResumen`,
  `mapImportacionRow`/`mapErrorCalidadRow`, `MIN_GROUP_SIZE`. Do not modify any of these files.
- **No dynamic `[tipo]` route.** Seven separate static folders
  (`ejecutivo/`, `recursos-humanos/`, `prevencion/`, `gerencia/`, `campanas/`, `calidad/`,
  `privacidad/`), each with its own `page.tsx`. `app/plataforma/reportes/page.tsx` itself
  becomes the menu, not one of the 7 reports.
- **No Sidebar change.** The existing "Reportes" nav entry already points at
  `/plataforma/reportes` and already has `adminOnly: false` — that's unchanged; it now lands
  on the menu instead of directly on the Ejecutivo content.
- **The Ejecutivo move must be byte-for-byte** — `app/plataforma/reportes/ejecutivo/page.tsx`
  gets the exact current content of `app/plataforma/reportes/page.tsx`, no logic changes.
- **`importaciones` has no `empresa_id` column** (verified in a prior module) — any query
  against it is scoped by RLS (`tenant_id`) alone, never `.eq('empresa_id', ...)`.
- **The Campañas report's admin-client read is scoped exactly like
  `app/plataforma/campanas/[id]/page.tsx`**: `createAdminClient()` is used only for the
  `encuesta_respuestas` read, and only when at least one campaign has
  `pregunta_seguimiento_id` set (skip the admin client entirely if no campaign in the list has
  the field configured — check `encuestaIds.length > 0`, matching the existing per-campaign
  page's guard).
- **The Calidad report reuses `CalidadDatosResumen` only, not `CalidadDatosTable`** — a
  management-level report shows the summary, not the row-by-row detail.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required
  exact invocation on this machine (default heap OOMs).
- No unit test for any of the 7 pages or the menu — matches the established pattern (no
  `/plataforma/*` page has a test file in this project).

---

## File Structure

```
app/plataforma/reportes/page.tsx                     (REWRITE — becomes the menu)
app/plataforma/reportes/ejecutivo/page.tsx            (CREATE — moved verbatim from the old reportes/page.tsx)
app/plataforma/reportes/recursos-humanos/page.tsx     (CREATE)
app/plataforma/reportes/prevencion/page.tsx           (CREATE)
app/plataforma/reportes/gerencia/page.tsx             (CREATE)
app/plataforma/reportes/campanas/page.tsx             (CREATE)
app/plataforma/reportes/calidad/page.tsx              (CREATE)
app/plataforma/reportes/privacidad/page.tsx           (CREATE)
```

---

### Task 1: Menú de reportes + mover el Ejecutivo

**Files:**
- Create: `app/plataforma/reportes/ejecutivo/page.tsx`
- Rewrite: `app/plataforma/reportes/page.tsx`

**Interfaces:**
- Consumes: nothing from another task in this plan.
- Produces: `/plataforma/reportes/ejecutivo` as a working route (the moved Ejecutivo), and
  the menu at `/plataforma/reportes` linking to it and to the 6 routes Tasks 2-7 create (those
  routes don't exist yet when this task runs — the menu links to them anyway; they 404 until
  their own task lands, which is fine since this task is reviewed and merged before the
  others in sequence... but if tasks are dispatched to a fresh worktree branch and merged
  together at the end, all 7 exist together by the time of the final review).

- [ ] **Step 1: Move the Ejecutivo content verbatim**

Read the current content of `app/plataforma/reportes/page.tsx` in full, and create
`app/plataforma/reportes/ejecutivo/page.tsx` with **exactly the same content, unchanged** —
same imports, same component name, same JSX, same logic. Do not rename the component function
or alter a single line.

- [ ] **Step 2: Replace `app/plataforma/reportes/page.tsx` with the menu**

Overwrite `app/plataforma/reportes/page.tsx` (the file you just copied FROM in Step 1) with:

```tsx
import Link from 'next/link'

const REPORTES = [
  {
    href: '/plataforma/reportes/ejecutivo',
    nombre: 'Ejecutivo',
    descripcion: 'Resumen general de indicadores, alertas, seguridad y campañas.',
  },
  {
    href: '/plataforma/reportes/recursos-humanos',
    nombre: 'Recursos Humanos',
    descripcion: 'Indicadores de ausentismo, costo por persona y distribución por tipo de licencia.',
  },
  {
    href: '/plataforma/reportes/prevencion',
    nombre: 'Prevención',
    descripcion: 'Eventos de seguridad, evaluaciones ergonómicas y campañas preventivas activas.',
  },
  {
    href: '/plataforma/reportes/gerencia',
    nombre: 'Gerencia',
    descripcion: 'Vista de alto nivel: suficiencia de datos, costo estimado, alertas y campañas.',
  },
  {
    href: '/plataforma/reportes/campanas',
    nombre: 'Campañas',
    descripcion: 'Todas las campañas y su seguimiento antes/después cuando está configurado.',
  },
  {
    href: '/plataforma/reportes/calidad',
    nombre: 'Calidad',
    descripcion: 'Resumen de errores de calidad de las importaciones recientes.',
  },
  {
    href: '/plataforma/reportes/privacidad',
    nombre: 'Privacidad',
    descripcion: 'Principios de privacidad aplicados y supresión de grupos pequeños.',
  },
] as const

export default function ReportesMenuPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Elige un reporte para verlo en detalle.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTES.map((reporte) => (
          <Link
            key={reporte.href}
            href={reporte.href}
            className="rounded-2xl border border-border bg-card p-5 hover:bg-muted"
          >
            <p className="font-heading text-lg font-semibold text-foreground">{reporte.nombre}</p>
            <p className="mt-1 text-sm text-muted-foreground">{reporte.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 4: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 5: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, route list includes both `/plataforma/reportes` and
`/plataforma/reportes/ejecutivo`.

- [ ] **Step 6: Commit**

```bash
git add app/plataforma/reportes/page.tsx app/plataforma/reportes/ejecutivo/page.tsx
git commit -m "feat: turn reportes into a menu, move ejecutivo to its own route"
```

---

### Task 2: Reporte de Recursos Humanos

**Files:**
- Create: `app/plataforma/reportes/recursos-humanos/page.tsx`

**Interfaces:**
- Consumes: `mapEmpresaRow` (`lib/platform/types.ts`), `calcularIndiceSuficiencia`
  (`lib/suficiencia/calcular.ts`), `SuficienciaBanner`
  (`components/platform/dashboard/SuficienciaBanner.tsx`), `computeIndicadores`
  (`lib/indicators/aggregate.ts`), `IndicadoresResumenTabla`
  (`components/platform/reportes/IndicadoresResumenTabla.tsx`), `computeIndicadoresPorPersona`
  (`lib/indicators/porPersona.ts`) — returns `IndicadorPersona[]` with fields
  `{ id, codigo, diasPerdidos, cantidadEpisodios, costoEstimado }`, sorted here by
  `costoEstimado` descending. `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow`
  (`components/ui/table.tsx`).
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Write the page**

Create `app/plataforma/reportes/recursos-humanos/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow } from '@/lib/platform/types'
import { calcularIndiceSuficiencia } from '@/lib/suficiencia/calcular'
import { SuficienciaBanner } from '@/components/platform/dashboard/SuficienciaBanner'
import { computeIndicadores } from '@/lib/indicators/aggregate'
import { IndicadoresResumenTabla } from '@/components/platform/reportes/IndicadoresResumenTabla'
import { computeIndicadoresPorPersona } from '@/lib/indicators/porPersona'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

export default async function ReporteRecursosHumanosPage() {
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

  const periodoFin = new Date().toISOString().slice(0, 10)
  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  const { data: personaRows } = await supabase.from('personas').select('id, codigo').eq('empresa_id', empresa.id)
  const personas = (personaRows ?? []).map((row) => ({
    id: row.id as string,
    codigo: row.codigo as string,
    contratoDias: 180,
  }))
  const personaIds = personas.map((p) => p.id)

  const { data: episodioRows } =
    personaIds.length > 0
      ? await supabase
          .from('episodios')
          .select('persona_id, dias, estado, tipo_administrativo_id')
          .in('persona_id', personaIds)
          .gte('fecha_inicio', periodoInicio)
      : { data: [] }
  const episodios = (episodioRows ?? []).map((row) => ({
    personaId: row.persona_id as string,
    dias: row.dias as number,
    estado: row.estado as 'abierto' | 'cerrado',
    tipoAdministrativoId: row.tipo_administrativo_id as string,
  }))

  const { data: importacionReciente } = await supabase
    .from('importaciones')
    .select('id')
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

  const indicadoresPorPersona = computeIndicadoresPorPersona({
    personas,
    episodios,
    costoPromedioDiario: COSTOS_DEFAULT.costoPromedioDiario,
  }).sort((a, b) => b.costoEstimado - a.costoEstimado)

  const { data: tipoRows } = await supabase.from('tipos_administrativos').select('id, nombre')
  const tipos = (tipoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))
  const conteoPorTipo = new Map<string, number>()
  for (const episodio of episodios) {
    conteoPorTipo.set(episodio.tipoAdministrativoId, (conteoPorTipo.get(episodio.tipoAdministrativoId) ?? 0) + 1)
  }
  const distribucionPorTipo = Array.from(conteoPorTipo.entries())
    .map(([tipoId, cantidad]) => ({
      nombre: tipos.find((t) => t.id === tipoId)?.nombre ?? tipoId,
      cantidad,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Recursos Humanos</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
        <p className="text-sm text-muted-foreground">
          Período: {periodoInicio} a {periodoFin}
        </p>
      </div>

      <SuficienciaBanner indice={indiceSuficiencia} />

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Indicadores clave</h2>
        <IndicadoresResumenTabla indicadores={indicadores} />
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Distribución por tipo de licencia</h2>
        {distribucionPorTipo.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin episodios en el período.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {distribucionPorTipo.map((item) => (
              <li key={item.nombre}>
                {item.nombre}: {item.cantidad}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Costo por persona</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Días perdidos</TableHead>
              <TableHead>Episodios</TableHead>
              <TableHead>Costo estimado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {indicadoresPorPersona.map((persona) => (
              <TableRow key={persona.id}>
                <TableCell>{persona.codigo}</TableCell>
                <TableCell>{persona.diasPerdidos}</TableCell>
                <TableCell>{persona.cantidadEpisodios}</TableCell>
                <TableCell>${persona.costoEstimado.toLocaleString('es-CL')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

Note: no `MIN_GROUP_SIZE` suppression on the per-person table — this matches the established
precedent for `PersonaDetalleTable` (each row is intrinsically one person, not an aggregate;
suppression exists to prevent reidentification from an aggregate, not to gate an operational
report). `usuarioRow` is existence-only, never mapped, same deliberate pattern as every other
report page in this roadmap.

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, route list includes `/plataforma/reportes/recursos-humanos`.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/reportes/recursos-humanos/page.tsx
git commit -m "feat: add recursos humanos report"
```

---

### Task 3: Reporte de Prevención

**Files:**
- Create: `app/plataforma/reportes/prevencion/page.tsx`

**Interfaces:**
- Consumes: `mapEmpresaRow`, `mapEventoSeguridadRow` (`lib/seguridad/types.ts` — real shape:
  `{ id, tenantId, empresaId, createdAt, creadaPor, tipo: 'accidente'|'incidente'|'cuasi_accidente'|'condicion_insegura', descripcion, gravedad: 'leve'|'moderada'|'grave', fecha, sucursalId, unidadId, cargoId, turnoId, estado: 'abierto'|'en_seguimiento'|'cerrado', accionCorrectiva }`),
  `mapEvaluacionErgonomicaRow` (`lib/ergonomia/types.ts` — real shape:
  `{ id, tenantId, empresaId, createdAt, creadaPor, cargoId, sucursalId, fecha, nivelRiesgo: 'bajo'|'medio'|'alto', hallazgos, recomendaciones, estado: 'pendiente'|'en_progreso'|'resuelto' }`),
  `mapCampanaRow`/`Campana` (`lib/campanas/types.ts`).
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Write the page**

Create `app/plataforma/reportes/prevencion/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow } from '@/lib/platform/types'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { mapEvaluacionErgonomicaRow } from '@/lib/ergonomia/types'
import { mapCampanaRow, type Campana } from '@/lib/campanas/types'

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

const TIPOS_PREVENCION: ReadonlyArray<Campana['tipo']> = ['ergonomia', 'pausas_activas', 'prevencion']

export default async function ReportePrevencionPage() {
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

  const { data: eventoRows } = await supabase.from('eventos_seguridad').select('*').eq('empresa_id', empresa.id)
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)
  const eventosPorTipo = { accidente: 0, incidente: 0, cuasi_accidente: 0, condicion_insegura: 0 }
  const eventosPorGravedad = { leve: 0, moderada: 0, grave: 0 }
  for (const evento of eventos) {
    eventosPorTipo[evento.tipo] += 1
    eventosPorGravedad[evento.gravedad] += 1
  }

  const { data: evaluacionRows } = await supabase
    .from('evaluaciones_ergonomicas')
    .select('*')
    .eq('empresa_id', empresa.id)
  const evaluaciones = (evaluacionRows ?? []).map(mapEvaluacionErgonomicaRow)
  const evaluacionesPorRiesgo = { bajo: 0, medio: 0, alto: 0 }
  const evaluacionesPorEstado = { pendiente: 0, en_progreso: 0, resuelto: 0 }
  for (const evaluacion of evaluaciones) {
    evaluacionesPorRiesgo[evaluacion.nivelRiesgo] += 1
    evaluacionesPorEstado[evaluacion.estado] += 1
  }

  const { data: campanaRows } = await supabase
    .from('campanas')
    .select('*')
    .eq('empresa_id', empresa.id)
    .eq('estado', 'activa')
  const campanasPrevencion = (campanaRows ?? [])
    .map(mapCampanaRow)
    .filter((campana) => TIPOS_PREVENCION.includes(campana.tipo))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Prevención</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Eventos de seguridad</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Por tipo</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              <li>Accidentes: {eventosPorTipo.accidente}</li>
              <li>Incidentes: {eventosPorTipo.incidente}</li>
              <li>Cuasi accidentes: {eventosPorTipo.cuasi_accidente}</li>
              <li>Condiciones inseguras: {eventosPorTipo.condicion_insegura}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Por gravedad</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              <li>Leve: {eventosPorGravedad.leve}</li>
              <li>Moderada: {eventosPorGravedad.moderada}</li>
              <li>Grave: {eventosPorGravedad.grave}</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Evaluaciones ergonómicas</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Por nivel de riesgo</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              <li>Bajo: {evaluacionesPorRiesgo.bajo}</li>
              <li>Medio: {evaluacionesPorRiesgo.medio}</li>
              <li>Alto: {evaluacionesPorRiesgo.alto}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Por estado</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              <li>Pendiente: {evaluacionesPorEstado.pendiente}</li>
              <li>En progreso: {evaluacionesPorEstado.en_progreso}</li>
              <li>Resuelto: {evaluacionesPorEstado.resuelto}</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Campañas preventivas activas</h2>
        {campanasPrevencion.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin campañas preventivas activas.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {campanasPrevencion.map((campana) => (
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

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, route list includes `/plataforma/reportes/prevencion`.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/reportes/prevencion/page.tsx
git commit -m "feat: add prevencion report"
```

---

### Task 4: Reporte de Gerencia

**Files:**
- Create: `app/plataforma/reportes/gerencia/page.tsx`

**Interfaces:**
- Consumes: `mapEmpresaRow`, `calcularIndiceSuficiencia`/`SuficienciaBanner`,
  `computeIndicadores` (real return field `costoEstimado: IndicadorValor` where
  `IndicadorValor = { valor: number; numerador: number; denominador: number } | { suprimido: true }`,
  from `lib/indicators/formulas.ts`), `mapReglaAlertaRow`/`evaluarReglas`/`AlertasBanner`,
  `mapCampanaRow`.
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Write the page**

Create `app/plataforma/reportes/gerencia/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow } from '@/lib/platform/types'
import { calcularIndiceSuficiencia } from '@/lib/suficiencia/calcular'
import { SuficienciaBanner } from '@/components/platform/dashboard/SuficienciaBanner'
import { computeIndicadores } from '@/lib/indicators/aggregate'
import { mapReglaAlertaRow } from '@/lib/alertas/types'
import { evaluarReglas } from '@/lib/alertas/evaluar'
import { AlertasBanner } from '@/components/platform/dashboard/AlertasBanner'
import { mapCampanaRow } from '@/lib/campanas/types'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

export default async function ReporteGerenciaPage() {
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

  const periodoFin = new Date().toISOString().slice(0, 10)
  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  const { data: personaRows } = await supabase
    .from('personas')
    .select('id, codigo, unidad_id, cargo_id, turno_id')
    .eq('empresa_id', empresa.id)
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

  const { data: sucursalRows } = await supabase.from('sucursales').select('id').eq('empresa_id', empresa.id)
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

  const { data: reglaRows } = await supabase.from('reglas_alerta').select('*').eq('empresa_id', empresa.id)
  const reglas = (reglaRows ?? []).map(mapReglaAlertaRow)

  const alertasDisparadas = evaluarReglas({ reglas, personas, unidades, episodios, costos: COSTOS_DEFAULT })

  const { data: campanaRows } = await supabase
    .from('campanas')
    .select('*')
    .eq('empresa_id', empresa.id)
    .eq('estado', 'activa')
  const campanasActivas = (campanaRows ?? []).map(mapCampanaRow)
  const costoTotalCampanas = campanasActivas.reduce((acc, campana) => acc + (campana.costo ?? 0), 0)

  const costoEstimado = indicadores.costoEstimado

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Gerencia</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
        <p className="text-sm text-muted-foreground">
          Período: {periodoInicio} a {periodoFin}
        </p>
      </div>

      <SuficienciaBanner indice={indiceSuficiencia} />

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Costo estimado de ausentismo</p>
        <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
          {'suprimido' in costoEstimado
            ? 'Grupo insuficiente para mostrar'
            : `$${costoEstimado.valor.toLocaleString('es-CL')}`}
        </p>
      </div>

      <AlertasBanner alertas={alertasDisparadas} />

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Campañas activas</h2>
        <p className="mt-2 text-sm text-foreground">{campanasActivas.length} campañas activas</p>
        <p className="text-sm text-foreground">Costo total: ${costoTotalCampanas.toLocaleString('es-CL')}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, route list includes `/plataforma/reportes/gerencia`.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/reportes/gerencia/page.tsx
git commit -m "feat: add gerencia report"
```

---

### Task 5: Reporte de Campañas

**Files:**
- Create: `app/plataforma/reportes/campanas/page.tsx`

**Interfaces:**
- Consumes: `mapEmpresaRow`, `mapCampanaRow`/`Campana` (includes `preguntaSeguimientoId: string | null`),
  `mapEncuestaRespuestaRow` (`lib/encuestas/types.ts`), `CATALOGO_PREGUNTAS`
  (`lib/encuestas/catalogo.ts`), `medirAntesDespues`/`ResultadoMedicion` (`lib/campanas/medicion.ts`
  — real signature: `medirAntesDespues(input: { valores: Array<{ valor: number; fecha: string }>; fechaInicio: string; fechaFin: string | null }): { antes: ResultadoMedicion; despues: ResultadoMedicion | null }`,
  where `ResultadoMedicion = { promedio: number; cantidad: number } | { suprimido: true } | { sinDatos: true }`),
  `createAdminClient` (`lib/supabase/admin.ts`).
- Produces: nothing consumed by a later task.

Database facts this task relies on (already verified in the Seguimiento de Campañas module,
no new migration needed): `encuesta_respuestas` has no authenticated SELECT grant — requires
`createAdminClient()`, exactly like `app/plataforma/campanas/[id]/page.tsx` and
`app/plataforma/reportes/campanas`'s only privileged read.

- [ ] **Step 1: Write the page**

Create `app/plataforma/reportes/campanas/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapEmpresaRow } from '@/lib/platform/types'
import { mapCampanaRow, type Campana } from '@/lib/campanas/types'
import { mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { CATALOGO_PREGUNTAS } from '@/lib/encuestas/catalogo'
import { medirAntesDespues, type ResultadoMedicion } from '@/lib/campanas/medicion'

const TIPO_LABELS: Record<Campana['tipo'], string> = {
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

const ESTADO_LABELS: Record<Campana['estado'], string> = {
  planificada: 'Planificada',
  activa: 'Activa',
  finalizada: 'Finalizada',
}

type Seguimiento = { pregunta: string; antes: ResultadoMedicion; despues: ResultadoMedicion | null }

function renderResultadoMedicion(resultado: ResultadoMedicion | null): string {
  if (resultado === null) return 'La campaña todavía no tiene fecha de término'
  if ('sinDatos' in resultado) return 'Sin datos todavía'
  if ('suprimido' in resultado) return 'Grupo insuficiente para mostrar'
  return `${resultado.promedio.toFixed(1)} / 5 (${resultado.cantidad} respuestas)`
}

export default async function ReporteCampanasPage() {
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

  const { data: campanaRows } = await supabase.from('campanas').select('*').eq('empresa_id', empresa.id)
  const campanas = (campanaRows ?? []).map(mapCampanaRow)

  const { data: encuestaRows } = await supabase.from('encuestas').select('id').eq('empresa_id', empresa.id)
  const encuestaIds = (encuestaRows ?? []).map((row) => row.id as string)

  let respuestas: Array<{ respuestas: Record<string, number>; createdAt: string }> = []
  if (encuestaIds.length > 0) {
    const admin = createAdminClient()
    const { data: respuestaRows } = await admin.from('encuesta_respuestas').select('*').in('encuesta_id', encuestaIds)
    respuestas = (respuestaRows ?? []).map(mapEncuestaRespuestaRow)
  }

  const seguimientoPorCampana = new Map<string, Seguimiento>()
  for (const campana of campanas) {
    if (!campana.preguntaSeguimientoId) continue
    const preguntaId = campana.preguntaSeguimientoId
    const valores = respuestas
      .filter((r) => typeof r.respuestas[preguntaId] === 'number')
      .map((r) => ({ valor: r.respuestas[preguntaId], fecha: r.createdAt }))
    const resultado = medirAntesDespues({ valores, fechaInicio: campana.fechaInicio, fechaFin: campana.fechaFin })
    const preguntaTexto = CATALOGO_PREGUNTAS.find((p) => p.id === preguntaId)?.texto ?? preguntaId
    seguimientoPorCampana.set(campana.id, { pregunta: preguntaTexto, antes: resultado.antes, despues: resultado.despues })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Campañas</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
      </div>

      {campanas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin campañas registradas.</p>
      ) : (
        <div className="space-y-4">
          {campanas.map((campana) => {
            const seguimiento = seguimientoPorCampana.get(campana.id)
            return (
              <div key={campana.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="font-heading text-lg font-semibold text-foreground">{campana.nombre}</p>
                  <span className="text-sm text-muted-foreground">{ESTADO_LABELS[campana.estado]}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {TIPO_LABELS[campana.tipo]} — {campana.fechaInicio} a {campana.fechaFin ?? 'sin fecha de término'}
                </p>
                {campana.resultado ? <p className="mt-2 text-sm text-foreground">{campana.resultado}</p> : null}
                {seguimiento ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Antes — {seguimiento.pregunta}</p>
                      <p className="text-sm text-foreground">{renderResultadoMedicion(seguimiento.antes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Después — {seguimiento.pregunta}</p>
                      <p className="text-sm text-foreground">{renderResultadoMedicion(seguimiento.despues)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">Sin pregunta de seguimiento configurada.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

Note: `seguimientoPorCampana` is a `Map` keyed by `campana.id`, looked up per row during
render — not a second parallel array indexed positionally, which would be fragile if the two
arrays were ever built or filtered independently.

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, route list includes `/plataforma/reportes/campanas`.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/reportes/campanas/page.tsx
git commit -m "feat: add campanas report"
```

---

### Task 6: Reporte de Calidad

**Files:**
- Create: `app/plataforma/reportes/calidad/page.tsx`

**Interfaces:**
- Consumes: `mapImportacionRow`/`mapErrorCalidadRow` (`lib/ingestion/types.ts`),
  `CalidadDatosResumen` (`components/platform/calidad-datos/CalidadDatosResumen.tsx` — takes
  `{ errores: ErrorCalidad[] }`, unmodified).
- Produces: nothing consumed by a later task.

Query is identical to `app/plataforma/calidad-datos/page.tsx`'s data-fetching portion (last
50 importaciones, their errores_calidad) — this task only reuses that query shape, it does
not modify the original page.

- [ ] **Step 1: Write the page**

Create `app/plataforma/reportes/calidad/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mapImportacionRow, mapErrorCalidadRow } from '@/lib/ingestion/types'
import { CalidadDatosResumen } from '@/components/platform/calidad-datos/CalidadDatosResumen'

export default async function ReporteCalidadPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Calidad</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de errores de calidad de las últimas {importaciones.length} importaciones.
        </p>
      </div>
      <CalidadDatosResumen errores={errores} />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, route list includes `/plataforma/reportes/calidad`.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/reportes/calidad/page.tsx
git commit -m "feat: add calidad report"
```

---

### Task 7: Reporte de Privacidad

**Files:**
- Create: `app/plataforma/reportes/privacidad/page.tsx`

**Interfaces:**
- Consumes: `mapEmpresaRow`, `computeIndicadores` (`lib/indicators/aggregate.ts`),
  `MIN_GROUP_SIZE` (`lib/indicators/formulas.ts`, value `5`).
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Write the page**

Create `app/plataforma/reportes/privacidad/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { mapEmpresaRow } from '@/lib/platform/types'
import { computeIndicadores } from '@/lib/indicators/aggregate'
import { MIN_GROUP_SIZE } from '@/lib/indicators/formulas'

const COSTOS_DEFAULT = {
  costoPromedioDiario: 40000,
  horasExtra: 0,
  reemplazos: 0,
  costosAdministrativos: 0,
}

export default async function ReportePrivacidadPage() {
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

  const periodoInicioDate = new Date()
  periodoInicioDate.setMonth(periodoInicioDate.getMonth() - 6)
  const periodoInicio = periodoInicioDate.toISOString().slice(0, 10)

  const { data: personaRows } = await supabase.from('personas').select('id').eq('empresa_id', empresa.id)
  const personas = (personaRows ?? []).map((row) => ({ id: row.id as string, contratoDias: 180 }))
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

  const indicadores = computeIndicadores({ personas, episodios, costos: COSTOS_DEFAULT })
  const cantidadSuprimidos = Object.values(indicadores).filter((valor) => 'suprimido' in valor).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reporte de Privacidad</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">Principios de privacidad aplicados</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
          <li>
            Tamaño mínimo de grupo: ningún indicador o resultado agregado se muestra si representa a menos de{' '}
            {MIN_GROUP_SIZE} personas o respuestas.
          </li>
          <li>Separación administrativa y clínica: el tipo de licencia registrado nunca es un diagnóstico ni un código clínico.</li>
          <li>Pseudonimización: el RUT de cada persona nunca se almacena en texto plano, solo un hash de un solo sentido.</li>
          <li>Auditoría de solo escritura: todas las acciones administrativas quedan registradas y no pueden modificarse ni eliminarse.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Indicadores actualmente suprimidos por grupo insuficiente</p>
        <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{cantidadSuprimidos} de 6</p>
      </div>

      <Link href="/plataforma/auditoria" className="text-sm text-primary underline">
        Ver registro de auditoría
      </Link>
    </div>
  )
}
```

Note: `MIN_GROUP_SIZE` (`lib/indicators/formulas.ts`) carries its own comment noting it's a
placeholder value pending legal advice — this page just displays the current value, it
doesn't assert it's final.

- [ ] **Step 2: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 4: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, route list includes `/plataforma/reportes/privacidad`.

- [ ] **Step 5: Commit**

```bash
git add app/plataforma/reportes/privacidad/page.tsx
git commit -m "feat: add privacidad report"
```

---

### Task 8: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user)
to run against the deployed/production environment after Tasks 1-7 are merged and deployed.
**This module has no database schema, so there is no "apply SQL to production Supabase" step
in this task.**

- [ ] **Step 1: Verify the menu and navigation**

Log in to production. Go to `/plataforma/reportes`. Confirm all 7 cards render and each link
navigates to its correct route without a 404.

- [ ] **Step 2: Verify the Ejecutivo report is unchanged**

Confirm `/plataforma/reportes/ejecutivo` renders exactly as `/plataforma/reportes` used to
before this change (same sections, same data, print button still works, print preview still
hides sidebar/topbar).

- [ ] **Step 3: Verify each new report against real data**

For each of the 6 new reports, confirm the numbers/lists shown match what's visible on their
source pages: Recursos Humanos vs `/plataforma/resumen`; Prevención vs
`/plataforma/seguridad` and `/plataforma/ergonomia`; Gerencia vs the Ejecutivo's own
costoEstimado/alertas; Campañas vs `/plataforma/campanas` and, for a campaign with a tracked
question, vs its own `/plataforma/campanas/[id]` seguimiento; Calidad vs
`/plataforma/calidad-datos`'s summary section; Privacidad's suppressed-count vs manually
checking which of the Ejecutivo's 6 indicators currently show "Grupo insuficiente para
mostrar".

- [ ] **Step 4: Confirm no other page's behavior changed**

Navigate to `/plataforma/resumen`, `/plataforma/seguridad`, `/plataforma/ergonomia`,
`/plataforma/campanas`, `/plataforma/calidad-datos`, `/plataforma/auditoria` and confirm all
render exactly as before — this plan only reads from their underlying data, it never modifies
any of those pages or their components.

- [ ] **Step 5: Report results to the user**

Summarize: menu + all 7 reports render correctly ✅/❌, Ejecutivo unchanged at its new URL
✅/❌, each new report's data verified against its source page ✅/❌, no regression elsewhere
✅/❌. Ask the user which module to tackle next (Seguimiento for Intervenciones is the last
remaining item from `referencia/instrucciones2.txt`).

---

## Self-Review Notes

- **Spec coverage:** los 7 reportes ✅ (Tasks 1-7), menú central sin ruta dinámica ✅ (Task 1),
  reuso exclusivo de funciones/componentes existentes sin modificarlos ✅ (verificado archivo
  por archivo en cada task), verificación manual ✅ (Task 8). Explícitamente-fuera-de-alcance
  del spec (PDF por reporte nuevo, selector de período, escritura, historial de reportes) no
  se implementa en ninguna tarea, coincide con el spec.
- **Placeholder scan:** sin TBD/TODO; cada paso de código tiene el archivo completo.
- **Type consistency:** todas las firmas reales (`Campana` con `preguntaSeguimientoId`,
  `ResultadoMedicion`, `IndicadorResultados`/`IndicadorValor`, `EventoSeguridad`,
  `EvaluacionErgonomica`, `ErrorCalidad`/`Importacion`) se verificaron leyendo los archivos
  reales antes de escribir cada task — no se introduce ningún tipo nuevo que pueda desviarse
  entre tareas. El Task 5 usa un `Map` por `campana.id` (no arreglos paralelos indexados por
  posición) para evitar el riesgo de desalineación entre `campanas` y sus seguimientos.
