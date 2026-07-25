# HealthScope — Refinamiento Visual v2 (leyendas, color, tipografía)

**Fecha:** 2026-07-25
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** una auditoría profesional del rediseño visual recién desplegado (paleta de marca +
gráficos), hecha con dos skills de diseño instaladas en esta sesión — `frontend-design` (oficial
de Anthropic) y `ui-ux-pro-max` (base de datos de referencia de estilos/colores/tipografía) —
contra las cuales se encontraron 4 hallazgos concretos y verificables, no cosméticos.

## Los 4 hallazgos de la auditoría

1. **Sin leyenda en ningún gráfico.** `components/ui/chart.tsx` ya exporta `ChartLegend` /
   `ChartLegendContent`, pero `IndicadorMiniChart`, `GraficoBienestar` y `GraficoAntesDespues` no
   los usan — la única forma de saber qué representa cada color de barra es pasar el mouse sobre
   el tooltip, lo cual no es obvio ni accesible. Regla violada de `ui-ux-pro-max`:
   `legend-visible` ("Always show legend; position near the chart, not detached").
2. **Los dos colores de comparación son ambos azules.** `--chart-1` (#1455E6) y `--chart-2`
   (#00B8F5) — usados para "actual vs línea base" (Resumen) y "antes vs después" (Campañas,
   Intervenciones) — son de la misma familia de color, con poca distinción para usuarios con
   dificultad de percepción de color. Filas de referencia reales en `ui-ux-pro-max` para
   dashboards/healthcare separan las series con familias de color distintas.
3. **Tipografía de cuerpo genérica.** `--font-sans` usa Inter, explícitamente listada por la
   skill `frontend-design` de Anthropic como una de las fuentes "por defecto sobreusadas" a
   evitar para lograr una identidad distintiva.
4. **Sin color de acento/énfasis real.** `--accent` es solo un tinte pálido de hover
   (`#E6F4FE`), nunca aparece como color de énfasis o CTA — toda la interfaz vive en la misma
   familia de azul.

## Decisiones

**Color:** en vez de introducir un color cálido nuevo (el patrón más común en la base de datos de
referencia, pero significaría desviarse otra vez de "solo reusar la paleta ya aprobada"),
`--chart-2` pasa de cián (#00B8F5) a morado (#7C3AED) — reusando el valor que ya existe como
`--chart-5`. Esto resuelve los hallazgos 2 y 4 a la vez: separa mejor los pares de comparación
(azul vs morado, mucho más distinguible que azul vs cián) y le da a `--accent` un uso real de
énfasis, no solo un tinte de hover. `--chart-5` queda con el mismo valor (#7C3AED) — no hace
falta un color nuevo ahí; si en el futuro se necesita una quinta serie realmente distinta, se
puede revisar entonces.

**Tipografía:** `--font-sans` (cuerpo de texto) cambia de Inter a **Source Sans 3** — una
combinación real de la base de datos de `ui-ux-pro-max`, etiquetada explícitamente
"healthcare, accessibility-focused" ("Corporate Trust": Lexend + Source Sans 3). Se mantiene solo
la mitad de esa recomendación: `--font-heading` (Sora) **no cambia** — ya es una elección
distintiva y funcionando bien, cambiar también los títulos sería un cambio de identidad mayor sin
necesidad, dado que el problema real detectado es específicamente el cuerpo de texto.

**Leyendas:** se agrega `<ChartLegend content={<ChartLegendContent />} />` a los 3 componentes de
gráfico existentes (sin crear ninguno nuevo). Etiquetas exactas: "Actual" / "Línea base" en
`IndicadorMiniChart`; "Antes" / "Después" en `GraficoAntesDespues`. `GraficoBienestar` no necesita
leyenda — es una sola serie, no hay ambigüedad de color que resolver.

## Alcance de archivos

- `app/globals.css` — 2 valores de token cambian (`--chart-2`, `--font-sans`); todo lo demás del
  `:root` ya aplicado en el rediseño anterior queda igual.
- `components/platform/dashboard/IndicadorMiniChart.tsx` — agrega `ChartLegend`.
- `components/platform/charts/GraficoAntesDespues.tsx` — agrega `ChartLegend`.
- `components/platform/bienestar/GraficoBienestar.tsx` — **sin cambios** (una sola serie, no
  necesita leyenda; se documenta la decisión de no tocarlo para que quede explícito que no fue un
  olvido).

## Testing

- Sin tests automatizados nuevos — son cambios de tokens CSS y presentación pura, mismo patrón
  del resto de componentes visuales de este proyecto.
- Verificación: `tsc --noEmit` y `npx vitest run` (regresión, ningún test debería verse afectado
  por cambios de color/tipografía/leyenda) y `next build`.
- Verificación manual (controller-only, para cuando el usuario pueda): confirmar visualmente que
  las leyendas aparecen y son legibles, que el morado se distingue claramente del azul en los 3
  gráficos, y que Source Sans 3 carga correctamente (no hay fallback a la fuente del sistema por
  un typo en el nombre de fuente de Google Fonts).

## Explícitamente fuera de alcance

- Modo oscuro (sigue sin usarse en la app).
- Animación/motion (no fue parte de los 4 hallazgos de la auditoría).
- Los 6 reportes adicionales de `/plataforma/reportes/*` fuera del set core ya cubierto.
- Cualquier cambio a `IndicadorCard.tsx`, `ResumenInteractivo.tsx`, o a las páginas que consumen
  estos componentes — el único cambio en esas capas fue en el refinamiento anterior; esta pasada
  toca solo los componentes de gráfico y el archivo de tema.
