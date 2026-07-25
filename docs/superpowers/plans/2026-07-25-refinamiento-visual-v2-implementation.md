# Refinamiento Visual v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 4 findings from the design audit (missing chart legends, too-similar comparison colors, generic body typography, no real accent color) on top of the already-shipped visual redesign.

**Architecture:** Two independent, small changes: (1) a token/font swap in `app/globals.css` + `app/layout.tsx`, (2) adding `ChartLegend` to the two chart components that render two-series comparisons. No new components, no new dependencies.

**Tech Stack:** Next.js 16 App Router, `next/headers` `next/font/google`, Tailwind v4, `recharts` (already installed).

## Global Constraints

- `--chart-2` changes from `#00b8f5` (cián) to `#7c3aed` (morado, the same value already used for `--chart-5`) — reuses an already-approved brand color, introduces no new hex value.
- `--chart-5` is unchanged (`#7c3aed`) — having two chart tokens share the same value is intentional and fine; no chart in this project currently uses both `--chart-2` and `--chart-5` in the same view.
- `--font-heading` (Sora) is UNCHANGED — do not touch it, in any file.
- Only `--font-sans` (body text) changes, from Inter to Source Sans 3.
- **Critical technical constraint, already solved once in this project (see `docs/superpowers/plans/2026-07-16-home-page-implementation.md:135`):** Tailwind v4's `@theme inline` block resolves at build/parse time, but `next/font/google`'s generated CSS variables (`--font-sora`, `--font-inter`) are injected at runtime via the `className` on `<html>`. Referencing `var(--font-inter)` inside `@theme inline` would silently break the font. The correct pattern — already used for both fonts in this file — is a literal quoted font-family string (`"Source Sans 3"`, `"Source Sans 3 Fallback"`) matching the `@font-face` that `next/font/google` generates internally. Follow this exact pattern for the new font; do not "fix" it to use `var(...)`.
- `.dark` block in `app/globals.css` remains untouched (unreachable — no `ThemeProvider` exists in this app).
- No automated tests for any change in this plan — pure CSS tokens and chart presentation, matching this project's established pattern.

---

### Task 1: Recolor comparison charts + swap body typography

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks — Task 2 does not depend on this task's font/color change (the chart components already reference `var(--chart-2)`/`var(--color-...)` by name, so this token change takes effect for them automatically once merged, without any code change in the chart components themselves).

- [ ] **Step 1: Change `--chart-2` in `app/globals.css`**

Replace:

```css
  --chart-2: #00b8f5;
```

with:

```css
  --chart-2: #7c3aed;
```

(This line is inside the `:root` block. Do NOT touch the second `--chart-2: oklch(0.556 0 0);` line that appears later in the file inside the `.dark` block — that block is explicitly out of scope.)

- [ ] **Step 2: Swap the body font import in `app/layout.tsx`**

Replace:

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
```

with:

```tsx
import type { Metadata } from "next";
import { Sora, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});
```

Then replace the `className` on the `<html>` element — replace:

```tsx
    <html
      lang="es"
      className={`${sora.variable} ${inter.variable} h-full antialiased`}
    >
```

with:

```tsx
    <html
      lang="es"
      className={`${sora.variable} ${sourceSans3.variable} h-full antialiased`}
    >
```

- [ ] **Step 3: Update `--font-sans` in `app/globals.css`**

Replace:

```css
  --font-sans: "Inter", "Inter Fallback", ui-sans-serif, system-ui, sans-serif;
```

with:

```css
  --font-sans: "Source Sans 3", "Source Sans 3 Fallback", ui-sans-serif, system-ui, sans-serif;
```

(This line is inside the `@theme inline` block near the top of the file, alongside `--font-heading`. Do not modify the `--font-heading` line — Sora is unchanged.)

- [ ] **Step 4: Type-check and build**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds with no errors. (A successful build with no missing-font warnings confirms `Source_Sans_3` is a valid `next/font/google` export name and loaded correctly — if the import name were wrong, the build would fail here, not silently.)

- [ ] **Step 5: Run the full test suite (regression check — this task adds no new tests)**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass (116 tests as of the last module shipped).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: recolor comparison charts to purple and swap body font to Source Sans 3"
```

---

### Task 2: Add legends to the two-series chart components

**Files:**
- Modify: `components/platform/dashboard/IndicadorMiniChart.tsx`
- Modify: `components/platform/charts/GraficoAntesDespues.tsx`

**Interfaces:**
- Consumes: `ChartLegend`, `ChartLegendContent` from `components/ui/chart.tsx` (already exported by that file, added in the original visual redesign — not modified by this plan).
- Produces: nothing consumed by other tasks — this is the last task in the plan.

`components/platform/bienestar/GraficoBienestar.tsx` is deliberately NOT touched — it renders a single data series (one bar per survey question, all the same color), so there is no color-to-meaning ambiguity for a legend to resolve.

- [ ] **Step 1: Add a legend to `IndicadorMiniChart.tsx`**

Replace the full content of `components/platform/dashboard/IndicadorMiniChart.tsx`:

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

with:

```tsx
'use client'

import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart'

const chartConfig = {
  actual: { label: 'Actual', color: 'var(--chart-1)' },
  base: { label: 'Línea base', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function IndicadorMiniChart({ actual, base }: { actual: number; base: number | null }) {
  const data = base === null ? [{ nombre: 'valor', actual }] : [{ nombre: 'valor', actual, base }]

  return (
    <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-[76px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nombre" hide />
        <Bar dataKey="actual" fill="var(--color-actual)" radius={4} barSize={14} />
        {base !== null ? <Bar dataKey="base" fill="var(--color-base)" radius={4} barSize={14} /> : null}
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}
```

(The container height increases from `h-[56px]` to `h-[76px]` to make room for the legend row below the bars — without this, the legend would be visually cramped against the chart.)

- [ ] **Step 2: Add a legend to `GraficoAntesDespues.tsx`**

Replace the full content of `components/platform/charts/GraficoAntesDespues.tsx`:

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

with:

```tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

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
    <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="nombre" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="antes" fill="var(--color-antes)" radius={4} />
        <Bar dataKey="despues" fill="var(--color-despues)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

(Height increases from `h-[180px]` to `h-[200px]` for the same reason as Step 1.)

- [ ] **Step 3: Type-check**

Run: `NODE_OPTIONS="--max-old-space-size=768" ./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 4: Run the full test suite**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 5: Build check (final)**

Run: `NODE_OPTIONS="--max-old-space-size=768" npx next build`
Expected: build succeeds, same route count as before (only internal component rendering changed).

- [ ] **Step 6: Commit**

```bash
git add components/platform/dashboard/IndicadorMiniChart.tsx components/platform/charts/GraficoAntesDespues.tsx
git commit -m "feat: add legends to IndicadorMiniChart and GraficoAntesDespues"
```

---

## Task 3: Manual verification (controller-only, deferred)

Not a code task. Left here for whoever can view the deployed site.

- [ ] Confirm the body text visually renders in Source Sans 3, not a system-font fallback (compare letterforms against Google Fonts' own Source Sans 3 specimen, or inspect computed `font-family` in devtools).
- [ ] Confirm the "Línea base" / "Después" bars now render in purple, clearly distinct from the blue "Actual" / "Antes" bars.
- [ ] Confirm legends are visible and readable under each of the 3 chart types (Resumen mini-charts, Bienestar — no legend expected there, Campañas/Intervenciones antes-después charts).
