# Motor de Recomendaciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `/plataforma/recomendaciones` page implementing the 4 signal→action
mappings from `referencia/instrucciones2.txt` section 10 ("Motor de Recomendaciones"), each
signal simplified to what's honestly calculable from data this project already collects, with
a real computed evidence value per card (not static text).

**Architecture:** No new database table. Three of the four signals (Fatiga elevada, Molestias
lumbares elevadas, Alta tensión psicosocial) reuse `agregarRespuestas()`
(`lib/encuestas/agregar.ts`, unmodified — the exact mechanism `/plataforma/bienestar` already
uses) with a fixed threshold check (`promedio >= 3.5`). The fourth (Incremento de incidentes)
needs one genuinely new pure function — this project's first period-over-period comparison —
built with TDD.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr` +
`@supabase/supabase-js` admin client for the one privileged read), Tailwind v4, existing
shadcn `Badge` primitive, Vitest.

## Global Constraints

- **No new database table, no RLS/schema changes.** This module only reads
  `encuesta_respuestas` (via the existing admin-client pattern) and `eventos_seguridad` (via
  the regular client) — nothing new to grant or protect.
- **Do not modify** `agregarRespuestas()`, `CATALOGO_PREGUNTAS`'s existing entries,
  `mapEncuestaRespuestaRow`, `mapEventoSeguridadRow`, `mapEmpresaRow`,
  `app/plataforma/bienestar/page.tsx`. This plan reuses these exactly as they exist.
- **The threshold for the 3 survey-based signals is a fixed constant, `3.5` (out of the 1-5
  scale), not a per-signal configurable value or a scored/weighted model.** A signal is
  "Activa" when the question's average is `>= 3.5` and the result isn't suppressed;
  "No activa" when it's below `3.5`; "Sin datos suficientes" when `agregarRespuestas()`
  returns `{ suprimido: true }` for that question (which already covers both "zero responses"
  and "fewer than `MIN_GROUP_SIZE` responses" — `agregarRespuestas()` does not distinguish
  those two cases, and this plan does not either).
- **`huboIncrementoIncidentes()` boundary semantics (exact, not left ambiguous):** given a
  cutoff date, "actual" is the 3-month window ending on and including that date; "anterior" is
  the 3-month window immediately before that, ending the instant "actual" begins. A date that
  falls exactly on the boundary between the two windows belongs to "actual", never "anterior"
  and never both. A date before the "anterior" window belongs to neither. Task 1's tests must
  cover the exact-boundary case explicitly.
- **No `MIN_GROUP_SIZE` suppression on the incidentes signal** — same established precedent
  used everywhere else in this project for `eventos_seguridad` counts (administrative events,
  not individual survey responses).
- **`/plataforma/recomendaciones` nav entry uses `adminOnly: true`**, positioned directly
  after "Alertas" in the Sidebar — same access level as Bienestar Preventivo, Ergonomía, and
  Seguridad Laboral, since this page aggregates the same category of sensitive data.
- **No "mark as reviewed" state, no configurable thresholds/catalog from the UI** — the 4
  signals, their thresholds, and their catalog text (justificación, limitaciones,
  responsable, indicador a medir, acciones) are all fixed in code for this phase.
- `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .` — required
  exact invocation on this machine (default heap OOMs).
- No unit test for the page — matches the established pattern (no `/plataforma/*` page has a
  test file in this project). `huboIncrementoIncidentes()` is the one exception — genuinely
  new logic gets real tests (TDD), same standard already applied to `medirAntesDespues()`,
  `agregarRespuestas()`, etc.

---

## File Structure

```
lib/recomendaciones/incidentes.ts          (CREATE — huboIncrementoIncidentes pure function)
lib/recomendaciones/incidentes.test.ts     (CREATE — its tests)
components/platform/Sidebar.tsx            (MODIFY — new nav entry)
app/plataforma/recomendaciones/page.tsx    (CREATE — the page)
```

---

### Task 1: Función pura `huboIncrementoIncidentes()`

**Files:**
- Create: `lib/recomendaciones/incidentes.ts`
- Test: `lib/recomendaciones/incidentes.test.ts`

**Interfaces:**
- Consumes: nothing from another task in this plan.
- Produces: `huboIncrementoIncidentes()` and its return shape, consumed by Task 3's page.

This is TDD — write the failing tests first.

- [ ] **Step 1: Write the failing tests**

Create `lib/recomendaciones/incidentes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { huboIncrementoIncidentes } from './incidentes'

describe('huboIncrementoIncidentes', () => {
  it('detecta incremento cuando el período actual tiene más eventos que el anterior', () => {
    const fechas = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-02-01']
    const resultado = huboIncrementoIncidentes({ fechas, fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 3, anterior: 1, incremento: true })
  })

  it('no marca incremento cuando el período actual tiene la misma cantidad que el anterior', () => {
    const fechas = ['2026-05-01', '2026-06-01', '2026-02-01', '2026-03-01']
    const resultado = huboIncrementoIncidentes({ fechas, fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 2, anterior: 2, incremento: false })
  })

  it('no marca incremento cuando el período actual tiene menos eventos que el anterior', () => {
    const fechas = ['2026-05-01', '2026-02-01', '2026-03-01', '2026-03-15']
    const resultado = huboIncrementoIncidentes({ fechas, fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 1, anterior: 3, incremento: false })
  })

  it('una fecha exactamente en el límite entre los dos períodos cuenta como "actual", no "anterior"', () => {
    const fechas = ['2026-04-24']
    const resultado = huboIncrementoIncidentes({ fechas, fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 1, anterior: 0, incremento: true })
  })

  it('una fecha anterior a la ventana "anterior" no cuenta en ningún período', () => {
    const fechas = ['2025-01-01']
    const resultado = huboIncrementoIncidentes({ fechas, fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 0, anterior: 0, incremento: false })
  })

  it('devuelve ceros y sin incremento cuando no hay fechas', () => {
    const resultado = huboIncrementoIncidentes({ fechas: [], fechaCorte: '2026-07-24' })
    expect(resultado).toEqual({ actual: 0, anterior: 0, incremento: false })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run lib/recomendaciones/incidentes.test.ts`
Expected: FAIL — `lib/recomendaciones/incidentes.ts` doesn't exist yet, so the import fails.

- [ ] **Step 3: Write the implementation**

Create `lib/recomendaciones/incidentes.ts`:

```ts
export function huboIncrementoIncidentes(input: {
  fechas: string[]
  fechaCorte: string
}): { actual: number; anterior: number; incremento: boolean } {
  const corte = new Date(input.fechaCorte)

  const inicioActual = new Date(corte)
  inicioActual.setMonth(inicioActual.getMonth() - 3)
  const inicioActualStr = inicioActual.toISOString().slice(0, 10)

  const inicioAnterior = new Date(inicioActual)
  inicioAnterior.setMonth(inicioAnterior.getMonth() - 3)
  const inicioAnteriorStr = inicioAnterior.toISOString().slice(0, 10)

  let actual = 0
  let anterior = 0

  for (const fecha of input.fechas) {
    if (fecha >= inicioActualStr && fecha <= input.fechaCorte) {
      actual += 1
    } else if (fecha >= inicioAnteriorStr && fecha < inicioActualStr) {
      anterior += 1
    }
  }

  return { actual, anterior, incremento: actual > anterior }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run lib/recomendaciones/incidentes.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add lib/recomendaciones/incidentes.ts lib/recomendaciones/incidentes.test.ts
git commit -m "feat: add huboIncrementoIncidentes pure function"
```

---

### Task 2: Sidebar nav entry + Página `/plataforma/recomendaciones`

**Files:**
- Modify: `components/platform/Sidebar.tsx`
- Create: `app/plataforma/recomendaciones/page.tsx`

**Interfaces:**
- Consumes: `mapEmpresaRow` (`lib/platform/types.ts`), `mapEncuestaRespuestaRow`
  (`lib/encuestas/types.ts`), `agregarRespuestas` (`lib/encuestas/agregar.ts` — real
  signature: `agregarRespuestas(input: { preguntaIds: string[]; respuestas: Array<Record<string, number>> }): Record<string, ResultadoPregunta>`
  where `ResultadoPregunta = { promedio: number; cantidad: number } | { suprimido: true }`),
  `mapEventoSeguridadRow` (`lib/seguridad/types.ts`), `createAdminClient`
  (`lib/supabase/admin.ts`), `huboIncrementoIncidentes` (Task 1), `Badge`
  (`components/ui/badge.tsx`).
- Produces: nothing consumed by a later task — this is the last code task in this plan.

Database facts this task relies on (verified against `supabase/schema.sql`, no migration
needed): `encuesta_respuestas` has no authenticated SELECT grant — requires
`createAdminClient()`, exactly like `app/plataforma/bienestar/page.tsx`. `encuestas` and
`eventos_seguridad` both have regular authenticated-role RLS + SELECT grants — no admin client
needed for either.

- [ ] **Step 1: Add the "Recomendaciones" nav entry to the Sidebar**

In `components/platform/Sidebar.tsx`, the `NAV_ITEMS` array currently has this entry:

```ts
  { href: '/plataforma/alertas', label: 'Alertas', adminOnly: true },
```

Add a new entry directly after it:

```ts
  { href: '/plataforma/alertas', label: 'Alertas', adminOnly: true },
  { href: '/plataforma/recomendaciones', label: 'Recomendaciones', adminOnly: true },
```

- [ ] **Step 2: Write the page**

Create `app/plataforma/recomendaciones/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapEmpresaRow } from '@/lib/platform/types'
import { mapEncuestaRespuestaRow } from '@/lib/encuestas/types'
import { agregarRespuestas } from '@/lib/encuestas/agregar'
import { mapEventoSeguridadRow } from '@/lib/seguridad/types'
import { huboIncrementoIncidentes } from '@/lib/recomendaciones/incidentes'
import { Badge } from '@/components/ui/badge'

const UMBRAL_PROMEDIO = 3.5

const SENALES_ENCUESTA = [
  {
    preguntaId: 'fatiga',
    nombre: 'Fatiga elevada',
    justificacion:
      'Un promedio elevado de fatiga puede anticipar ausentismo, accidentes o baja productividad si no se interviene a tiempo.',
    limitaciones:
      'No está segmentado por turno, área ni sucursal — un promedio elevado a nivel de empresa puede diluir un problema concentrado en un grupo específico.',
    responsable: 'Prevención de riesgos / Salud ocupacional',
    indicadorAMedir: 'Promedio de fatiga en la próxima medición de encuestas.',
    acciones: [
      'Revisar rotación',
      'Evaluar pausas',
      'Analizar horas extraordinarias',
      'Aplicar encuesta de sueño',
      'Realizar intervención de fatiga',
    ],
  },
  {
    preguntaId: 'dolor_musculoesqueletico',
    nombre: 'Molestias lumbares elevadas',
    justificacion:
      'Las molestias musculoesqueléticas autoreportadas son un precursor conocido de licencias por enfermedad profesional si no se atienden preventivamente.',
    limitaciones:
      'Basado en encuesta autoreportada, no en una evaluación clínica o ergonómica formal — confirmar con evaluaciones ergonómicas antes de intervenir.',
    responsable: 'Ergonomía / Prevención de riesgos',
    indicadorAMedir: 'Promedio de molestias musculoesqueléticas en la próxima medición.',
    acciones: ['Evaluación ergonómica', 'Kinesiología preventiva', 'Pausas activas', 'Capacitación de postura', 'Ajuste de puesto'],
  },
  {
    preguntaId: 'estres',
    nombre: 'Alta tensión psicosocial',
    justificacion:
      'Un nivel alto de estrés percibido es una señal temprana de riesgo psicosocial que puede derivar en ausentismo o rotación si no se atiende.',
    limitaciones:
      'El estrés autoreportado no equivale a un diagnóstico de riesgo psicosocial formal — requiere evaluación especializada antes de concluir causalidad.',
    responsable: 'RR.HH. / Salud ocupacional',
    indicadorAMedir: 'Promedio de estrés percibido en la próxima medición.',
    acciones: ['Evaluación especializada', 'Taller de liderazgo', 'Revisión de carga', 'Canal de apoyo', 'Programa psicológico'],
  },
] as const

const REVISION_HUMANA =
  'Esta es una sugerencia basada en reglas fijas, no un diagnóstico — debe ser evaluada por un profesional antes de implementarse.'

export default async function RecomendacionesPage() {
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

  const admin = createAdminClient()
  const { data: respuestaRows } =
    encuestaIds.length > 0
      ? await admin.from('encuesta_respuestas').select('*').in('encuesta_id', encuestaIds)
      : { data: [] }
  const respuestas = (respuestaRows ?? []).map(mapEncuestaRespuestaRow)

  const resultadosEncuesta = agregarRespuestas({
    preguntaIds: SENALES_ENCUESTA.map((s) => s.preguntaId),
    respuestas: respuestas.map((r) => r.respuestas),
  })

  const { data: eventoRows } = await supabase.from('eventos_seguridad').select('*').eq('empresa_id', empresa.id)
  const eventos = (eventoRows ?? []).map(mapEventoSeguridadRow)
  const fechaCorte = new Date().toISOString().slice(0, 10)
  const incidentes = huboIncrementoIncidentes({ fechas: eventos.map((e) => e.fecha), fechaCorte })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Recomendaciones</h1>
        <p className="mt-1 text-sm text-foreground">{empresa.nombre}</p>
        <p className="text-sm text-muted-foreground">
          Sugerencias basadas en reglas fijas sobre señales detectadas en los datos actuales — no un diagnóstico
          automático. Cada recomendación debe ser evaluada por un profesional antes de implementarse.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SENALES_ENCUESTA.map((senal) => {
          const resultado = resultadosEncuesta[senal.preguntaId]
          const suprimido = !resultado || 'suprimido' in resultado
          const activa = resultado && !suprimido && resultado.promedio >= UMBRAL_PROMEDIO

          return (
            <div key={senal.preguntaId} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="font-heading text-lg font-semibold text-foreground">{senal.nombre}</p>
                <Badge variant={suprimido ? 'outline' : activa ? 'destructive' : 'secondary'}>
                  {suprimido ? 'Sin datos suficientes' : activa ? 'Activa' : 'No activa'}
                </Badge>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Evidencia: </span>
                {suprimido || !resultado
                  ? 'Grupo insuficiente para mostrar.'
                  : `Promedio actual: ${resultado.promedio.toFixed(1)} / 5, basado en ${resultado.cantidad} respuestas.`}
              </p>

              <p className="mt-2 text-sm text-foreground">
                <span className="font-medium">Acciones sugeridas: </span>
                {senal.acciones.join(', ')}.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Nivel de confianza: </span>
                Media — dato autoreportado, no un diagnóstico clínico.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Justificación: </span>
                {senal.justificacion}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Limitaciones: </span>
                {senal.limitaciones}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Responsable sugerido: </span>
                {senal.responsable}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Indicador a medir: </span>
                {senal.indicadorAMedir}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Revisión humana: {REVISION_HUMANA}</p>
            </div>
          )
        })}

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-heading text-lg font-semibold text-foreground">Incremento de incidentes</p>
            <Badge variant={incidentes.incremento ? 'destructive' : 'secondary'}>
              {incidentes.incremento ? 'Activa' : 'No activa'}
            </Badge>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Evidencia: </span>
            {incidentes.actual} eventos de seguridad en los últimos 3 meses, frente a {incidentes.anterior} en los 3
            meses anteriores.
          </p>

          <p className="mt-2 text-sm text-foreground">
            <span className="font-medium">Acciones sugeridas: </span>
            Investigación, Revisión de procedimientos, Capacitación, Supervisión, Medidas correctivas.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Nivel de confianza: </span>
            Alta — conteo administrativo directo, no autoreportado.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Justificación: </span>
            Un aumento en la cantidad de eventos de seguridad puede indicar un deterioro de condiciones
            operacionales que requiere revisión antes de que ocurra un incidente más grave.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Limitaciones: </span>
            Compara conteos absolutos, no tasas — un cambio en la dotación entre períodos puede afectar la
            comparación.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Responsable sugerido: </span>
            Prevención de riesgos
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Indicador a medir: </span>
            Conteo de eventos de seguridad en el próximo período de 3 meses.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Revisión humana: {REVISION_HUMANA}</p>
        </div>
      </div>
    </div>
  )
}
```

Note: `usuarioRow` is fetched with `.select('id')` only and never mapped, matching the same
deliberate pattern already used throughout this project. The 4th signal (incidentes) is
rendered as its own literal block rather than unified into the `SENALES_ENCUESTA.map()` loop —
it has a different data shape (a count comparison, not a survey average) and unifying it would
require a discriminated-union type for a single outlier; kept separate deliberately, matching
this project's YAGNI convention of not abstracting for one case.

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 4: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass, including Task 1's new tests.

- [ ] **Step 5: Dev-server smoke check**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, and the route list printed at the end includes
`/plataforma/recomendaciones`. A full logged-in visual check is out of scope for this step
(same gap already documented for every prior read-only-page module in this roadmap — no live
Supabase credentials in this worktree/checkout); Task 3 covers that against the real deployed
environment.

- [ ] **Step 6: Commit**

```bash
git add components/platform/Sidebar.tsx app/plataforma/recomendaciones/page.tsx
git commit -m "feat: add motor de recomendaciones page"
```

---

### Task 3: Controller-only manual verification

This task has no subagent implementation — it is a checklist for the controller (or the user)
to run against the deployed/production environment after Tasks 1-2 are merged and deployed.
**This module has no database schema, so there is no "apply SQL to production Supabase" step
in this task** — same as Reportes, Bienestar Preventivo, Ausencias y Licencias, Calidad de
Datos, and Integraciones before it.

- [ ] **Step 1: Verify the page renders correctly with real production data**

Log in to production as an admin. Go to `/plataforma/recomendaciones`. Confirm: each of the 3
survey-based signals (Fatiga elevada, Molestias lumbares elevadas, Alta tensión psicosocial)
shows a promedio + cantidad matching a manual calculation over the real
`encuesta_respuestas` for the `fatiga`/`dolor_musculoesqueletico`/`estres` questions, or "Sin
datos suficientes" if suppressed. Confirm the badge state (Activa/No activa) correctly
reflects whether that promedio is `>= 3.5`.

- [ ] **Step 2: Verify the incidentes signal**

Confirm "Incremento de incidentes" shows the correct actual/anterior counts, matching a
manual count of `eventos_seguridad` by `fecha` for the last 3 months vs. the 3 months before
that, and that the badge correctly reflects `actual > anterior`.

- [ ] **Step 3: Confirm no other page's behavior changed**

Navigate to `/plataforma/bienestar` and confirm it still renders exactly as before — this
plan never touched that file. Confirm non-admin sidebar visibility (if a non-admin test
account is available): "Recomendaciones" should not appear in their sidebar.

- [ ] **Step 4: Report results to the user**

Summarize: page renders correct real data ✅/❌, incidentes signal correct ✅/❌, no
regression on Bienestar Preventivo ✅/❌, non-admin sidebar visibility confirmed or noted as
unverified. Note that this closes out the last transversal item from
`referencia/instrucciones2.txt` — the entire document's roadmap (sections 8 and 10) is now
addressed.

---

## Self-Review Notes

- **Spec coverage:** las 4 señales con sus acciones/justificación/limitaciones/responsable/
  indicador tomados del documento ✅ (Task 2), umbral fijo `3.5` para las 3 señales de
  encuesta ✅ (Task 2), función nueva con límites exactos y probados para incidentes ✅ (Task
  1), "revisión humana" como disclaimer fijo en las 4 tarjetas ✅ (Task 2), acceso
  `adminOnly: true` ✅ (Task 2), verificación manual ✅ (Task 3). Explícitamente-fuera-de-alcance
  del spec (segmentación, IA/ML, seguimiento de estado "revisada", catálogo configurable,
  integración con `reglas_alerta`) no se implementa en ninguna tarea, coincide con el spec.
- **Placeholder scan:** sin TBD/TODO; cada paso tiene código completo.
- **Type consistency:** `agregarRespuestas`/`ResultadoPregunta`, `mapEncuestaRespuestaRow`,
  `mapEventoSeguridadRow`, `huboIncrementoIncidentes` (definida en Task 1, consumida en Task
  2) se usan idénticamente a como están definidas — verificado leyendo los archivos reales
  antes de escribir cada task. No se introduce ningún tipo nuevo que pueda desviarse entre
  tareas.
