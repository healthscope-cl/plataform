# HealthScope Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the single-page commercial Home for HealthScope (`app/page.tsx`) per `docs/superpowers/specs/2026-07-15-home-page-design.md` — 14 sections, an illustrated hero (no stock photos), a real interactive impact calculator, and a Supabase-backed demo request form.

**Architecture:** One server component (`app/page.tsx`) renders a client shell (`components/home/HomeClientShell.tsx`) that assembles 14 section components from `components/home/`. All copy lives in typed constants in `lib/home/content.ts`. The impact calculator's math lives in a pure, tested function (`lib/home/impactCalculator.ts`). The demo form inserts directly into a new `demo_requests` Supabase table via the existing `@supabase/ssr` browser client.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui + `motion` + `react-hook-form` + `zod` + Supabase (`@supabase/ssr`) + Vitest.

## Global Constraints

- Colors are the 8 hex tokens from the spec, applied as Tailwind arbitrary-value classes (e.g. `bg-[#03142F]`) — same pattern condor-crm uses for its cyan accent. Do not add new CSS custom properties to `globals.css` beyond the font fix in Task 1.
  - `--navy: #03142F` · `--blue: #1455E6` · `--cyan: #00B8F5` · `--teal: #12C7B4` · `--green: #38D978` · `--ink: #101827` · `--paper: #F4F7FB` · `--gray: #48556A`
- Typography: **Sora** for headings (Tailwind `font-heading` utility), **Inter** for body/UI (default `font-sans`). Both via `next/font/google`.
- Copy is Spanish only, taken verbatim from `lib/home/content.ts` — no paraphrasing when transcribing from this plan.
- No stock or real photography — illustrated/abstract treatment only (gradients, node/line motifs).
- Motion stays restrained: short transitions (200–600ms), `whileInView` reveals fire once, no parallax. Every animated component must respect `useReducedMotion()` from `motion/react`.
- No Server Actions — all writes go through `createClient()` from `lib/supabase/client.ts` in `'use client'` components.
- Never present calculator or results numbers as guaranteed savings — always show the formula and the "estimación, no garantizada" disclaimer.
- **Two steps in this plan cannot be delegated to an implementer subagent**: applying `supabase/schema.sql` via the Supabase SQL Editor (Task 3, Step 5) and the final browser-based manual verification (Task 14) both require the browser session already authenticated to the `healthscope-platform` Supabase project — only the controller (main session) has that. Flag both clearly when dispatching.

## File Structure

```
app/
  layout.tsx              (MODIFY — swap Geist for Sora/Inter, lang="es")
  globals.css              (MODIFY — fix --font-sans/--font-heading to literal Sora/Inter)
  page.tsx                 (REWRITE — server component, metadata, renders HomeClientShell)
  login/
    page.tsx                (CREATE — stub)
lib/
  home/
    content.ts               (CREATE — all copy, typed)
    impactCalculator.ts       (CREATE — pure calculation function)
    impactCalculator.test.ts  (CREATE)
components/
  home/
    HomeClientShell.tsx      (CREATE — holds demo-sheet open state, assembles sections)
    Header.tsx               (CREATE)
    Footer.tsx                (CREATE)
    Hero.tsx                 (CREATE)
    TrustStrip.tsx            (CREATE)
    ProblemSection.tsx        (CREATE)
    HowItWorks.tsx            (CREATE)
    Features.tsx              (CREATE)
    BenefitsAccordion.tsx     (CREATE)
    UseCases.tsx               (CREATE)
    PlatformShowcase.tsx      (CREATE)
    PrivacySection.tsx        (CREATE)
    ResultsSection.tsx        (CREATE)
    ImpactCalculator.tsx      (CREATE)
    Faq.tsx                   (CREATE)
    ClosingCta.tsx             (CREATE)
    DemoRequestSheet.tsx      (CREATE)
  ui/
    sheet.tsx, accordion.tsx, form.tsx, input.tsx, label.tsx  (CREATE — via shadcn CLI)
supabase/
  schema.sql                (CREATE — demo_requests table + RLS)
vitest.config.ts             (CREATE)
package.json                 (MODIFY — add vitest, test script)
```

**Note on branching:** this repo has only 2 commits, no other collaborators, and no real users yet (Phase 0). Recommend working directly on `main` rather than a worktree/branch, given `subagent-driven-development`'s per-task review loop already provides a quality gate. This needs the user's explicit go-ahead before Task 1 starts (their skill forbids starting on `main` without consent) — surface it at dispatch time if not already confirmed.

---

### Task 1: Typography + content constants

**Files:**
- Modify: `app/layout.tsx` (full rewrite, shown below)
- Modify: `app/globals.css:10-12`
- Create: `lib/home/content.ts`

**Interfaces:**
- Produces: every export in `lib/home/content.ts` — `seo`, `nav`, `hero`, `trustStrip`, `problem`, `howItWorks`, `features`, `benefits`, `useCases`, `platformShowcase`, `privacy`, `results`, `faq`, `closing`, `footer`. All later component tasks import from this file; the exact shapes below are final and must not be renamed.

- [ ] **Step 1: Replace the font setup in `app/layout.tsx`**

Replace the entire file with:

```tsx
import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HealthScope",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${sora.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Fix the font tokens in `app/globals.css`**

Find these three lines (inside the `@theme inline { ... }` block, around lines 10-12):

```css
  --font-sans: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", "Geist Mono Fallback", ui-monospace, monospace;
  --font-heading: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
```

Replace with:

```css
  --font-sans: "Inter", "Inter Fallback", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", Menlo, monospace;
  --font-heading: "Sora", "Sora Fallback", ui-sans-serif, system-ui, sans-serif;
```

(Literal font-family strings, not `var(...)` — Tailwind v4's `@theme inline` resolves at parse time, so referencing the runtime-injected `--font-sora`/`--font-inter` variables here would silently break the font. This is the same fix already applied once in this project's scaffold commit; Task 1 replaces "Geist" with the real project fonts.)

- [ ] **Step 3: Create `lib/home/content.ts`**

```ts
export const seo = {
  title: 'HealthScope | Inteligencia de ausentismo y salud laboral',
  description:
    'Analiza licencias y ausencias, detecta tendencias, administra intervenciones y mide resultados con una plataforma para Recursos Humanos y salud ocupacional.',
}

export const nav = {
  links: [
    { label: 'Cómo funciona', href: '#como-funciona', disabled: false },
    { label: 'Plataforma', href: '#plataforma', disabled: false },
    { label: 'Seguridad', href: '#privacidad', disabled: false },
    { label: 'Soluciones', href: '#beneficios', disabled: false },
    { label: 'Recursos', href: '#', disabled: true },
  ],
  ingresar: { label: 'Ingresar', href: '/login' },
  demoLabel: 'Solicitar demostración',
}

export const hero = {
  titulo: 'Convierte el ausentismo en decisiones preventivas.',
  texto:
    'HealthScope reúne datos de licencias y ausencias, identifica patrones organizacionales, prioriza riesgos y transforma los hallazgos en planes de acción medibles.',
  ctaPrimario: 'Solicitar demostración',
  ctaSecundario: 'Ver cómo funciona',
  microtexto: 'Diseñado para Recursos Humanos, Prevención, Salud Ocupacional y Gerencia.',
  tarjetas: [
    { label: 'Días de ausencia', valor: '412' },
    { label: 'Episodios recurrentes', valor: '38' },
    { label: 'Áreas con mayor variación', valor: '5' },
    { label: 'Intervenciones activas', valor: '12' },
  ],
}

export const trustStrip = [
  'Privacidad desde el diseño',
  'Información agregada y protegida',
  'Trazabilidad completa',
  'Alertas configurables',
  'Intervenciones medibles',
]

export const problem = {
  titulo: 'La empresa ya tiene los datos. Lo difícil es entender qué significan.',
  texto:
    'Las licencias, ausencias, turnos, áreas y costos suelen quedar repartidos entre planillas, correos y sistemas de Recursos Humanos. HealthScope los ordena y muestra dónde se concentran los cambios, qué factores requieren revisión y qué acciones pueden evaluarse.',
  tarjetas: ['Datos dispersos', 'Poca visibilidad de patrones', 'Acciones sin medición posterior'],
}

export const howItWorks = {
  pasos: [
    'Conecta o importa datos.',
    'Normaliza y clasifica.',
    'Detecta tendencias y prioridades.',
    'Activa planes de acción.',
    'Mide el impacto.',
  ],
}

export const features = {
  titulo: 'Todo lo necesario para pasar del dato a la acción.',
  tarjetas: [
    'Analítica de ausentismo',
    'Clasificación y taxonomías',
    'Mapas de calor',
    'Alertas tempranas',
    'Planes de acción',
    'Campañas preventivas',
    'Red de profesionales',
    'Seguimiento de resultados',
    'Informes ejecutivos',
    'Integraciones',
    'Privacidad y auditoría',
    'Encuestas anónimas',
  ],
}

export const benefits = [
  {
    rol: 'Recursos Humanos',
    items: [
      'Centraliza registros',
      'Reduce trabajo manual',
      'Detecta recurrencia y ausencias prolongadas',
      'Coordina acciones',
      'Controla permisos y trazabilidad',
    ],
  },
  {
    rol: 'Jefaturas',
    items: [
      'Recibe alertas cuando corresponde',
      'Ve información agregada de su área',
      'Accede a guías preventivas',
      'Registra acciones',
    ],
  },
  {
    rol: 'Prevención y Salud Ocupacional',
    items: ['Prioriza evaluaciones', 'Administra campañas', 'Coordina derivaciones', 'Mide intervenciones'],
  },
  {
    rol: 'Gerencia',
    items: ['Compara áreas y períodos', 'Prioriza presupuesto', 'Revisa resultados', 'Supervisa cumplimiento'],
  },
  {
    rol: 'Trabajadores',
    items: [
      'Accede a campañas y material',
      'Recibe recordatorios',
      'Responde encuestas voluntarias',
      'Mantiene protegida su información sensible',
    ],
  },
]

export const useCases = [
  {
    titulo: 'Aumento de ausencias en una sucursal',
    senal: 'Alza sostenida de días perdidos en una sucursal específica respecto de su línea base.',
    datos: 'Episodios y días perdidos por sucursal, período móvil de 3 meses.',
    accion: 'Plan de acción focalizado con jefatura local y prevención.',
    resultado: 'Variación de la tasa de ausentismo de la sucursal tras la intervención.',
    limitaciones: 'No aísla causas externas (estacionalidad, cambios de dotación).',
  },
  {
    titulo: 'Reincidencia en un turno',
    senal: 'Concentración de episodios recurrentes en un turno específico.',
    datos: 'Frecuencia y reincidencia por turno.',
    accion: 'Revisión de condiciones de turno con RR.HH. y jefatura.',
    resultado: 'Cambio en la tasa de reincidencia del turno.',
    limitaciones: 'Requiere suficiente dotación en el turno para ser representativo.',
  },
  {
    titulo: 'Concentración de accidentes',
    senal: 'Aumento de accidentes laborales en un área o período.',
    datos: 'Episodios clasificados como accidente laboral o de trayecto.',
    accion: 'Evaluación de riesgo y plan de prevención de accidentes.',
    resultado: 'Variación en accidentes tras el plan.',
    limitaciones: 'Los datos dependen de la calidad del registro de origen.',
  },
  {
    titulo: 'Tendencia musculoesquelética agregada',
    senal: 'Aumento agregado en la categoría clínica musculoesquelética.',
    datos: 'Clasificación clínica agregada, solo con base legal y proveedor autorizado.',
    accion: 'Programa de ergonomía focalizado.',
    resultado: 'Evolución de la tendencia agregada tras el programa.',
    limitaciones: 'Solo disponible con fuente clínica autorizada; no identifica personas.',
  },
  {
    titulo: 'Tendencia de salud mental agregada',
    senal: 'Aumento agregado en la categoría clínica de salud mental.',
    datos: 'Clasificación clínica agregada, solo con base legal y proveedor autorizado.',
    accion: 'Campaña de apoyo psicológico y educación preventiva.',
    resultado: 'Evolución de la tendencia agregada tras la campaña.',
    limitaciones: 'Requiere grupo mínimo para evitar reidentificación.',
  },
  {
    titulo: 'Campaña de vacunación',
    senal: 'Ventana estacional de riesgo respiratorio.',
    datos: 'Historial de ausencias por causas respiratorias, participación en campañas previas.',
    accion: 'Campaña de vacunación con inscripción y agenda.',
    resultado: 'Tasa de participación y variación de ausencias respiratorias.',
    limitaciones: 'La participación es voluntaria; no mide efectividad clínica individual.',
  },
  {
    titulo: 'Programa de ergonomía',
    senal: 'Episodios recurrentes de dolor musculoesquelético agregado.',
    datos: 'Encuestas de dolor musculoesquelético, episodios clasificados.',
    accion: 'Programa de ergonomía con evaluación y seguimiento.',
    resultado: 'Cambio en episodios y en encuesta de seguimiento.',
    limitaciones: 'Depende de la participación voluntaria en encuestas.',
  },
  {
    titulo: 'Retorno al trabajo',
    senal: 'Episodio prolongado próximo a cierre.',
    datos: 'Duración del episodio, adaptación funcional autorizada.',
    accion: 'Plan de retorno gradual con adaptaciones y seguimiento.',
    resultado: 'Sostenibilidad del retorno (sin recaída) a 90 días.',
    limitaciones: 'La jefatura solo recibe la adaptación funcional, no el diagnóstico.',
  },
  {
    titulo: 'Evaluación de proveedores',
    senal: 'Diferencias en resultados entre prestadores o profesionales.',
    datos: 'Resultados agregados de intervenciones por prestador.',
    accion: 'Revisión de convenio y priorización de prestadores.',
    resultado: 'Comparación de resultados entre prestadores en el tiempo.',
    limitaciones: 'Requiere volumen suficiente de casos por prestador para comparar.',
  },
  {
    titulo: 'Comparación antes y después',
    senal: 'Cierre de una intervención o campaña.',
    datos: 'Línea base, período de intervención, período posterior.',
    accion: 'Informe de evaluación con metodología declarada.',
    resultado: 'Cambio porcentual respecto a la línea base.',
    limitaciones: 'No atribuye toda la mejora a la intervención sin diseño de evaluación.',
  },
]

export const platformShowcase = {
  titulo: 'Una vista clara para decisiones complejas.',
  texto:
    'Explora tendencias, filtra por estructura organizacional, administra alertas y convierte cada hallazgo en un plan con responsables, fechas e indicadores.',
  cta: 'Explorar la plataforma',
}

export const privacy = {
  titulo: 'Diseñada para proteger información sensible.',
  mensajes: [
    'Separación administrativa y clínica',
    'Accesos por rol',
    'Cifrado',
    'Auditoría',
    'Pseudonimización',
    'Resultados agregados',
    'Políticas de conservación',
    'Gestión de derechos de datos',
  ],
}

export const results = {
  titulo: 'Mide lo que cambia después de actuar.',
  etiquetaDemo: 'Datos de demostración',
}

export const faq = [
  {
    pregunta: '¿Reemplaza el sistema de RR.HH.?',
    respuesta:
      'No. HealthScope se integra con tu sistema de RR.HH. (Excel, Talana, Buk, Rex+, SAP u otros) y se enfoca en analítica, alertas y planes de acción, no en administración de personal.',
  },
  {
    pregunta: '¿Puede integrarse con Excel, Talana, Buk, Rex+, SAP u otros?',
    respuesta: 'Sí, mediante importación de archivos y, en fases posteriores, integraciones directas con estos sistemas.',
  },
  {
    pregunta: '¿La empresa puede ver diagnósticos?',
    respuesta:
      'HealthScope funciona sin diagnóstico individual mediante tipos de licencia, duración, frecuencia, recurrencia, accidentes, estructura organizacional y encuestas agregadas. La información clínica autorizada se mantiene separada y agregada.',
  },
  {
    pregunta: '¿Cómo se protegen los datos?',
    respuesta:
      'Con cifrado, control de accesos por rol, pseudonimización, auditoría completa y separación entre información administrativa y clínica.',
  },
  {
    pregunta: '¿Qué alertas genera?',
    respuesta:
      'Alertas configurables por umbral, área, turno, reincidencia, ausencias prolongadas y otros patrones, siempre con revisión humana.',
  },
  {
    pregunta: '¿Cómo se miden las intervenciones?',
    respuesta: 'Comparando una línea base con el período posterior a la intervención, con indicadores y metodología declarada.',
  },
  {
    pregunta: '¿Funciona sin información clínica?',
    respuesta:
      'Sí. El nivel administrativo y analítico no requiere información clínica; el nivel clínico agregado es opcional y solo con base legal y proveedor autorizado.',
  },
  {
    pregunta: '¿Qué pasa si los datos están incompletos?',
    respuesta: 'El panel de calidad de datos muestra completitud, errores y advertencias antes de generar indicadores.',
  },
  {
    pregunta: '¿La IA toma decisiones automáticamente?',
    respuesta:
      'No. La IA apoya con resúmenes, detección de anomalías y recomendaciones explicables, siempre con revisión humana y opción de desactivarse.',
  },
  {
    pregunta: '¿Se configura por sucursal, turno o centro de costo?',
    respuesta:
      'Sí, los filtros y alertas se configuran por empresa, sucursal, unidad, centro de costo, turno y otras dimensiones organizacionales.',
  },
  {
    pregunta: '¿Cómo se inicia un piloto?',
    respuesta: 'Solicitando una demostración: revisamos tus datos actuales y definimos un alcance inicial acotado.',
  },
]

export const closing = {
  titulo: 'Empieza por entender. Continúa con una acción medible.',
  texto:
    'Solicita una demostración y revisemos cómo convertir tus datos actuales en una estrategia de prevención y bienestar laboral.',
  cta: 'Solicitar demostración',
}

export const footer = {
  tagline: 'Inteligencia de ausentismo y salud laboral para empresas chilenas.',
  producto: [
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Plataforma', href: '#plataforma' },
    { label: 'Seguridad y privacidad', href: '#privacidad' },
  ],
  legal: ['Términos', 'Política de privacidad', 'Política de cookies'],
  copyright: '© 2026 HealthScope. Todos los derechos reservados.',
}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors (this file has no consumers yet, so this only checks the file's own syntax/types).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/globals.css lib/home/content.ts
git commit -m "feat: add HealthScope typography and Home page copy constants"
```

---

### Task 2: Impact calculator (pure function) + Vitest setup

**Files:**
- Create: `lib/home/impactCalculator.ts`
- Create: `lib/home/impactCalculator.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency and a `test` script)

**Interfaces:**
- Produces: `ImpactCalculatorInput` (interface), `ImpactScenario` (interface), `calcularImpacto(input: ImpactCalculatorInput): { costoActual: number; escenarios: ImpactScenario[] }`. Task 10 (`ImpactCalculator.tsx`) imports all three by these exact names.

- [ ] **Step 1: Install Vitest**

Run: `cd "C:\Users\Jose\Projects\healthscope" && $env:NODE_OPTIONS="--max-old-space-size=4096"; npm install -D vitest` (PowerShell) or `NODE_OPTIONS="--max-old-space-size=4096" npm install -D vitest` (bash). The higher memory limit avoids the OOM crash this sandbox has hit on earlier `npm install` runs in this same project.

- [ ] **Step 2: Add the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 3: Add the test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run"
```

- [ ] **Step 4: Write the failing test**

Create `lib/home/impactCalculator.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularImpacto } from './impactCalculator'

describe('calcularImpacto', () => {
  it('calcula el costo actual y los tres escenarios con inputs típicos', () => {
    const resultado = calcularImpacto({
      dotacion: 200,
      diasAusencia: 500,
      costoPromedioDiario: 40000,
      horasExtra: 2000000,
      reemplazos: 1500000,
      costosAdministrativos: 800000,
      mejoraHipotetica: 0.15,
    })

    expect(resultado.costoActual).toBe(500 * 40000 + 2000000 + 1500000 + 800000)
    expect(resultado.escenarios).toHaveLength(3)

    const conservador = resultado.escenarios.find((e) => e.nombre === 'conservador')!
    const moderado = resultado.escenarios.find((e) => e.nombre === 'moderado')!
    const alto = resultado.escenarios.find((e) => e.nombre === 'alto')!

    expect(conservador.factor).toBe(0.5)
    expect(moderado.factor).toBe(1.0)
    expect(alto.factor).toBe(1.5)

    expect(conservador.ahorroEstimado).toBeCloseTo(resultado.costoActual * 0.15 * 0.5)
    expect(moderado.ahorroEstimado).toBeCloseTo(resultado.costoActual * 0.15 * 1.0)
    expect(alto.ahorroEstimado).toBeCloseTo(resultado.costoActual * 0.15 * 1.5)
  })

  it('devuelve ahorro cero en los tres escenarios cuando la mejora hipotética es 0', () => {
    const resultado = calcularImpacto({
      dotacion: 50,
      diasAusencia: 100,
      costoPromedioDiario: 30000,
      horasExtra: 0,
      reemplazos: 0,
      costosAdministrativos: 0,
      mejoraHipotetica: 0,
    })

    resultado.escenarios.forEach((escenario) => {
      expect(escenario.ahorroEstimado).toBe(0)
    })
  })

  it('devuelve costo actual y ahorro cero cuando todos los inputs son cero', () => {
    const resultado = calcularImpacto({
      dotacion: 0,
      diasAusencia: 0,
      costoPromedioDiario: 0,
      horasExtra: 0,
      reemplazos: 0,
      costosAdministrativos: 0,
      mejoraHipotetica: 0,
    })

    expect(resultado.costoActual).toBe(0)
    resultado.escenarios.forEach((escenario) => {
      expect(escenario.ahorroEstimado).toBe(0)
      expect(Number.isFinite(escenario.ahorroEstimado)).toBe(true)
    })
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run lib/home/impactCalculator.test.ts`
Expected: FAIL — `Cannot find module './impactCalculator'`.

- [ ] **Step 6: Write the implementation**

Create `lib/home/impactCalculator.ts`:

```ts
export interface ImpactCalculatorInput {
  dotacion: number
  diasAusencia: number
  costoPromedioDiario: number
  horasExtra: number
  reemplazos: number
  costosAdministrativos: number
  mejoraHipotetica: number // 0-1, ej. 0.15 = 15%
}

export interface ImpactScenario {
  nombre: 'conservador' | 'moderado' | 'alto'
  factor: number
  ahorroEstimado: number
}

export function calcularImpacto(input: ImpactCalculatorInput): {
  costoActual: number
  escenarios: ImpactScenario[]
} {
  const costoActual =
    input.diasAusencia * input.costoPromedioDiario +
    input.horasExtra +
    input.reemplazos +
    input.costosAdministrativos

  const factores: Array<[ImpactScenario['nombre'], number]> = [
    ['conservador', 0.5],
    ['moderado', 1.0],
    ['alto', 1.5],
  ]

  const escenarios = factores.map(([nombre, factor]) => ({
    nombre,
    factor,
    ahorroEstimado: costoActual * input.mejoraHipotetica * factor,
  }))

  return { costoActual, escenarios }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run lib/home/impactCalculator.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 8: Commit**

```bash
git add lib/home/impactCalculator.ts lib/home/impactCalculator.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: add impact calculator with tests and Vitest setup"
```

---

### Task 3: shadcn UI primitives + `demo_requests` schema

**Files:**
- Create: `components/ui/sheet.tsx`, `components/ui/accordion.tsx`, `components/ui/form.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx` (all generated by the shadcn CLI, not hand-written)
- Create: `supabase/schema.sql`

**Interfaces:**
- Produces: the shadcn primitives' standard exports (`Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` from `sheet.tsx`; `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `accordion.tsx`; `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` from `form.tsx`; `Input` from `input.tsx`; `Label` from `label.tsx`) — Tasks 7, 10, 11, 12 import these by these exact names. Also produces the live `demo_requests` table in the `healthscope-platform` Supabase project, consumed by Task 12's insert call.

- [ ] **Step 1: Install the shadcn primitives**

Run:
```bash
cd "C:\Users\Jose\Projects\healthscope"
NODE_OPTIONS="--max-old-space-size=4096" npx shadcn@latest add sheet accordion form input label
```
Expected: 5 new files under `components/ui/`.

- [ ] **Step 2: Verify the install**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Write `supabase/schema.sql`**

```sql
create table demo_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  empresa text not null,
  email text not null,
  telefono text,
  cargo text
);

alter table demo_requests enable row level security;

create policy "Cualquiera puede solicitar demo"
  on demo_requests for insert
  to anon
  with check (true);
```

- [ ] **Step 4: Commit the schema file and shadcn components**

```bash
git add supabase/schema.sql components/ui/sheet.tsx components/ui/accordion.tsx components/ui/form.tsx components/ui/input.tsx components/ui/label.tsx package.json package-lock.json
git commit -m "feat: add shadcn form primitives and demo_requests schema"
```

- [ ] **Step 5 (controller only — requires the authenticated browser session, not delegable to a subagent): apply the schema to the live Supabase project**

Navigate to `https://supabase.com/dashboard/project/jjnrrkwydpsetugxtgea/sql/new`, paste the exact contents of `supabase/schema.sql`, run it, and confirm in the Table Editor (`https://supabase.com/dashboard/project/jjnrrkwydpsetugxtgea/editor`) that `demo_requests` exists with the 6 columns above and RLS enabled.

---

### Task 4: Header + Footer

**Files:**
- Create: `components/home/Header.tsx`
- Create: `components/home/Footer.tsx`

**Interfaces:**
- Consumes: `nav`, `footer` from `lib/home/content.ts` (Task 1); `Button` from `components/ui/button.tsx` (already in the scaffold); `cn` from `lib/utils.ts` (already in the scaffold).
- Produces: `Header({ onOpenDemo }: { onOpenDemo: () => void })`, `Footer()` (no props) — both imported by `HomeClientShell.tsx` in Task 13.

- [ ] **Step 1: Create `components/home/Header.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { nav } from '@/lib/home/content'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onOpenDemo: () => void
}

export function Header({ onOpenDemo }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 24)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 z-50 w-full transition-colors duration-300',
        scrolled ? 'bg-[#03142F]/95 backdrop-blur-sm shadow-lg' : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="HealthScope" width={40} height={40} className="rounded" />
          <span className="font-heading text-lg font-semibold text-white">HealthScope</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.links.map((link) =>
            link.disabled ? (
              <span
                key={link.label}
                aria-disabled="true"
                title="Próximamente"
                className="cursor-not-allowed text-sm text-white/40"
              >
                {link.label}
              </span>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-white/80 transition-colors hover:text-[#00B8F5]"
              >
                {link.label}
              </a>
            )
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={nav.ingresar.href}
            className="text-sm text-white/80 transition-colors hover:text-[#00B8F5]"
          >
            {nav.ingresar.label}
          </Link>
          <Button
            onClick={onOpenDemo}
            className="rounded-full bg-[#1455E6] px-5 text-white hover:bg-[#1455E6]/90"
          >
            {nav.demoLabel}
          </Button>
        </div>
      </div>
    </header>
  )
}
```

(Nav links other than "Ingresar"/demo are `hidden md:flex` — on mobile the header keeps only the logo, login link and demo button. Full section content stays reachable by scrolling since this is a single long page; a hamburger drawer is out of scope for v1.)

- [ ] **Step 2: Create `components/home/Footer.tsx`**

```tsx
import { footer } from '@/lib/home/content'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="bg-[#03142F] px-6 py-16 text-white/70">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="HealthScope" width={36} height={36} className="rounded" />
            <span className="font-heading text-base font-semibold text-white">HealthScope</span>
          </div>
          <p className="mt-4 max-w-xs text-sm">{footer.tagline}</p>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold text-white">Producto</h3>
          <ul className="mt-4 space-y-2">
            {footer.producto.map((item) => (
              <li key={item.label}>
                <a href={item.href} className="text-sm transition-colors hover:text-[#00B8F5]">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold text-white">Legal</h3>
          <ul className="mt-4 space-y-2">
            {footer.legal.map((item) => (
              <li key={item} className="text-sm text-white/40">
                {item} <span className="text-xs">(próximamente)</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-7xl border-t border-white/10 pt-6 text-xs text-white/40">
        {footer.copyright}
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors. (These components aren't rendered anywhere yet, but they must type-check standalone.)

- [ ] **Step 4: Commit**

```bash
git add components/home/Header.tsx components/home/Footer.tsx
git commit -m "feat: add Home header and footer"
```

---

### Task 5: Hero + TrustStrip

**Files:**
- Create: `components/home/Hero.tsx`
- Create: `components/home/TrustStrip.tsx`

**Interfaces:**
- Consumes: `hero`, `trustStrip` from `lib/home/content.ts` (Task 1); `Button` from `components/ui/button.tsx`.
- Produces: `Hero({ onOpenDemo }: { onOpenDemo: () => void })`, `TrustStrip()` — both imported by `HomeClientShell.tsx` in Task 13.

- [ ] **Step 1: Create `components/home/Hero.tsx`**

```tsx
'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { hero } from '@/lib/home/content'

interface HeroProps {
  onOpenDemo: () => void
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

function NodesBackground() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
      viewBox="0 0 800 600"
      fill="none"
    >
      <g stroke="#00B8F5" strokeWidth="1">
        <line x1="80" y1="120" x2="220" y2="60" />
        <line x1="220" y1="60" x2="360" y2="140" />
        <line x1="360" y1="140" x2="520" y2="80" />
        <line x1="520" y1="80" x2="680" y2="160" />
        <line x1="120" y1="380" x2="280" y2="320" />
        <line x1="280" y1="320" x2="440" y2="400" />
        <line x1="440" y1="400" x2="600" y2="340" />
      </g>
      <g fill="#00B8F5">
        <circle cx="80" cy="120" r="4" />
        <circle cx="220" cy="60" r="3" />
        <circle cx="360" cy="140" r="4" />
        <circle cx="520" cy="80" r="3" />
        <circle cx="680" cy="160" r="4" />
        <circle cx="120" cy="380" r="3" />
        <circle cx="280" cy="320" r="4" />
        <circle cx="440" cy="400" r="3" />
        <circle cx="600" cy="340" r="4" />
      </g>
    </svg>
  )
}

export function Hero({ onOpenDemo }: HeroProps) {
  const reduceMotion = useReducedMotion()

  return (
    <section className="relative overflow-hidden bg-[#03142F] pt-40 pb-24">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 20% 20%, rgba(0,184,245,0.15), transparent 55%)' }}
      />
      <NodesBackground />

      <motion.div
        initial={reduceMotion ? undefined : 'hidden'}
        animate={reduceMotion ? undefined : 'show'}
        variants={container}
        className="relative mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-2 md:items-center"
      >
        <div>
          <motion.h1
            variants={item}
            className="font-heading text-4xl font-bold leading-tight text-white md:text-5xl"
          >
            {hero.titulo}
          </motion.h1>
          <motion.p variants={item} className="mt-6 max-w-xl text-lg text-white/80">
            {hero.texto}
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap gap-4">
            <Button
              onClick={onOpenDemo}
              size="lg"
              className="rounded-full bg-[#1455E6] px-6 text-white hover:bg-[#1455E6]/90"
            >
              {hero.ctaPrimario}
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-white/30 bg-transparent px-6 text-white hover:bg-white/10"
            >
              <a href="#como-funciona">{hero.ctaSecundario}</a>
            </Button>
          </motion.div>
          <motion.p variants={item} className="mt-6 text-sm text-white/50">
            {hero.microtexto}
          </motion.p>
        </div>

        <motion.div variants={item} className="relative">
          <div
            aria-hidden="true"
            className="relative mx-auto aspect-square max-w-md rounded-[40%_60%_55%_45%/50%_45%_55%_50%] bg-gradient-to-br from-[#1455E6] via-[#00B8F5] to-[#12C7B4] opacity-90"
          />
          <div className="absolute inset-0 grid grid-cols-2 gap-3 p-6">
            {hero.tarjetas.map((tarjeta) => (
              <div
                key={tarjeta.label}
                className="self-start rounded-2xl border border-white/20 bg-[#03142F]/80 p-4 backdrop-blur-sm"
              >
                <p className="font-heading text-2xl font-semibold text-white [font-variant-numeric:tabular-nums]">
                  {tarjeta.valor}
                </p>
                <p className="mt-1 text-xs text-white/70">{tarjeta.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 2: Create `components/home/TrustStrip.tsx`**

```tsx
import { ShieldCheck } from 'lucide-react'
import { trustStrip } from '@/lib/home/content'

export function TrustStrip() {
  return (
    <section className="bg-[#F4F7FB] px-6 py-10">
      <ul className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {trustStrip.map((label) => (
          <li key={label} className="flex items-center gap-2 text-sm text-[#48556A]">
            <ShieldCheck className="h-4 w-4 text-[#00B8F5]" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/Hero.tsx components/home/TrustStrip.tsx
git commit -m "feat: add Home hero and trust strip"
```

---

### Task 6: ProblemSection + HowItWorks

**Files:**
- Create: `components/home/ProblemSection.tsx`
- Create: `components/home/HowItWorks.tsx`

**Interfaces:**
- Consumes: `problem`, `howItWorks` from `lib/home/content.ts` (Task 1).
- Produces: `ProblemSection()`, `HowItWorks()` (no props, both self-contained) — imported by `HomeClientShell.tsx` in Task 13. `HowItWorks` renders `<section id="como-funciona">`, the scroll target used by the Header's nav link and the Hero's secondary CTA (Tasks 4–5).

- [ ] **Step 1: Create `components/home/ProblemSection.tsx`**

```tsx
'use client'

import { motion } from 'motion/react'
import { problem } from '@/lib/home/content'

export function ProblemSection() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{problem.titulo}</h2>
        <p className="mt-6 text-lg text-[#48556A]">{problem.texto}</p>
      </div>

      <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
        {problem.tarjetas.map((tarjeta, index) => (
          <motion.div
            key={tarjeta}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="rounded-2xl border border-[#48556A]/10 bg-[#F4F7FB] p-6"
          >
            <p className="font-heading text-lg font-semibold text-[#101827]">{tarjeta}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `components/home/HowItWorks.tsx`**

```tsx
'use client'

import { motion } from 'motion/react'
import { howItWorks } from '@/lib/home/content'

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-[#F4F7FB] px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">Cómo funciona</h2>
      </div>

      <div className="relative mx-auto mt-16 max-w-5xl">
        <svg
          aria-hidden="true"
          className="absolute left-0 top-6 hidden h-1 w-full md:block"
          viewBox="0 0 1000 4"
          preserveAspectRatio="none"
        >
          <motion.line
            x1="0"
            y1="2"
            x2="1000"
            y2="2"
            stroke="#00B8F5"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          />
        </svg>

        <ol className="grid gap-10 md:grid-cols-5">
          {howItWorks.pasos.map((paso, index) => (
            <motion.li
              key={paso}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.15 }}
              className="relative flex flex-col items-center text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1455E6] font-heading text-lg font-semibold text-white">
                {index + 1}
              </span>
              <p className="mt-4 text-sm text-[#48556A]">{paso}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/ProblemSection.tsx components/home/HowItWorks.tsx
git commit -m "feat: add Home problem section and how-it-works"
```

---

### Task 7: Features + BenefitsAccordion

**Files:**
- Create: `components/home/Features.tsx`
- Create: `components/home/BenefitsAccordion.tsx`

**Interfaces:**
- Consumes: `features`, `benefits` from `lib/home/content.ts` (Task 1); `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `components/ui/accordion.tsx` (Task 3).
- Produces: `Features()`, `BenefitsAccordion()` — imported by `HomeClientShell.tsx` in Task 13. `BenefitsAccordion` renders `<section id="beneficios">`, the scroll target used by the Header's "Soluciones" link (Task 4).

- [ ] **Step 1: Create `components/home/Features.tsx`**

```tsx
import {
  Activity,
  Tags,
  Map,
  Bell,
  ClipboardList,
  Megaphone,
  Users,
  TrendingUp,
  FileBarChart,
  Plug,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react'
import { features } from '@/lib/home/content'

const icons = [
  Activity,
  Tags,
  Map,
  Bell,
  ClipboardList,
  Megaphone,
  Users,
  TrendingUp,
  FileBarChart,
  Plug,
  ShieldCheck,
  ClipboardCheck,
]

export function Features() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{features.titulo}</h2>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.tarjetas.map((tarjeta, index) => {
          const Icon = icons[index % icons.length]
          return (
            <div key={tarjeta} className="flex items-center gap-3 rounded-2xl border border-[#48556A]/10 bg-[#F4F7FB] p-5">
              <Icon className="h-5 w-5 shrink-0 text-[#00B8F5]" aria-hidden="true" />
              <p className="text-sm font-medium text-[#101827]">{tarjeta}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `components/home/BenefitsAccordion.tsx`**

```tsx
'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { benefits } from '@/lib/home/content'

export function BenefitsAccordion() {
  return (
    <section id="beneficios" className="bg-[#F4F7FB] px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">Beneficios por perfil</h2>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <Accordion type="single" collapsible defaultValue={benefits[0].rol}>
          {benefits.map((grupo) => (
            <AccordionItem key={grupo.rol} value={grupo.rol}>
              <AccordionTrigger className="font-heading text-lg text-[#101827]">{grupo.rol}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-[#48556A]">
                  {grupo.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/Features.tsx components/home/BenefitsAccordion.tsx
git commit -m "feat: add Home features grid and benefits accordion"
```

---

### Task 8: UseCases + PlatformShowcase

**Files:**
- Create: `components/home/UseCases.tsx`
- Create: `components/home/PlatformShowcase.tsx`

**Interfaces:**
- Consumes: `useCases`, `platformShowcase` from `lib/home/content.ts` (Task 1).
- Produces: `UseCases()`, `PlatformShowcase()` — imported by `HomeClientShell.tsx` in Task 13. `PlatformShowcase` renders `<section id="plataforma">` (Header's "Plataforma" link target, Task 4) and its CTA anchors to `#cierre` (the `ClosingCta` section id, produced in Task 11).

- [ ] **Step 1: Create `components/home/UseCases.tsx`**

```tsx
import { useCases } from '@/lib/home/content'

export function UseCases() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">Casos de uso</h2>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-2">
        {useCases.map((caso) => (
          <div key={caso.titulo} className="rounded-2xl border border-[#48556A]/10 p-6">
            <h3 className="font-heading text-lg font-semibold text-[#101827]">{caso.titulo}</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="font-medium text-[#1455E6]">Señal</dt>
                <dd className="text-[#48556A]">{caso.senal}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1455E6]">Datos</dt>
                <dd className="text-[#48556A]">{caso.datos}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1455E6]">Acción</dt>
                <dd className="text-[#48556A]">{caso.accion}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1455E6]">Resultado</dt>
                <dd className="text-[#48556A]">{caso.resultado}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#48556A]/70">Limitaciones</dt>
                <dd className="text-[#48556A]/70">{caso.limitaciones}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `components/home/PlatformShowcase.tsx`**

```tsx
import { platformShowcase } from '@/lib/home/content'

export function PlatformShowcase() {
  return (
    <section id="plataforma" className="bg-[#03142F] px-6 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        <div>
          <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">{platformShowcase.titulo}</h2>
          <p className="mt-6 text-lg text-white/80">{platformShowcase.texto}</p>
          <a
            href="#cierre"
            className="mt-8 inline-block rounded-full bg-[#1455E6] px-6 py-3 text-sm font-medium text-white hover:bg-[#1455E6]/90"
          >
            {platformShowcase.cta}
          </a>
        </div>

        <div
          aria-hidden="true"
          className="aspect-video rounded-2xl border border-white/10 bg-gradient-to-br from-[#1455E6]/30 via-[#00B8F5]/20 to-[#12C7B4]/20 p-6"
        >
          <div className="grid h-full grid-cols-3 gap-3">
            <div className="col-span-2 rounded-xl bg-white/5" />
            <div className="rounded-xl bg-white/5" />
            <div className="rounded-xl bg-white/5" />
            <div className="col-span-2 rounded-xl bg-white/5" />
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/UseCases.tsx components/home/PlatformShowcase.tsx
git commit -m "feat: add Home use cases and platform showcase"
```

---

### Task 9: PrivacySection + ResultsSection

**Files:**
- Create: `components/home/PrivacySection.tsx`
- Create: `components/home/ResultsSection.tsx`

**Interfaces:**
- Consumes: `privacy`, `results` from `lib/home/content.ts` (Task 1).
- Produces: `PrivacySection()`, `ResultsSection()` — imported by `HomeClientShell.tsx` in Task 13. `PrivacySection` renders `<section id="privacidad">` (Header's "Seguridad" link target, Task 4).

- [ ] **Step 1: Create `components/home/PrivacySection.tsx`**

```tsx
import { Lock } from 'lucide-react'
import { privacy } from '@/lib/home/content'

export function PrivacySection() {
  return (
    <section id="privacidad" className="bg-[#F4F7FB] px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{privacy.titulo}</h2>
        <p className="mt-4 text-sm text-[#48556A]">
          Diseñada para apoyar el cumplimiento de la Ley 21.719 de protección de datos personales.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
        {privacy.mensajes.map((mensaje) => (
          <div key={mensaje} className="flex items-center gap-3 rounded-2xl bg-white p-4">
            <Lock className="h-4 w-4 shrink-0 text-[#1455E6]" aria-hidden="true" />
            <p className="text-sm text-[#101827]">{mensaje}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `components/home/ResultsSection.tsx`**

No charting library is installed in this project (the spec's Global Constraints avoid adding one for a single demo chart) — this uses a small hand-built animated bar comparison instead.

```tsx
'use client'

import { motion } from 'motion/react'
import { results } from '@/lib/home/content'

const barras = [
  { label: 'Línea base', valor: 68, color: '#48556A' },
  { label: 'Intervención', valor: 52, color: '#00B8F5' },
  { label: 'Actual', valor: 41, color: '#38D978' },
]

export function ResultsSection() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">{results.titulo}</h2>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[#48556A]/60">
          {results.etiquetaDemo} — período de comparación: 6 meses
        </p>
      </div>

      <div className="mx-auto mt-14 flex max-w-2xl items-end justify-center gap-10">
        {barras.map((barra, index) => (
          <div key={barra.label} className="flex flex-col items-center gap-3">
            <motion.div
              initial={{ height: 0 }}
              whileInView={{ height: `${barra.valor * 2}px` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="w-16 rounded-t-lg"
              style={{ backgroundColor: barra.color }}
            />
            <p className="font-heading text-lg font-semibold text-[#101827] [font-variant-numeric:tabular-nums]">
              {barra.valor}
            </p>
            <p className="text-xs text-[#48556A]">{barra.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/PrivacySection.tsx components/home/ResultsSection.tsx
git commit -m "feat: add Home privacy section and results section"
```

---

### Task 10: ImpactCalculator

**Files:**
- Create: `components/home/ImpactCalculator.tsx`

**Interfaces:**
- Consumes: `calcularImpacto`, `ImpactCalculatorInput` from `lib/home/impactCalculator.ts` (Task 2); `Input` from `components/ui/input.tsx`, `Label` from `components/ui/label.tsx` (Task 3).
- Produces: `ImpactCalculator()` (no props) — imported by `HomeClientShell.tsx` in Task 13.

- [ ] **Step 1: Create `components/home/ImpactCalculator.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calcularImpacto, type ImpactCalculatorInput } from '@/lib/home/impactCalculator'

const defaultInput: ImpactCalculatorInput = {
  dotacion: 200,
  diasAusencia: 500,
  costoPromedioDiario: 40000,
  horasExtra: 2000000,
  reemplazos: 1500000,
  costosAdministrativos: 800000,
  mejoraHipotetica: 0.15,
}

const campos: Array<{ key: keyof ImpactCalculatorInput; label: string; step?: string }> = [
  { key: 'dotacion', label: 'Dotación' },
  { key: 'diasAusencia', label: 'Días de ausencia (período)' },
  { key: 'costoPromedioDiario', label: 'Costo promedio diario ($)' },
  { key: 'horasExtra', label: 'Horas extra ($ total)' },
  { key: 'reemplazos', label: 'Reemplazos ($ total)' },
  { key: 'costosAdministrativos', label: 'Costos administrativos ($ total)' },
  { key: 'mejoraHipotetica', label: 'Mejora hipotética (%, ej. 15)', step: '0.01' },
]

function formatCLP(valor: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(valor)
}

export function ImpactCalculator() {
  const [input, setInput] = useState<ImpactCalculatorInput>(defaultInput)

  const resultado = useMemo(() => calcularImpacto(input), [input])

  function handleChange(key: keyof ImpactCalculatorInput, raw: string) {
    const valor = Number(raw)
    const parsed = Number.isFinite(valor) ? valor : 0
    setInput((prev) => ({
      ...prev,
      [key]: key === 'mejoraHipotetica' ? parsed / 100 : parsed,
    }))
  }

  return (
    <section className="bg-[#F4F7FB] px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">Calculadora de impacto</h2>
        <p className="mt-4 text-sm text-[#48556A]">Estimación basada en tus supuestos, no un ahorro garantizado.</p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-10 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {campos.map((campo) => (
            <div key={campo.key}>
              <Label htmlFor={campo.key} className="text-sm text-[#48556A]">
                {campo.label}
              </Label>
              <Input
                id={campo.key}
                type="number"
                min={0}
                step={campo.step}
                value={campo.key === 'mejoraHipotetica' ? input.mejoraHipotetica * 100 : input[campo.key]}
                onChange={(event) => handleChange(campo.key, event.target.value)}
                className="mt-1 bg-white"
              />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#48556A]/10 bg-white p-6">
          <p className="text-sm text-[#48556A]">Costo actual estimado</p>
          <p className="font-heading text-3xl font-bold text-[#101827] [font-variant-numeric:tabular-nums]">
            {formatCLP(resultado.costoActual)}
          </p>

          <div className="mt-6 space-y-3">
            {resultado.escenarios.map((escenario) => (
              <div key={escenario.nombre} className="flex items-center justify-between rounded-xl bg-[#F4F7FB] px-4 py-3">
                <span className="text-sm capitalize text-[#101827]">{escenario.nombre}</span>
                <span className="font-heading text-sm font-semibold text-[#38D978] [font-variant-numeric:tabular-nums]">
                  {formatCLP(escenario.ahorroEstimado)}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-6 rounded-xl bg-[#F4F7FB] p-4 text-xs text-[#48556A]">
            Fórmula: costo actual = días de ausencia × costo promedio diario + horas extra + reemplazos + costos
            administrativos. Ahorro estimado por escenario = costo actual × mejora hipotética × factor del escenario
            (conservador ×0.5, moderado ×1.0, alto ×1.5).
          </p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/ImpactCalculator.tsx
git commit -m "feat: add Home impact calculator"
```

---

### Task 11: Faq + ClosingCta

**Files:**
- Create: `components/home/Faq.tsx`
- Create: `components/home/ClosingCta.tsx`

**Interfaces:**
- Consumes: `faq`, `closing` from `lib/home/content.ts` (Task 1); `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `components/ui/accordion.tsx` (Task 3); `Button` from `components/ui/button.tsx`.
- Produces: `Faq()`, `ClosingCta({ onOpenDemo }: { onOpenDemo: () => void })` — imported by `HomeClientShell.tsx` in Task 13. `ClosingCta` renders `<section id="cierre">`, the anchor target used by `PlatformShowcase`'s CTA (Task 8).

- [ ] **Step 1: Create `components/home/Faq.tsx`**

```tsx
'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { faq } from '@/lib/home/content'

export function Faq() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold text-[#101827] md:text-4xl">Preguntas frecuentes</h2>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <Accordion type="single" collapsible>
          {faq.map((entry, index) => (
            <AccordionItem key={entry.pregunta} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-[#101827]">{entry.pregunta}</AccordionTrigger>
              <AccordionContent className="text-[#48556A]">{entry.respuesta}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `components/home/ClosingCta.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { closing } from '@/lib/home/content'

interface ClosingCtaProps {
  onOpenDemo: () => void
}

export function ClosingCta({ onOpenDemo }: ClosingCtaProps) {
  return (
    <section id="cierre" className="bg-[#03142F] px-6 py-24 text-center">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">{closing.titulo}</h2>
        <p className="mt-6 text-lg text-white/80">{closing.texto}</p>
        <Button onClick={onOpenDemo} size="lg" className="mt-8 rounded-full bg-[#1455E6] px-8 text-white hover:bg-[#1455E6]/90">
          {closing.cta}
        </Button>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/Faq.tsx components/home/ClosingCta.tsx
git commit -m "feat: add Home FAQ and closing CTA"
```

---

### Task 12: DemoRequestSheet + login stub

**Files:**
- Create: `components/home/DemoRequestSheet.tsx`
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` from `components/ui/sheet.tsx`; `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` from `components/ui/form.tsx`; `Input` from `components/ui/input.tsx` (all Task 3); `Button` from `components/ui/button.tsx`; `createClient` from `lib/supabase/client.ts` (already in the scaffold, targets the `demo_requests` table created in Task 3).
- Produces: `DemoRequestSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void })` — imported by `HomeClientShell.tsx` in Task 13, which owns the `open` state and passes it down alongside the `onOpenDemo` callbacks given to `Header`, `Hero`, and `ClosingCta`.

- [ ] **Step 1: Create `components/home/DemoRequestSheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

const demoSchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  empresa: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido'),
  telefono: z.string().optional(),
  cargo: z.string().optional(),
})

type DemoFormValues = z.infer<typeof demoSchema>

interface DemoRequestSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DemoRequestSheet({ open, onOpenChange }: DemoRequestSheetProps) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const form = useForm<DemoFormValues>({
    resolver: zodResolver(demoSchema),
    defaultValues: { nombre: '', empresa: '', email: '', telefono: '', cargo: '' },
  })

  async function onSubmit(values: DemoFormValues) {
    setStatus('idle')
    const supabase = createClient()
    const { error } = await supabase.from('demo_requests').insert({
      nombre: values.nombre,
      empresa: values.empresa,
      email: values.email,
      telefono: values.telefono || null,
      cargo: values.cargo || null,
    })

    if (error) {
      setStatus('error')
      return
    }

    setStatus('success')
    form.reset()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Solicitar demostración</SheetTitle>
          <SheetDescription>Cuéntanos quién eres y te contactaremos para coordinar una demostración.</SheetDescription>
        </SheetHeader>

        {status === 'success' ? (
          <p className="px-4 py-6 text-sm text-[#38D978]">Gracias, te contactaremos pronto.</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 py-6">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="empresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {status === 'error' && <p className="text-sm text-red-500">No pudimos enviar tu solicitud. Intenta de nuevo.</p>}

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full rounded-full bg-[#1455E6] hover:bg-[#1455E6]/90"
              >
                {form.formState.isSubmitting ? 'Enviando…' : 'Enviar solicitud'}
              </Button>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Create `app/login/page.tsx`**

```tsx
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#03142F] px-6 text-center">
      <Image src="/logo.png" alt="HealthScope" width={64} height={64} className="rounded" />
      <h1 className="font-heading text-2xl font-semibold text-white">Plataforma en construcción</h1>
      <p className="max-w-sm text-sm text-white/70">
        La plataforma privada de HealthScope todavía no está disponible. Vuelve pronto.
      </p>
      <Link href="/" className="text-sm text-[#00B8F5] hover:underline">
        Volver al inicio
      </Link>
    </main>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/DemoRequestSheet.tsx app/login/page.tsx
git commit -m "feat: add demo request form and login stub"
```

---

### Task 13: Assemble the Home page

**Files:**
- Create: `components/home/HomeClientShell.tsx`
- Modify (rewrite): `app/page.tsx`

**Interfaces:**
- Consumes: every component produced in Tasks 4–12 (`Header`, `Footer`, `Hero`, `TrustStrip`, `ProblemSection`, `HowItWorks`, `Features`, `BenefitsAccordion`, `UseCases`, `PlatformShowcase`, `PrivacySection`, `ResultsSection`, `ImpactCalculator`, `Faq`, `ClosingCta`, `DemoRequestSheet`) and `seo` from `lib/home/content.ts` (Task 1).
- Produces: the rendered `/` route.

`app/page.tsx` must stay a server component so it can export `metadata` — the demo-sheet `open` state (needed by three different CTAs across the page) lives in a separate client component, `HomeClientShell`, instead.

- [ ] **Step 1: Create `components/home/HomeClientShell.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Header } from '@/components/home/Header'
import { Hero } from '@/components/home/Hero'
import { TrustStrip } from '@/components/home/TrustStrip'
import { ProblemSection } from '@/components/home/ProblemSection'
import { HowItWorks } from '@/components/home/HowItWorks'
import { Features } from '@/components/home/Features'
import { BenefitsAccordion } from '@/components/home/BenefitsAccordion'
import { UseCases } from '@/components/home/UseCases'
import { PlatformShowcase } from '@/components/home/PlatformShowcase'
import { PrivacySection } from '@/components/home/PrivacySection'
import { ResultsSection } from '@/components/home/ResultsSection'
import { ImpactCalculator } from '@/components/home/ImpactCalculator'
import { Faq } from '@/components/home/Faq'
import { ClosingCta } from '@/components/home/ClosingCta'
import { Footer } from '@/components/home/Footer'
import { DemoRequestSheet } from '@/components/home/DemoRequestSheet'

export function HomeClientShell() {
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <>
      <Header onOpenDemo={() => setDemoOpen(true)} />
      <main>
        <Hero onOpenDemo={() => setDemoOpen(true)} />
        <TrustStrip />
        <ProblemSection />
        <HowItWorks />
        <Features />
        <BenefitsAccordion />
        <UseCases />
        <PlatformShowcase />
        <PrivacySection />
        <ResultsSection />
        <ImpactCalculator />
        <Faq />
        <ClosingCta onOpenDemo={() => setDemoOpen(true)} />
      </main>
      <Footer />
      <DemoRequestSheet open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  )
}
```

- [ ] **Step 2: Rewrite `app/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { HomeClientShell } from '@/components/home/HomeClientShell'
import { seo } from '@/lib/home/content'

export const metadata: Metadata = {
  title: seo.title,
  description: seo.description,
}

export default function Home() {
  return <HomeClientShell />
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Run the dev server and smoke-test**

Run: `NODE_OPTIONS="--max-old-space-size=4096" npm run dev`, open `http://localhost:3000`.
Expected: the Home page renders top to bottom without console errors, the header switches from transparent to navy on scroll, and clicking any "Solicitar demostración" button opens the Sheet.

- [ ] **Step 5: Commit**

```bash
git add components/home/HomeClientShell.tsx app/page.tsx
git commit -m "feat: assemble the HealthScope Home page"
```

---

### Task 14: Final verification (controller — requires the authenticated browser)

This task is not delegable to an implementer subagent: it needs the browser session already authenticated to `healthscope-platform`, and the controller's own judgment reviewing the rendered page.

- [ ] **Step 1: Full check suite**

```bash
cd "C:\Users\Jose\Projects\healthscope"
npx tsc --noEmit -p .
npx vitest run
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```
Expected: all three succeed with no errors.

- [ ] **Step 2: Browser walkthrough**

With `npm run dev` running, in Chrome:
- Scroll through all 14 sections in order; confirm no layout breaks or missing content.
- Expand/collapse the "Beneficios por perfil" and "Preguntas frecuentes" accordions.
- Change values in the impact calculator; confirm the displayed formula's numbers match the on-screen result.
- Submit the demo form with a test entry; confirm the success message appears.
- Open the Supabase Table Editor for `demo_requests` (`https://supabase.com/dashboard/project/jjnrrkwydpsetugxtgea/editor`) and confirm the test row is there with the correct values. Delete the test row afterward.
- Resize to a mobile width (375px) and confirm the page remains usable (header, hero, cards, accordions, calculator, form all readable and usable).
- Confirm the header switches from transparent to solid navy on scroll.
- Confirm "Recursos" in the header shows a "Próximamente" tooltip and doesn't navigate; confirm "Ingresar" goes to `/login` and shows the stub page.
- Tab through the page with the keyboard only; confirm focus is visible at every interactive element, including inside the demo Sheet and the accordions.

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## Execution Handoff

Before starting: confirm with the user whether to work directly on `main` (recommended, see File Structure note) or set up a worktree/branch first — this repo currently has no branch other than `main` and `subagent-driven-development` will not start on `main` without explicit consent.

Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task above, task review after each, broad review at the end. Tasks 3 (step 5) and 14 stay with the controller since they need the authenticated browser.

**2. Inline Execution** — execute the 14 tasks in this session using `superpowers:executing-plans`, with checkpoints for review.

Which approach?
