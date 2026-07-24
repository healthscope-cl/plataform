# HealthScope — Rediseño Visual y Gráficos Reales

**Fecha:** 2026-07-24
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** feedback directo de Jose ("todo blanco sin diseño ni gráficos ni nada" al entrar
a la plataforma) y a dos hallazgos confirmados durante la verificación de producción de Motor de
Recomendaciones: (1) `app/globals.css` usa el tema gris por defecto de shadcn/ui sin personalizar
— todos los tokens de color (`--primary`, `--secondary`, `--accent`, `--sidebar`, `--chart-1` a
`--chart-5`, bordes) son `oklch(X 0 0)`, cero saturación; (2) no existe ninguna librería de
gráficos en todo el proyecto — los 15+ módulos construidos hasta ahora muestran los indicadores
calculados solo como números en tarjetas. También responde a la sección 12 del documento maestro
(`referencia/instrucciones2.txt`), que pide explícitamente "Gráficos claros" y una paleta de marca
(azul marino, azul eléctrico, cián, turquesa, morado) que hoy solo existe hardcodeada en el sitio
público de marketing, nunca aplicada a `/plataforma/*`.

## Decisión de alcance: tema de colores + gráficos de barras/comparación, sin tendencia temporal

Se descartó agregar gráficos de tendencia (una línea subiendo/bajando mes a mes): la plataforma
hoy no guarda una serie histórica de indicadores — solo calcula el período actual en vivo, más un
único punto de comparación opcional guardado ("línea base", tabla `lineas_base`). Construir
gráficos de tendencia real requeriría antes un sistema de snapshots periódicos, un proyecto de
datos aparte, no incluido aquí.

Lo que sí es calculable hoy, con datos que ya existen, son gráficos de **barras y comparación**:
los 6 indicadores lado a lado, promedios de encuesta por pregunta, comparaciones antes/después de
campañas e intervenciones, y actual-vs-anterior de incidentes.

**Alcance de páginas (primera pasada, set core):** `/plataforma/resumen` (dashboard principal),
`/plataforma/bienestar`, y las páginas de detalle `/plataforma/campanas/[id]` e
`/plataforma/intervenciones/[id]`. Los 6 reportes adicionales de `/plataforma/reportes/*` quedan
explícitamente fuera de esta primera pasada — son candidatos naturales para una segunda pasada,
reusando el mismo componente de gráfico de indicadores, pero no se construyen en este plan.

## Paleta de colores: reuso exacto del sitio público, nunca colores nuevos inventados

Los colores de marca ya están validados y en producción en `components/home/*.tsx` (marketing),
confirmados por grep en todo ese directorio — no hay que inventar valores nuevos, solo aplicarlos
a `/plataforma/*`:

- `#03142F` — navy oscuro (fondos oscuros, hero)
- `#1455E6` — azul eléctrico (acciones primarias, enlaces)
- `#00B8F5` — cián (acentos)
- `#12C7B4` — turquesa (acento secundario de gradiente)
- `#101827` — texto oscuro (encabezados)
- `#48556A` — texto secundario (cuerpo)
- `#F4F7FB` — fondo claro de sección
- `#38D978` — verde (éxito/positivo — ya existe como `--success`, sin cambio)

No existe ningún morado/violeta en ningún lugar del proyecto hoy, pese a que la sección 12 del
documento pide explícitamente "Morado como acento secundario". Se introduce un morado nuevo
(`#7C3AED`) específicamente como `--chart-5` — la primera vez que esta parte de la sección 12 se
implementa.

### Mapeo de tokens (`app/globals.css`, bloque `:root` únicamente)

| Token | Valor nuevo | Origen |
|---|---|---|
| `--background` | `#FFFFFF` | sin cambio |
| `--foreground` | `#101827` | texto oscuro del marketing |
| `--card` / `--card-foreground` | `#FFFFFF` / `#101827` | sin cambio de fondo, texto alineado |
| `--primary` | `#1455E6` | azul eléctrico |
| `--primary-foreground` | `#FFFFFF` | texto blanco sobre el azul |
| `--secondary` / `--muted` | `#F4F7FB` | fondo claro de sección del marketing |
| `--secondary-foreground` | `#101827` | — |
| `--muted-foreground` | `#48556A` | texto secundario del marketing |
| `--accent` | `#E6F4FE` (tinte pálido derivado del cián, NO el cián saturado — por legibilidad en fondos de hover/selección) | derivado |
| `--accent-foreground` | `#101827` | — |
| `--border` / `--input` | `#D8DEE8` (gris con tinte azulado sutil, derivado de `#48556A` muy aclarado) | derivado |
| `--ring` | `#1455E6` | mismo azul primario, para el anillo de foco |
| `--destructive`, `--success` | sin cambio | ya tienen color real (rojo/verde) |
| `--sidebar` | `#03142F` | navy oscuro, mismo tono del hero |
| `--sidebar-foreground` | `#FFFFFF` | — |
| `--sidebar-primary`, `--sidebar-accent` (ítem activo) | `#1455E6`, `#00B8F5` | azul eléctrico / cián |
| `--sidebar-primary-foreground`, `--sidebar-accent-foreground` | `#FFFFFF` | — |
| `--sidebar-border`, `--sidebar-ring` | tono navy más claro (`#1B2C4A`) | derivado |
| `--chart-1` | `#1455E6` | azul eléctrico |
| `--chart-2` | `#00B8F5` | cián |
| `--chart-3` | `#12C7B4` | turquesa |
| `--chart-4` | `#3D5A80` (navy aclarado — el navy puro `#03142F` es demasiado oscuro para una barra sobre fondo blanco) | derivado del navy |
| `--chart-5` | `#7C3AED` | morado nuevo, ver arriba |

El bloque `.dark` de `globals.css` queda **fuera de alcance**: no se usa en ningún lugar de la app
(sin `ThemeProvider`, sin toggle de tema, confirmado por grep en `app/`) — no se retemiza en este
plan.

## Arquitectura de gráficos

- Se agrega la dependencia `recharts` (`npm install recharts`) — la librería que los propios
  componentes de gráficos de shadcn/ui usan por debajo, con integración directa a los tokens
  `--chart-1` a `--chart-5` del tema.
- Un componente wrapper reusable, `components/ui/chart.tsx` (el patrón oficial de shadcn/ui:
  `ChartContainer`, `ChartTooltip`, `ChartConfig`) — mapea los tokens de color del tema a las
  series de Recharts, para que ningún gráfico individual hardcodee un color.
- Cada gráfico específico es un Client Component enfocado en `components/platform/charts/`,
  que recibe los datos ya calculados como props — nunca recalcula nada, solo visualiza lo que la
  página Server Component ya calculó. Un componente de gráfico de barras de indicadores se
  construye una sola vez y se reusa entre `resumen` y (en una fase posterior) los reportes.

## Gráficos por página (set core)

1. **`/plataforma/resumen`** — gráfico de barras con los 6 indicadores
   (`tasaAusentismo`, `frecuencia`, `severidad`, `duracionPromedio`, `reincidencia`,
   `costoEstimado`). Si `indicadoresBase` (línea base guardada) existe, barras agrupadas
   (actual vs línea base); si no, barras simples del período actual. Un indicador con
   `{ suprimido: true }` se muestra como "sin datos suficientes" en esa barra, nunca como cero
   falso.
2. **`/plataforma/bienestar`** — gráfico de barras horizontal con el promedio de cada una de las
   7 preguntas (estrés, fatiga, sueño, carga, liderazgo, conciliación, clima). Una pregunta
   suprimida por `MIN_GROUP_SIZE` se omite del gráfico (o se marca "sin datos"), igual que hoy en
   las tarjetas de texto — nunca se grafica un valor inventado.
3. **`/plataforma/campanas/[id]` y `/plataforma/intervenciones/[id]`** — gráfico de barras
   agrupadas antes/después (la pregunta de seguimiento configurada + el conteo de incidentes de
   seguridad), reusando el mismo componente de gráfico en ambas páginas — construido una sola vez,
   ya que ambas páginas ya comparten `medirAntesDespues()` para el cálculo.

## Testing

- Sin tests automatizados para los componentes de gráfico en sí — son presentacionales puros,
  mismo patrón que el resto del proyecto (sin tests de página/UI en ningún módulo anterior).
- Regla de correctitud explícita: un gráfico que recibe un dato suprimido o vacío debe mostrar un
  estado "sin datos suficientes", nunca una barra en cero o un gráfico vacío sin explicación
  (coherente con la sección 12 del documento: "no llenar el espacio con gráficos vacíos").
- Verificación manual explícita (controller-only, mismo patrón ya establecido en todo el
  proyecto): confirmar visualmente que los colores de marca se ven correctamente en luz real del
  navegador (no solo en el código), y que cada gráfico refleja los mismos números que ya se
  mostraban como texto antes de este cambio.

## Explícitamente fuera de alcance

- Gráficos de tendencia temporal (requiere un sistema de snapshots periódicos — proyecto de datos
  aparte).
- Los 6 reportes adicionales de `/plataforma/reportes/*` — candidatos para una segunda pasada,
  reusando el componente de gráfico de indicadores de `resumen`, pero no incluidos aquí.
- Modo oscuro (`.dark` en `globals.css`) — no se usa en ningún lugar de la app hoy.
- Cualquier cambio a la lógica de cálculo de indicadores, encuestas o mediciones — este plan es
  puramente de presentación (color + visualización), no toca ninguna función de `lib/`.
