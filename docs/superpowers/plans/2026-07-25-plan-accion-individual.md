# Plan de Acción Individual por Episodio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every episodio de ausencia/licencia in "Ausencias y licencias" gets a suggested action
plan (acción + responsable + limitaciones), keyed by `tipoAdministrativo` + `clasificacionAnalitica`,
with the person's estimated cost shown alongside as context.

**Architecture:** A new pure lookup function (`accionSugerida`, fixed rules, no AI) mirrors the
existing `clasificarEpisodio()` pattern. `app/plataforma/ausencias/page.tsx` gains the raw
`TipoAdministrativoClave` (today only the display name is threaded through) and a per-person cost
map (reusing the existing `computeIndicadoresPorPersona`). `AusenciasTable.tsx` renders an
expandable detail row per episode showing the plan.

**Tech Stack:** Next.js 16 App Router (server component page + client component table), TypeScript,
Vitest, Supabase.

## Global Constraints

- Reglas fijas, no IA — every branch returns a literal string, no model call, no external service.
- No RUT en texto plano, ninguna referencia a diagnóstico clínico — only `tipoAdministrativo` +
  `clasificacionAnalitica` (both already visible today in the same table) drive the suggestion.
- Persona identified by `codigo` only, never a real name — unchanged from today's table.
- `clasificarEpisodio()` (`lib/ingestion/classification.ts`) is NOT modified — reused as-is.
- Every rule's `limitaciones` field ends with the fixed disclaimer: `'Esta es una sugerencia basada
  en reglas fijas, no un diagnóstico — debe ser evaluada por un profesional antes de
  implementarse.'`
- `enfermedad_comun` sub-branches reuse the exact public marketing copy: `'Plan de retorno gradual
  con adaptaciones y seguimiento.'` for `prolongado`, `'Derivar a evaluación de salud ocupacional —
  2 o más episodios en 12 meses.'` for `recurrente`.

---

### Task 1: `accionSugerida()` pure lookup function

**Files:**
- Create: `lib/ingestion/accionSugerida.ts`
- Test: `lib/ingestion/accionSugerida.test.ts`

**Interfaces:**
- Consumes: `TipoAdministrativoClave`, `ClasificacionAnalitica` from `lib/ingestion/types.ts`
  (already exist, unmodified).
- Produces: `export type AccionSugerida = { accion: string; responsable: string; limitaciones:
  string }` and `export function accionSugerida(input: { tipoAdministrativo:
  TipoAdministrativoClave; clasificacionAnalitica: ClasificacionAnalitica }): AccionSugerida` —
  Task 2 imports both.

- [ ] **Step 1: Write the failing tests**

Create `lib/ingestion/accionSugerida.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { accionSugerida } from './accionSugerida'

describe('accionSugerida', () => {
  it('suggests accident investigation for accidente_laboral and accidente_trayecto', () => {
    expect(
      accionSugerida({ tipoAdministrativo: 'accidente_laboral', clasificacionAnalitica: 'accidente' })
    ).toEqual({
      accion: 'Investigar el accidente, evaluar el riesgo del puesto de trabajo y coordinar seguimiento médico.',
      responsable: 'Prevención de riesgos',
      limitaciones:
        'No reemplaza la investigación formal de accidentes exigida por ley; es un recordatorio operativo. ' +
        'Esta es una sugerencia basada en reglas fijas, no un diagnóstico — debe ser evaluada por un profesional antes de implementarse.',
    })
    expect(
      accionSugerida({ tipoAdministrativo: 'accidente_trayecto', clasificacionAnalitica: 'accidente' }).responsable
    ).toBe('Prevención de riesgos')
  })

  it('suggests occupational health evaluation for enfermedad_profesional', () => {
    const resultado = accionSugerida({
      tipoAdministrativo: 'enfermedad_profesional',
      clasificacionAnalitica: 'enfermedad_profesional',
    })
    expect(resultado.accion).toBe(
      'Evaluación de salud ocupacional y revisión de condiciones del puesto asociadas a la enfermedad profesional.'
    )
    expect(resultado.responsable).toBe('Salud ocupacional')
  })

  it('suggests reincorporation planning for maternal and patologia_embarazo', () => {
    expect(
      accionSugerida({ tipoAdministrativo: 'maternal', clasificacionAnalitica: 'maternal' }).accion
    ).toBe('Preparar plan de reincorporación y ajustes de puesto según corresponda al retorno.')
    expect(
      accionSugerida({ tipoAdministrativo: 'patologia_embarazo', clasificacionAnalitica: 'maternal' }).responsable
    ).toBe('RR.HH.')
  })

  it('suggests no extra follow-up for enfermedad_grave_hijo_menor beyond confirming coverage', () => {
    const resultado = accionSugerida({
      tipoAdministrativo: 'enfermedad_grave_hijo_menor',
      clasificacionAnalitica: 'cuidado_familiar',
    })
    expect(resultado.accion).toBe(
      'Confirmar cobertura y duración del permiso; sin acción de seguimiento adicional salvo solicitud del trabajador.'
    )
  })

  it('suggests ongoing follow-up for prorroga_medicina_preventiva', () => {
    const resultado = accionSugerida({
      tipoAdministrativo: 'prorroga_medicina_preventiva',
      clasificacionAnalitica: 'continuacion',
    })
    expect(resultado.accion).toBe('Dar seguimiento como episodio en curso — evaluar necesidad de apoyo adicional.')
    expect(resultado.responsable).toBe('Salud ocupacional')
  })

  it('splits sin_clasificar administrative types into distinct suggestions', () => {
    expect(
      accionSugerida({ tipoAdministrativo: 'permiso_administrativo', clasificacionAnalitica: 'sin_clasificar' }).accion
    ).toBe('Sin acción de seguimiento — permiso administrativo estándar.')
    expect(
      accionSugerida({ tipoAdministrativo: 'ausencia_injustificada', clasificacionAnalitica: 'sin_clasificar' }).accion
    ).toBe('Conversación con la jefatura directa para conocer la causa; evaluar si corresponde una acción de RR.HH.')
    expect(
      accionSugerida({ tipoAdministrativo: 'vacaciones', clasificacionAnalitica: 'sin_clasificar' }).accion
    ).toBe('Sin acción de seguimiento — vacaciones.')
    expect(
      accionSugerida({ tipoAdministrativo: 'otros', clasificacionAnalitica: 'sin_clasificar' }).accion
    ).toBe('Revisar el detalle del caso para determinar si requiere clasificación específica.')
  })

  it('escalates enfermedad_comun by duration and recurrence', () => {
    expect(
      accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'corto' }).accion
    ).toBe('Sin acción de seguimiento — episodio corto y aislado.')
    expect(
      accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'mediano' }).accion
    ).toBe('Sin acción especial; monitorear si se repite.')
    expect(
      accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'prolongado' }).accion
    ).toBe('Plan de retorno gradual con adaptaciones y seguimiento.')
    expect(
      accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'recurrente' }).accion
    ).toBe('Derivar a evaluación de salud ocupacional — 2 o más episodios en 12 meses.')
  })

  it('flags a recurrente episode with the organizational-cause caveat', () => {
    const resultado = accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'recurrente' })
    expect(resultado.limitaciones).toContain('causas organizacionales')
  })

  it('returns a no-action suggestion when data quality is insufficient, regardless of tipo', () => {
    const resultado = accionSugerida({
      tipoAdministrativo: 'enfermedad_comun',
      clasificacionAnalitica: 'calidad_insuficiente',
    })
    expect(resultado.accion).toBe('Sin acción — datos insuficientes para clasificar el episodio.')
    expect(resultado.responsable).toBe('—')
  })

  it('always ends limitaciones with the fixed human-review disclaimer', () => {
    const disclaimer =
      'Esta es una sugerencia basada en reglas fijas, no un diagnóstico — debe ser evaluada por un profesional antes de implementarse.'
    expect(
      accionSugerida({ tipoAdministrativo: 'enfermedad_comun', clasificacionAnalitica: 'corto' }).limitaciones
    ).toContain(disclaimer)
    expect(
      accionSugerida({ tipoAdministrativo: 'vacaciones', clasificacionAnalitica: 'sin_clasificar' }).limitaciones
    ).toContain(disclaimer)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/ingestion/accionSugerida.test.ts`
Expected: FAIL — `Cannot find module './accionSugerida'`

- [ ] **Step 3: Write the implementation**

Create `lib/ingestion/accionSugerida.ts`:

```ts
import type { ClasificacionAnalitica, TipoAdministrativoClave } from './types'

export type AccionSugerida = {
  accion: string
  responsable: string
  limitaciones: string
}

export type AccionSugeridaInput = {
  tipoAdministrativo: TipoAdministrativoClave
  clasificacionAnalitica: ClasificacionAnalitica
}

const REVISION_HUMANA =
  'Esta es una sugerencia basada en reglas fijas, no un diagnóstico — debe ser evaluada por un profesional antes de implementarse.'

// Fixed-rule lookup, not a trained model — same principle as clasificarEpisodio(). Keyed on
// tipoAdministrativo (not clasificacionAnalitica alone) because clasificarEpisodio() collapses
// permiso_administrativo/ausencia_injustificada/vacaciones/otros into a single 'sin_clasificar'
// value, and those four need distinct suggestions.
export function accionSugerida(input: AccionSugeridaInput): AccionSugerida {
  if (input.clasificacionAnalitica === 'calidad_insuficiente') {
    return {
      accion: 'Sin acción — datos insuficientes para clasificar el episodio.',
      responsable: '—',
      limitaciones: REVISION_HUMANA,
    }
  }

  switch (input.tipoAdministrativo) {
    case 'accidente_laboral':
    case 'accidente_trayecto':
      return {
        accion: 'Investigar el accidente, evaluar el riesgo del puesto de trabajo y coordinar seguimiento médico.',
        responsable: 'Prevención de riesgos',
        limitaciones:
          'No reemplaza la investigación formal de accidentes exigida por ley; es un recordatorio operativo. ' +
          REVISION_HUMANA,
      }
    case 'enfermedad_profesional':
      return {
        accion:
          'Evaluación de salud ocupacional y revisión de condiciones del puesto asociadas a la enfermedad profesional.',
        responsable: 'Salud ocupacional',
        limitaciones:
          'Requiere la calificación formal del organismo administrador (mutualidad); esto es solo un recordatorio de seguimiento. ' +
          REVISION_HUMANA,
      }
    case 'maternal':
    case 'patologia_embarazo':
      return {
        accion: 'Preparar plan de reincorporación y ajustes de puesto según corresponda al retorno.',
        responsable: 'RR.HH.',
        limitaciones: 'Los ajustes deben basarse en la indicación médica autorizada, no en suposiciones. ' + REVISION_HUMANA,
      }
    case 'enfermedad_grave_hijo_menor':
      return {
        accion:
          'Confirmar cobertura y duración del permiso; sin acción de seguimiento adicional salvo solicitud del trabajador.',
        responsable: 'RR.HH.',
        limitaciones: 'Es un permiso legal, no requiere intervención salvo que la persona la solicite. ' + REVISION_HUMANA,
      }
    case 'prorroga_medicina_preventiva':
      return {
        accion: 'Dar seguimiento como episodio en curso — evaluar necesidad de apoyo adicional.',
        responsable: 'Salud ocupacional',
        limitaciones: REVISION_HUMANA,
      }
    case 'permiso_administrativo':
      return {
        accion: 'Sin acción de seguimiento — permiso administrativo estándar.',
        responsable: '—',
        limitaciones: REVISION_HUMANA,
      }
    case 'ausencia_injustificada':
      return {
        accion: 'Conversación con la jefatura directa para conocer la causa; evaluar si corresponde una acción de RR.HH.',
        responsable: 'RR.HH.',
        limitaciones: 'No implica automáticamente una falta — debe evaluarse caso a caso. ' + REVISION_HUMANA,
      }
    case 'vacaciones':
      return {
        accion: 'Sin acción de seguimiento — vacaciones.',
        responsable: '—',
        limitaciones: REVISION_HUMANA,
      }
    case 'otros':
      return {
        accion: 'Revisar el detalle del caso para determinar si requiere clasificación específica.',
        responsable: 'RR.HH.',
        limitaciones: REVISION_HUMANA,
      }
    case 'enfermedad_comun':
      return accionEnfermedadComun(input.clasificacionAnalitica)
  }
}

function accionEnfermedadComun(clasificacion: ClasificacionAnalitica): AccionSugerida {
  if (clasificacion === 'recurrente') {
    return {
      accion: 'Derivar a evaluación de salud ocupacional — 2 o más episodios en 12 meses.',
      responsable: 'Salud ocupacional',
      limitaciones:
        'Un aumento de licencias puede reflejar causas organizacionales, no solo individuales — revisar contexto (carga, turno, área) antes de concluir. ' +
        REVISION_HUMANA,
    }
  }
  if (clasificacion === 'prolongado') {
    return {
      accion: 'Plan de retorno gradual con adaptaciones y seguimiento.',
      responsable: 'Salud ocupacional / RR.HH.',
      limitaciones: 'Los ajustes deben basarse en la indicación médica autorizada. ' + REVISION_HUMANA,
    }
  }
  if (clasificacion === 'mediano') {
    return {
      accion: 'Sin acción especial; monitorear si se repite.',
      responsable: '—',
      limitaciones: REVISION_HUMANA,
    }
  }
  return {
    accion: 'Sin acción de seguimiento — episodio corto y aislado.',
    responsable: '—',
    limitaciones: REVISION_HUMANA,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/ingestion/accionSugerida.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ingestion/accionSugerida.ts lib/ingestion/accionSugerida.test.ts
git commit -m "feat: add fixed-rule accionSugerida lookup keyed by tipo administrativo"
```

---

### Task 2: Wire tipoAdministrativoClave + per-person cost through the page and the table

Both files below share one interface change (`EpisodioFila` gains two fields) — neither file
type-checks on its own until both are changed, so this is one task with one deliverable: the
Ausencias page renders end to end with a working "Acción sugerida" column.

**Files:**
- Modify: `app/plataforma/ausencias/page.tsx`
- Modify: `components/platform/ausencias/AusenciasTable.tsx`

**Interfaces:**
- Consumes: `computeIndicadoresPorPersona` from `lib/indicators/porPersona.ts` (existing, signature:
  `(input: { personas: Array<{ id: string; codigo: string }>; episodios: Array<{ personaId: string;
  dias: number }>; costoPromedioDiario: number }) => IndicadorPersona[]`, where `IndicadorPersona =
  { id: string; codigo: string; diasPerdidos: number; cantidadEpisodios: number; costoEstimado:
  number }`). `TipoAdministrativoClave` from `lib/ingestion/types.ts`. `accionSugerida` and
  `AccionSugeridaInput` from `lib/ingestion/accionSugerida.ts` (Task 1).
- Produces: `EpisodioFila` (exported from `AusenciasTable.tsx`) gains `tipoAdministrativoClave:
  TipoAdministrativoClave` and `costoEstimadoPersona: number` — no later task consumes this, it's
  the final interface for this feature.

- [ ] **Step 1: Add `clave` to the tipos_administrativos query and the cost lookup**

In `app/plataforma/ausencias/page.tsx`, replace the imports and the two blocks shown:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaActiva } from '@/lib/platform/empresa-activa'
import { mapEpisodioRow } from '@/lib/ingestion/types'
import type { TipoAdministrativoClave } from '@/lib/ingestion/types'
import { computeIndicadoresPorPersona } from '@/lib/indicators/porPersona'
import { AusenciasTable, type EpisodioFila } from '@/components/platform/ausencias/AusenciasTable'

const COSTO_PROMEDIO_DIARIO = 40000
```

Replace this block (currently selects only `id, nombre`):

```tsx
  const { data: tipoRows } = await supabase.from('tipos_administrativos').select('id, nombre')
  const tipos = (tipoRows ?? []).map((row) => ({ id: row.id as string, nombre: row.nombre as string }))
```

with:

```tsx
  const { data: tipoRows } = await supabase.from('tipos_administrativos').select('id, clave, nombre')
  const tipos = (tipoRows ?? []).map((row) => ({
    id: row.id as string,
    clave: row.clave as TipoAdministrativoClave,
    nombre: row.nombre as string,
  }))
```

Replace the `episodiosFilas` construction block:

```tsx
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
```

with:

```tsx
  const costoPorPersona = new Map(
    computeIndicadoresPorPersona({
      personas,
      episodios,
      costoPromedioDiario: COSTO_PROMEDIO_DIARIO,
    }).map((indicador) => [indicador.id, indicador.costoEstimado])
  )

  const episodiosFilas: EpisodioFila[] = episodios.map((episodio) => {
    const tipo = tipos.find((t) => t.id === episodio.tipoAdministrativoId)
    return {
      id: episodio.id,
      personaCodigo: personas.find((p) => p.id === episodio.personaId)?.codigo ?? episodio.personaId,
      tipoAdministrativoNombre: tipo?.nombre ?? episodio.tipoAdministrativoId,
      tipoAdministrativoClave: tipo?.clave ?? 'otros',
      fechaInicio: episodio.fechaInicio,
      fechaFin: episodio.fechaFin,
      dias: episodio.dias,
      estado: episodio.estado,
      clasificacionAnalitica: episodio.clasificacionAnalitica,
      costoEstimadoPersona: costoPorPersona.get(episodio.personaId) ?? 0,
    }
  })
```

- [ ] **Step 2: Update imports and the `EpisodioFila` type in `AusenciasTable.tsx`**

In `components/platform/ausencias/AusenciasTable.tsx`, replace the top of the file (imports through
the `EpisodioFila` type) with:

```tsx
'use client'

import { Fragment, useMemo, useState } from 'react'
import type { ClasificacionAnalitica, TipoAdministrativoClave } from '@/lib/ingestion/types'
import { accionSugerida } from '@/lib/ingestion/accionSugerida'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

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
  tipoAdministrativoClave: TipoAdministrativoClave
  fechaInicio: string
  fechaFin: string | null
  dias: number
  estado: 'abierto' | 'cerrado'
  clasificacionAnalitica: ClasificacionAnalitica
  costoEstimadoPersona: number
}
```

- [ ] **Step 3: Add expand state and the "Acción sugerida" column**

Replace the `export function AusenciasTable` body's state declarations (the two `useState` lines)
with:

```tsx
export function AusenciasTable({ episodios }: { episodios: EpisodioFila[] }) {
  const [tipoFiltro, setTipoFiltro] = useState('__todos__')
  const [estadoFiltro, setEstadoFiltro] = useState('__todos__')
  const [expandedId, setExpandedId] = useState<string | null>(null)
```

Replace the `<TableHeader>` block:

```tsx
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
```

with:

```tsx
        <TableHeader>
          <TableRow>
            <TableHead>Persona</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha inicio</TableHead>
            <TableHead>Fecha fin</TableHead>
            <TableHead>Días</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Clasificación</TableHead>
            <TableHead>Acción sugerida</TableHead>
          </TableRow>
        </TableHeader>
```

Replace the `<TableBody>` block:

```tsx
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
```

with:

```tsx
        <TableBody>
          {episodiosFiltrados.map((episodio) => {
            const expandido = expandedId === episodio.id
            const plan = accionSugerida({
              tipoAdministrativo: episodio.tipoAdministrativoClave,
              clasificacionAnalitica: episodio.clasificacionAnalitica,
            })
            return (
              <Fragment key={episodio.id}>
                <TableRow>
                  <TableCell>{episodio.personaCodigo}</TableCell>
                  <TableCell>{episodio.tipoAdministrativoNombre}</TableCell>
                  <TableCell>{episodio.fechaInicio}</TableCell>
                  <TableCell>{episodio.fechaFin ?? '—'}</TableCell>
                  <TableCell>{episodio.dias}</TableCell>
                  <TableCell className="capitalize">{episodio.estado}</TableCell>
                  <TableCell>{CLASIFICACION_LABELS[episodio.clasificacionAnalitica]}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId(expandido ? null : episodio.id)}
                    >
                      {expandido ? 'Ocultar plan' : 'Ver plan'}
                    </Button>
                  </TableCell>
                </TableRow>
                {expandido ? (
                  <TableRow>
                    <TableCell colSpan={8} className="whitespace-normal bg-muted/30">
                      <div className="space-y-1.5 py-2 text-sm">
                        <p>
                          <span className="font-medium text-foreground">Acción sugerida:</span> {plan.accion}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Responsable:</span> {plan.responsable}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Costo estimado de la persona:</span> $
                          {episodio.costoEstimadoPersona.toLocaleString('es-CL')}
                        </p>
                        <p className="text-xs text-muted-foreground">{plan.limitaciones}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            )
          })}
        </TableBody>
```

- [ ] **Step 4: Run the type checker across the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the 11 new `accionSugerida` tests from Task 1.

- [ ] **Step 6: Commit**

```bash
git add app/plataforma/ausencias/page.tsx components/platform/ausencias/AusenciasTable.tsx
git commit -m "feat: show expandable acción sugerida row in Ausencias y licencias"
```

---

### Task 3: Manual verification against production data and deploy

**Files:** none (verification + deploy only).

- [ ] **Step 1: Run the full test suite one more time from repo root**

Run: `npm test`
Expected: all tests pass (no regressions from Tasks 1-2 combined).

- [ ] **Step 2: Build to catch any production-only type or bundling errors**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Deploy to production**

Run: `vercel --prod --yes`
Expected: deployment succeeds and re-aliases the production domain (same approach used earlier
this session when the GitHub auto-deploy pipeline stalled).

- [ ] **Step 4: Verify live on production**

Using the already-authenticated browser tab, open "Ausencias y licencias", click "Ver plan" on at
least 3 episodios covering different cases (one `enfermedad_comun` corto, one `enfermedad_comun`
prolongado or recurrente if data allows, one non-`enfermedad_comun` type like `vacaciones` or
`accidente_laboral`), and confirm each shows a distinct, sensible acción/responsable/costo/
limitaciones — not the same generic text repeated for every row.
