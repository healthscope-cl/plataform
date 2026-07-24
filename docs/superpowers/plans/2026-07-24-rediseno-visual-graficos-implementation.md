# Rediseño Visual y Gráficos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the HealthScope brand palette to the internal platform's theme tokens, and add real Recharts-based visualizations to the highest-traffic dashboards (Resumen, Bienestar, Campañas/Intervenciones), replacing number-only cards with actual charts.

**Architecture:** shadcn/ui's official `ChartContainer` primitive (backed by `recharts`) reads color from CSS custom properties (`--chart-1`..`--chart-5`), so retheming `app/globals.css` and building charts are one coherent system — no chart hardcodes a color. Each chart is a small, focused Client Component that receives already-computed data as props; no chart recalculates anything.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui (`base-nova`), `recharts` (new dependency).

## Global Constraints

- Brand palette values (exact hex, lifted verbatim from `components/home/*.tsx`, already in production on the public marketing site): navy `#03142F`, azul eléctrico `#1455E6`, cián `#00B8F5`, turquesa `#12C7B4`, texto oscuro `#101827`, texto secundario `#48556A`, fondo claro `#F4F7FB`, verde éxito `#38D978` (already the value of `--success`, no change needed there).
- One color is genuinely new: `#7C3AED` (morado), used only as `--chart-5` — the document's section 12 asks for "morado como acento secundario" and it has never been implemented anywhere in this project until now.
- Only the `:root` (light theme) block in `app/globals.css` changes. The `.dark` block is explicitly out of scope — no `ThemeProvider` or theme toggle exists anywhere in `app/` (confirmed by grep), so it is unreachable dead code; do not touch it.
- No chart in this plan shows a fabricated value for suppressed/missing data. A suppressed or absent data point must render a "sin datos suficientes" (or equivalent) message instead of the chart — never a zero-value bar presented as real.
- No chart recalculates business logic — every chart receives numbers already computed by existing `lib/` functions (`computeIndicadores`, `agregarRespuestas`, `medirAntesDespues`) as props.
- No automated tests for chart components themselves (presentational, matches this project's established no-page-test convention). The one genuinely pure, testable unit in this plan (`resultadoMedicionAValor`) DOES get a real Vitest test (TDD) — it's a plain data transform, not a component.
- Time-trend charts (a line rising/falling month over month) are explicitly out of scope — this project has no periodic historical snapshot storage today, only a live current-period calculation plus one optional saved "línea base" comparison point.

---

### Task 1: Dependency, chart primitive, and brand theme

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)
- Create: `components/ui/chart.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing from earlier tasks (this is the foundational task).
- Produces: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `type ChartConfig` from `components/ui/chart.tsx` — consumed by every later task's chart components. The retheme tokens in `app/globals.css` — consumed visually by every later task (charts read `--chart-1`..`--chart-5` directly; the rest of the app already reads `--primary`/`--secondary`/etc. via existing Tailwind classes, so no other file needs to change for the retheme to take visual effect).

- [ ] **Step 1: Install recharts**

Run: `npm install recharts`
Expected: `package.json` gains a `"recharts": "^3.8.0"` (or newer patch/minor within `^3.8.0`) dependency; `package-lock.json` updates; no errors.

- [ ] **Step 2: Add the shadcn/ui chart primitive**

Create `components/ui/chart.tsx` with this exact content (this is the standard shadcn/ui chart wrapper, verified working with this project's installed `recharts` version and `base-nova` style — do not modify it):

```tsx
"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import type { TooltipValueType } from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

const INITIAL_DIMENSION = { width: 320, height: 200 } as const
type TooltipNameType = number | string

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  initialDimension = INITIAL_DIMENSION,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"]
  initialDimension?: {
    width: number
    height: number
  }
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer
          initialDimension={initialDimension}
        >
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme ?? config.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ??
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
  } & Omit<
    RechartsPrimitive.DefaultTooltipContentProps<
      TooltipValueType,
      TooltipNameType
    >,
    "accessibilityLayer"
  >) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null
    }

    const [item] = payload
    const key = `${labelKey ?? item?.dataKey ?? item?.name ?? "value"}`
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value =
      !labelKey && typeof label === "string"
        ? (config[label]?.label ?? label)
        : itemConfig?.label

    if (labelFormatter) {
      return (
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      )
    }

    if (!value) {
      return null
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ])

  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== "dot"

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.type !== "none")
          .map((item, index) => {
            const key = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color ?? item.payload?.fill ?? item.color

            return (
              <div
                key={index}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                            {
                              "h-2.5 w-2.5": indicator === "dot",
                              "w-1": indicator === "line",
                              "w-0 border-[1.5px] border-dashed bg-transparent":
                                indicator === "dashed",
                              "my-0.5": nestLabel && indicator === "dashed",
                            }
                          )}
                          style={
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label ?? item.name}
                        </span>
                      </div>
                      {item.value != null && (
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {typeof item.value === "number"
                            ? item.value.toLocaleString()
                            : String(item.value)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: React.ComponentProps<"div"> & {
  hideIcon?: boolean
  nameKey?: string
} & RechartsPrimitive.DefaultLegendContentProps) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item, index) => {
          const key = `${nameKey ?? item.dataKey ?? "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
    </div>
  )
}

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string
  }

  return configLabelKey in config ? config[configLabelKey] : config[key]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
```

- [ ] **Step 3: Retheme `app/globals.css`**

In `app/globals.css`, replace the entire `:root { ... }` block:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --success: oklch(0.6 0.19 145);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}
```

with:

```css
:root {
  --background: #ffffff;
  --foreground: #101827;
  --card: #ffffff;
  --card-foreground: #101827;
  --popover: #ffffff;
  --popover-foreground: #101827;
  --primary: #1455e6;
  --primary-foreground: #ffffff;
  --secondary: #f4f7fb;
  --secondary-foreground: #101827;
  --muted: #f4f7fb;
  --muted-foreground: #48556a;
  --accent: #e6f4fe;
  --accent-foreground: #101827;
  --destructive: oklch(0.577 0.245 27.325);
  --success: oklch(0.6 0.19 145);
  --border: #d8dee8;
  --input: #d8dee8;
  --ring: #1455e6;
  --chart-1: #1455e6;
  --chart-2: #00b8f5;
  --chart-3: #12c7b4;
  --chart-4: #3d5a80;
  --chart-5: #7c3aed;
  --radius: 0.625rem;
  --sidebar: #03142f;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #1455e6;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #00b8f5;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: #1b2c4a;
  --sidebar-ring: #1b2c4a;
}
```

(`--destructive` and `--success` are unchanged — they already have real color, not grayscale, and the spec does not ask to change them. The `.dark` block immediately below `:root` in the same file is untouched — leave it exactly as-is.)

- [ ] **Step 4: Type-check and build**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Run the full test suite (regression check — this task adds no new tests)**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass (112 tests as of the last module shipped).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/ui/chart.tsx app/globals.css
git commit -m "feat: add recharts, shadcn chart primitive, and brand color theme"
```

---

### Task 2: `resultadoMedicionAValor` helper + shared `GraficoAntesDespues` chart

**Files:**
- Modify: `lib/campanas/medicion.ts`
- Modify: `lib/campanas/medicion.test.ts`
- Create: `components/platform/charts/GraficoAntesDespues.tsx`

**Interfaces:**
- Consumes: `ChartContainer`, `ChartConfig` from Task 1's `components/ui/chart.tsx`. Existing `ResultadoMedicion` type (unchanged) from `lib/campanas/medicion.ts`.
- Produces: `resultadoMedicionAValor(resultado: ResultadoMedicion | null): number | null` — a pure function, exported from `lib/campanas/medicion.ts`, used by Task 5. `GraficoAntesDespues({ antes: number; despues: number; unidad?: string }): JSX.Element` — a presentational Client Component, used by Task 5.

Two different pages (`campanas/[id]` and `intervenciones/[id]`) both already call `medirAntesDespues()` and get back `{ antes: ResultadoMedicion; despues: ResultadoMedicion | null }`. Both pages need to turn that into "should I show a chart, or a text fallback message" — this task builds the one shared conversion function both pages will use, and the one shared chart component both will render. The chart component itself stays deliberately dumb: it takes two plain numbers, nothing about `ResultadoMedicion`'s suppressed/no-data states — that decision (chart vs. text message) is made by the page, using `resultadoMedicionAValor`, exactly where the existing text-fallback logic already lives.

- [ ] **Step 1: Write the failing tests for `resultadoMedicionAValor`**

Add to `lib/campanas/medicion.test.ts` (append a new `describe` block; keep the existing `medirAntesDespues` tests untouched):

```ts
import { medirAntesDespues, resultadoMedicionAValor } from './medicion'

describe('resultadoMedicionAValor', () => {
  it('devuelve el promedio cuando el resultado tiene datos', () => {
    expect(resultadoMedicionAValor({ promedio: 3.5, cantidad: 8 })).toBe(3.5)
  })

  it('devuelve null cuando el resultado está suprimido', () => {
    expect(resultadoMedicionAValor({ suprimido: true })).toBeNull()
  })

  it('devuelve null cuando no hay datos', () => {
    expect(resultadoMedicionAValor({ sinDatos: true })).toBeNull()
  })

  it('devuelve null cuando el resultado es null', () => {
    expect(resultadoMedicionAValor(null)).toBeNull()
  })
})
```

(The existing `import { medirAntesDespues } from './medicion'` line at the top of the file must be updated to also import `resultadoMedicionAValor`, as shown above — do not add a second, duplicate import line.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run lib/campanas/medicion.test.ts`
Expected: FAIL — `resultadoMedicionAValor` is not exported yet.

- [ ] **Step 3: Implement `resultadoMedicionAValor`**

Add to `lib/campanas/medicion.ts` (after the existing `medirAntesDespues` function, before `calcular`):

```ts
export function resultadoMedicionAValor(resultado: ResultadoMedicion | null): number | null {
  if (resultado === null) return null
  if ('suprimido' in resultado) return null
  if ('sinDatos' in resultado) return null
  return resultado.promedio
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run lib/campanas/medicion.test.ts`
Expected: PASS, all tests including the 4 new ones.

- [ ] **Step 5: Write the shared chart component**

Create `components/platform/charts/GraficoAntesDespues.tsx`:

```tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

const chartConfig = {
  antes: { label: 'Antes', color: 'var(--chart-1)' },
  despues: { label: 'Después', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function GraficoAntesDespues({
  antes,
  despues,
  unidad,
}: {
  antes: number
  despues: number
  unidad?: string
}) {
  const data = [{ nombre: unidad ?? 'Comparación', antes, despues }]

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="nombre" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="antes" fill="var(--color-antes)" radius={4} />
        <Bar dataKey="despues" fill="var(--color-despues)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 6: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 7: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all tests pass, including the 4 new ones (116 total).

- [ ] **Step 8: Commit**

```bash
git add lib/campanas/medicion.ts lib/campanas/medicion.test.ts components/platform/charts/GraficoAntesDespues.tsx
git commit -m "feat: add resultadoMedicionAValor helper and GraficoAntesDespues chart"
```

---

### Task 3: Per-indicator mini chart on the Resumen dashboard

**Files:**
- Create: `components/platform/dashboard/IndicadorMiniChart.tsx`
- Modify: `components/platform/dashboard/IndicadorCard.tsx`
- Modify: `components/platform/dashboard/ResumenInteractivo.tsx`

**Interfaces:**
- Consumes: `ChartContainer`, `ChartConfig` from Task 1's `components/ui/chart.tsx`. Existing `IndicadorValor` type from `lib/indicators/formulas.ts` (unchanged).
- Produces: nothing consumed by later tasks.

**Design note (a correction to the spec's literal wording, made during planning):** the spec describes "un gráfico de barras con los 6 indicadores... barras agrupadas." The 6 indicators (`tasaAusentismo`, `frecuencia`, `severidad`, `duracionPromedio`, `reincidencia`, `costoEstimado`) use six different units — percentages, days, and Chilean pesos in the tens or hundreds of thousands. Putting all 6 on one shared bar chart would make the percentage bars invisible next to the peso-denominated cost bar (or vice versa) — a real, silently-misleading chart, exactly what the spec's own testing rule prohibits ("nunca un gráfico... engañoso"). The correct shape for this data is one small 2-bar comparison chart (actual vs línea base) embedded **inside each indicator's own card**, where the two bars share the same unit and are directly comparable. This task builds that: `IndicadorMiniChart` is generic (it doesn't know or care which indicator it's showing — same two colors, `--chart-1` for "actual" and `--chart-2` for "línea base", reused consistently across all 6 cards), so there's no need to plumb a distinct color per indicator through `ResumenInteractivo` → `IndicadorCard`.

- [ ] **Step 1: Write the mini chart component**

Create `components/platform/dashboard/IndicadorMiniChart.tsx`:

```tsx
'use client'

import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'

const chartConfig = {
  actual: { label: 'Actual', color: 'var(--chart-1)' },
  base: { label: 'Línea base', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function IndicadorMiniChart({ actual, base }: { actual: number; base: number | null }) {
  const data = base === null ? [{ nombre: 'valor', actual }] : [{ nombre: 'valor', actual, base }]

  return (
    <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-[56px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nombre" hide />
        <Bar dataKey="actual" fill="var(--color-actual)" radius={4} barSize={14} />
        {base !== null ? <Bar dataKey="base" fill="var(--color-base)" radius={4} barSize={14} /> : null}
      </BarChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 2: Wire the mini chart into `IndicadorCard`**

In `components/platform/dashboard/IndicadorCard.tsx`, add the import:

```ts
import { IndicadorMiniChart } from './IndicadorMiniChart'
```

Add a new prop `valorBase` to the component signature — replace:

```ts
export function IndicadorCard({
  titulo,
  resultado,
  sufijo,
  etiquetaNumerador,
  etiquetaDenominador,
  cambio,
}: {
  titulo: string
  resultado: IndicadorValor
  sufijo: string
  etiquetaNumerador: string
  etiquetaDenominador: string
  cambio?: IndicadorValor | null
}) {
```

with:

```ts
export function IndicadorCard({
  titulo,
  resultado,
  sufijo,
  etiquetaNumerador,
  etiquetaDenominador,
  cambio,
  valorBase,
}: {
  titulo: string
  resultado: IndicadorValor
  sufijo: string
  etiquetaNumerador: string
  etiquetaDenominador: string
  cambio?: IndicadorValor | null
  valorBase?: number | null
}) {
```

Then render the chart right after the `DeltaBadge` — replace:

```tsx
          {cambio ? <DeltaBadge cambio={cambio} /> : null}
        </>
      )}
    </div>
  )
}
```

with:

```tsx
          {cambio ? <DeltaBadge cambio={cambio} /> : null}
          <IndicadorMiniChart actual={resultado.valor} base={valorBase ?? null} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Pass the raw línea base value from `ResumenInteractivo`**

In `components/platform/dashboard/ResumenInteractivo.tsx`, add a helper function right after the existing `valorNumerico` function — replace:

```ts
  function valorNumerico(resultado: IndicadorValor): number | null {
    return 'suprimido' in resultado ? null : resultado.valor
  }

  function cambioDe(clave: keyof IndicadorResultados): IndicadorValor | null {
```

with:

```ts
  function valorNumerico(resultado: IndicadorValor): number | null {
    return 'suprimido' in resultado ? null : resultado.valor
  }

  function valorBaseDe(clave: keyof IndicadorResultados): number | null {
    if (hayFiltroActivo || !indicadoresBase) return null
    return valorNumerico(indicadoresBase[clave])
  }

  function cambioDe(clave: keyof IndicadorResultados): IndicadorValor | null {
```

Then pass `valorBase` to each of the 6 `IndicadorCard` elements. Replace:

```tsx
        <IndicadorCard
          titulo="Tasa de ausentismo"
          resultado={resultados.tasaAusentismo}
          sufijo="%"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Días programados"
          cambio={cambioDe('tasaAusentismo')}
        />
        <IndicadorCard
          titulo="Frecuencia"
          resultado={resultados.frecuencia}
          sufijo="%"
          etiquetaNumerador="Episodios"
          etiquetaDenominador="Dotación promedio"
          cambio={cambioDe('frecuencia')}
        />
        <IndicadorCard
          titulo="Severidad"
          resultado={resultados.severidad}
          sufijo=" días/episodio"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Episodios"
          cambio={cambioDe('severidad')}
        />
        <IndicadorCard
          titulo="Duración promedio"
          resultado={resultados.duracionPromedio}
          sufijo=" días"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Episodios cerrados"
          cambio={cambioDe('duracionPromedio')}
        />
        <IndicadorCard
          titulo="Reincidencia"
          resultado={resultados.reincidencia}
          sufijo="%"
          etiquetaNumerador="Personas con 2+ episodios"
          etiquetaDenominador="Personas con 1+ episodio"
          cambio={cambioDe('reincidencia')}
        />
        <IndicadorCard
          titulo="Costo estimado"
          resultado={resultados.costoEstimado}
          sufijo="$"
          etiquetaNumerador="Costo total"
          etiquetaDenominador="—"
          cambio={cambioDe('costoEstimado')}
        />
```

with:

```tsx
        <IndicadorCard
          titulo="Tasa de ausentismo"
          resultado={resultados.tasaAusentismo}
          sufijo="%"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Días programados"
          cambio={cambioDe('tasaAusentismo')}
          valorBase={valorBaseDe('tasaAusentismo')}
        />
        <IndicadorCard
          titulo="Frecuencia"
          resultado={resultados.frecuencia}
          sufijo="%"
          etiquetaNumerador="Episodios"
          etiquetaDenominador="Dotación promedio"
          cambio={cambioDe('frecuencia')}
          valorBase={valorBaseDe('frecuencia')}
        />
        <IndicadorCard
          titulo="Severidad"
          resultado={resultados.severidad}
          sufijo=" días/episodio"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Episodios"
          cambio={cambioDe('severidad')}
          valorBase={valorBaseDe('severidad')}
        />
        <IndicadorCard
          titulo="Duración promedio"
          resultado={resultados.duracionPromedio}
          sufijo=" días"
          etiquetaNumerador="Días perdidos"
          etiquetaDenominador="Episodios cerrados"
          cambio={cambioDe('duracionPromedio')}
          valorBase={valorBaseDe('duracionPromedio')}
        />
        <IndicadorCard
          titulo="Reincidencia"
          resultado={resultados.reincidencia}
          sufijo="%"
          etiquetaNumerador="Personas con 2+ episodios"
          etiquetaDenominador="Personas con 1+ episodio"
          cambio={cambioDe('reincidencia')}
          valorBase={valorBaseDe('reincidencia')}
        />
        <IndicadorCard
          titulo="Costo estimado"
          resultado={resultados.costoEstimado}
          sufijo="$"
          etiquetaNumerador="Costo total"
          etiquetaDenominador="—"
          cambio={cambioDe('costoEstimado')}
          valorBase={valorBaseDe('costoEstimado')}
        />
```

- [ ] **Step 4: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 5: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all tests pass (116 tests — this task adds no new tests, `IndicadorCard`/`ResumenInteractivo`/`IndicadorMiniChart` are presentational).

- [ ] **Step 6: Commit**

```bash
git add components/platform/dashboard/IndicadorMiniChart.tsx components/platform/dashboard/IndicadorCard.tsx components/platform/dashboard/ResumenInteractivo.tsx
git commit -m "feat: add per-indicator mini bar chart to the Resumen dashboard"
```

---

### Task 4: Bar chart on the Bienestar Preventivo page

**Files:**
- Create: `components/platform/bienestar/GraficoBienestar.tsx`
- Modify: `app/plataforma/bienestar/page.tsx`

**Interfaces:**
- Consumes: `ChartContainer`, `ChartConfig` from Task 1's `components/ui/chart.tsx`. Existing `ResultadoPregunta` shape from `lib/encuestas/agregar.ts` (`{ promedio: number; cantidad: number } | { suprimido: true }`, unchanged).
- Produces: nothing consumed by later tasks.

Unlike the Resumen dashboard's 6 indicators, all 7 Bienestar questions share the exact same 1-5 scale — a single combined horizontal bar chart is correct here, no unit-mismatch problem.

- [ ] **Step 1: Write the chart component**

Create `components/platform/bienestar/GraficoBienestar.tsx`:

```tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

const chartConfig = {
  promedio: { label: 'Promedio', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function GraficoBienestar({ datos }: { datos: Array<{ pregunta: string; promedio: number }> }) {
  if (datos.length === 0) return null

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
      <BarChart data={datos} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" domain={[0, 5]} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="pregunta" tickLine={false} axisLine={false} width={110} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="promedio" fill="var(--color-promedio)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

- [ ] **Step 2: Wire it into the Bienestar page**

In `app/plataforma/bienestar/page.tsx`, add the import:

```ts
import { GraficoBienestar } from '@/components/platform/bienestar/GraficoBienestar'
```

Add a short-label lookup right after the existing `BIENESTAR_PREGUNTA_IDS` constant — replace:

```ts
const BIENESTAR_PREGUNTA_IDS = ['estres', 'fatiga', 'sueno', 'carga', 'liderazgo', 'conciliacion', 'clima']
```

with:

```ts
const BIENESTAR_PREGUNTA_IDS = ['estres', 'fatiga', 'sueno', 'carga', 'liderazgo', 'conciliacion', 'clima']

const LABELS_CORTOS: Record<string, string> = {
  estres: 'Estrés',
  fatiga: 'Fatiga',
  sueno: 'Sueño',
  carga: 'Carga',
  liderazgo: 'Liderazgo',
  conciliacion: 'Conciliación',
  clima: 'Clima',
}
```

Then build the chart's data array and render it above the existing card grid. Replace:

```tsx
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Bienestar preventivo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Promedio agregado de todas las encuestas de {empresa.nombre}, sin filtrar por período.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

with:

```tsx
  const datosGrafico = BIENESTAR_PREGUNTA_IDS.map((preguntaId) => {
    const resultado = resultados[preguntaId]
    return resultado && !('suprimido' in resultado)
      ? { pregunta: LABELS_CORTOS[preguntaId] ?? preguntaId, promedio: resultado.promedio }
      : null
  }).filter((item): item is { pregunta: string; promedio: number } => item !== null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Bienestar preventivo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Promedio agregado de todas las encuestas de {empresa.nombre}, sin filtrar por período.
        </p>
      </div>
      {datosGrafico.length > 0 ? (
        <GraficoBienestar datos={datosGrafico} />
      ) : (
        <p className="text-sm text-muted-foreground">Sin datos suficientes para graficar todavía.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

(Preguntas suprimidas por `MIN_GROUP_SIZE` son filtradas del arreglo `datosGrafico` — nunca se grafica un valor inventado; la tarjeta de texto de esa misma pregunta debajo del gráfico ya muestra "Grupo insuficiente para mostrar" sin cambios.)

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 4: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all tests pass (116 tests, no new ones — presentational only).

- [ ] **Step 5: Commit**

```bash
git add components/platform/bienestar/GraficoBienestar.tsx app/plataforma/bienestar/page.tsx
git commit -m "feat: add bar chart to Bienestar Preventivo page"
```

---

### Task 5: Antes/después charts on Campañas and Intervenciones detail pages

**Files:**
- Modify: `app/plataforma/campanas/[id]/page.tsx`
- Modify: `app/plataforma/intervenciones/[id]/page.tsx`

**Interfaces:**
- Consumes: `resultadoMedicionAValor` from Task 2's `lib/campanas/medicion.ts`. `GraficoAntesDespues` from Task 2's `components/platform/charts/GraficoAntesDespues.tsx`.
- Produces: nothing — this is the last task in the plan.

Both pages already compute the same two comparisons (a survey question's before/after average, and a before/after security-events count) and already render each as a pair of text-only cards. This task adds a chart alongside each pair — it does NOT remove the existing text cards (the exact numbers/counts remain valuable and are cheap to keep), it adds visual context above them.

- [ ] **Step 1: `app/plataforma/campanas/[id]/page.tsx`**

Add to the imports:

```ts
import { resultadoMedicionAValor } from '@/lib/campanas/medicion'
import { GraficoAntesDespues } from '@/components/platform/charts/GraficoAntesDespues'
```

Insert a chart above the existing "Seguimiento de encuesta" text cards. Replace:

```tsx
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de encuesta</h2>
        {seguimientoEncuesta ? (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
```

with:

```tsx
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de encuesta</h2>
        {seguimientoEncuesta &&
        resultadoMedicionAValor(seguimientoEncuesta.antes) !== null &&
        resultadoMedicionAValor(seguimientoEncuesta.despues) !== null ? (
          <div className="mt-2">
            <GraficoAntesDespues
              antes={resultadoMedicionAValor(seguimientoEncuesta.antes)!}
              despues={resultadoMedicionAValor(seguimientoEncuesta.despues)!}
              unidad={seguimientoEncuesta.pregunta}
            />
          </div>
        ) : null}
        {seguimientoEncuesta ? (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
```

Then insert a second chart above the existing "Seguimiento de seguridad" text cards. Replace:

```tsx
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de seguridad</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos antes</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{eventosAntes}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos después</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
              {eventosDespues === null ? 'La campaña todavía no tiene fecha de término' : eventosDespues}
            </p>
          </div>
        </div>
      </div>
```

with:

```tsx
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de seguridad</h2>
        {eventosDespues !== null ? (
          <div className="mt-2">
            <GraficoAntesDespues antes={eventosAntes} despues={eventosDespues} unidad="Eventos de seguridad" />
          </div>
        ) : null}
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos antes</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{eventosAntes}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos después</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
              {eventosDespues === null ? 'La campaña todavía no tiene fecha de término' : eventosDespues}
            </p>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: `app/plataforma/intervenciones/[id]/page.tsx`**

Add to the imports:

```ts
import { resultadoMedicionAValor } from '@/lib/campanas/medicion'
import { GraficoAntesDespues } from '@/components/platform/charts/GraficoAntesDespues'
```

Insert a chart above the existing "Seguimiento de encuesta" text cards. Replace:

```tsx
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de encuesta</h2>
        {seguimientoEncuesta ? (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
```

with:

```tsx
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de encuesta</h2>
        {seguimientoEncuesta &&
        resultadoMedicionAValor(seguimientoEncuesta.antes) !== null &&
        resultadoMedicionAValor(seguimientoEncuesta.despues) !== null ? (
          <div className="mt-2">
            <GraficoAntesDespues
              antes={resultadoMedicionAValor(seguimientoEncuesta.antes)!}
              despues={resultadoMedicionAValor(seguimientoEncuesta.despues)!}
              unidad={seguimientoEncuesta.pregunta}
            />
          </div>
        ) : null}
        {seguimientoEncuesta ? (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
```

Then insert a chart above the existing "Seguimiento de seguridad" text cards (note: in THIS file, unlike campañas, `eventosDespues` is always a plain `number`, never `null` — `intervencion.fecha` always has a value, so the chart can render unconditionally). Replace:

```tsx
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de seguridad</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos antes</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{eventosAntes}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos después</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{eventosDespues}</p>
          </div>
        </div>
      </div>
```

with:

```tsx
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Seguimiento de seguridad</h2>
        <div className="mt-2">
          <GraficoAntesDespues antes={eventosAntes} despues={eventosDespues} unidad="Eventos de seguridad" />
        </div>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos antes</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{eventosAntes}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Eventos después</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-foreground">{eventosDespues}</p>
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 4: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all tests pass (116 tests, no new ones).

- [ ] **Step 5: Build check (final)**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, no new routes (only existing pages' internal rendering changed).

- [ ] **Step 6: Commit**

```bash
git add app/plataforma/campanas/[id]/page.tsx app/plataforma/intervenciones/[id]/page.tsx
git commit -m "feat: add antes/después charts to campanas and intervenciones detail pages"
```

---

## Task 6: Manual verification (controller-only, deferred)

Not a code task — no subagent dispatch needed. Left here for whoever can log in with real credentials (this project's established pattern: the controller never authenticates on the user's behalf).

- [ ] Confirm the brand palette renders correctly in a real browser: navy sidebar, blue primary buttons, colored chart bars — not just correct in the CSS source.
- [ ] Confirm text contrast is comfortable to read in every retouched area (sidebar white-on-navy, muted gray-blue body text, pale accent hover backgrounds) — the token values were chosen from already-proven marketing-site pairings, but a live visual check is still worth doing before calling this final.
- [ ] Confirm each of the 3 core pages (Resumen, Bienestar, Campañas/Intervenciones detail) shows a chart that matches the numbers already shown in the surrounding text/cards — no discrepancy between what the chart shows and what the text says.
- [ ] Confirm a suppressed or missing data point (e.g. a Bienestar question below `MIN_GROUP_SIZE`, or a campaign/intervention with no end date yet) shows the existing "sin datos" text state and does NOT show a chart with a fabricated zero value.
