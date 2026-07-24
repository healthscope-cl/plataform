# HealthScope — Reportes: los 6 tipos restantes

**Fecha:** 2026-07-24
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 12 ("Reportes": Ejecutivo, Recursos
Humanos, Prevención, Gerencia, Campañas, Calidad, Privacidad). El spec original de Reportes
(`2026-07-23-reportes-design.md`) construyó solo el Ejecutivo y diirió explícitamente los
otros 6 — este spec construye esos 6, ahora que el usuario confirmó que se necesitan.

## Decisión de arquitectura: menú + una carpeta por tipo de reporte

Hoy `/plataforma/reportes` **es** directamente el Reporte Ejecutivo. Con 7 tipos, esa ruta
pasa a ser un **menú** (7 tarjetas, una por tipo), y cada reporte vive en su propia carpeta:

```
/plataforma/reportes                    → menú (nuevo)
/plataforma/reportes/ejecutivo          → contenido actual, movido sin cambios de lógica
/plataforma/reportes/recursos-humanos   → nuevo
/plataforma/reportes/prevencion         → nuevo
/plataforma/reportes/gerencia           → nuevo
/plataforma/reportes/campanas           → nuevo
/plataforma/reportes/calidad            → nuevo
/plataforma/reportes/privacidad         → nuevo
```

**No es una ruta dinámica `[tipo]`** — son 7 carpetas estáticas independientes. Una ruta
dinámica obligaría a mezclar la lógica de los 7 reportes en un solo archivo con un
switch/lookup gigante, violando "cada archivo con una responsabilidad clara". Con carpetas
separadas, cada reporte es su propio archivo enfocado, y no hay ningún conflicto de rutas en
Next.js entre `/reportes/ejecutivo` (estática) y las demás (también estáticas).

**Sin cambio de Sidebar.** La entrada "Reportes" ya existe y ya apunta a `/plataforma/reportes`
— con el menú nuevo, esa misma entrada sigue funcionando igual, solo que ahora aterriza en el
menú en vez de directo en el Ejecutivo. `adminOnly: false` se mantiene igual (el menú y los 6
reportes nuevos heredan el mismo nivel de acceso que ya tiene el Ejecutivo — de solo lectura,
sin acción de escritura, visible a todo el tenant autenticado).

## Principio general: cero cálculo nuevo, cero schema nuevo

Los 6 reportes nuevos reutilizan exclusivamente funciones y componentes **ya construidos y ya
revisados** en módulos anteriores de este roadmap. Ninguno introduce una tabla, una columna,
ni una función pura nueva — **con una excepción parcial**: el reporte de Campañas es la
primera vez que se muestra el seguimiento antes/después de *varias* campañas a la vez en una
sola vista (hasta ahora, `medirAntesDespues()` solo se llamaba una campaña a la vez, en
`/plataforma/campanas/[id]`). Esto no requiere cambiar `medirAntesDespues()` — solo llamarla
una vez por cada campaña con `pregunta_seguimiento_id` configurada.

## Contenido de cada reporte

### 1. Ejecutivo (`/plataforma/reportes/ejecutivo`)

Se mueve **sin ningún cambio de lógica** desde el actual `app/plataforma/reportes/page.tsx`.
Mismo encabezado, `SuficienciaBanner`, `IndicadoresResumenTabla`, `AlertasBanner`, resumen de
seguridad laboral, resumen de campañas activas, botón de impresión.

### 2. Recursos Humanos (`/plataforma/reportes/recursos-humanos`)

- Índice de suficiencia (`calcularIndiceSuficiencia` + `SuficienciaBanner`, reutilizados sin
  modificar).
- Los 6 indicadores de ausentismo (`computeIndicadores` + `IndicadoresResumenTabla`,
  reutilizados sin modificar).
- Tabla por-persona con mayor costo/días perdidos (`computeIndicadoresPorPersona`,
  `lib/indicators/porPersona.ts` — la misma función pura que ya usa el drill-down interactivo
  de `/plataforma/resumen`; aquí se llama directamente, sin reutilizar el componente cliente
  `PersonaDetalleTable` porque ese componente tiene su propio gating de rol pensado para vivir
  dentro de una página de acceso mixto — este reporte ya está gateado a nivel de página como
  el resto de `/plataforma/reportes/*`). Tabla simple, ordenada por `costoEstimado`
  descendente, mostrando solo `codigo` (nunca RUT).
- Distribución de episodios por tipo administrativo: conteo simple (`episodios` agrupados por
  `tipo_administrativo_id`, con el nombre desde `tipos_administrativos` — mismo patrón de
  join ya usado en Ausencias y Licencias).

### 3. Prevención (`/plataforma/reportes/prevencion`)

- Eventos de seguridad por tipo y por gravedad (conteo simple sobre `eventos_seguridad`,
  usando `mapEventoSeguridadRow` sin modificar).
- Evaluaciones ergonómicas por nivel de riesgo y por estado (conteo simple sobre
  `evaluaciones_ergonomicas`, usando `mapEvaluacionErgonomicaRow` sin modificar).
- Campañas de tipo `ergonomia`, `pausas_activas` o `prevencion` actualmente `activa` (filtro
  simple sobre `campanas`, reutilizando `mapCampanaRow`).

### 4. Gerencia (`/plataforma/reportes/gerencia`)

- Índice de suficiencia (`SuficienciaBanner`, reutilizado).
- Costo estimado de ausentismo (el mismo `costoEstimado` que ya calcula `computeIndicadores`
  para el Ejecutivo — se muestra como una cifra destacada, no la tabla completa de 6
  indicadores).
- Alertas activas (`AlertasBanner`, reutilizado).
- Resumen de campañas activas: conteo total y suma de `costo` (cuando no es `null`).

### 5. Campañas (`/plataforma/reportes/campanas`)

- Lista de **todas** las campañas de la empresa (tipo, fechas, estado, resultado en texto
  libre) — no solo las activas.
- Para cada campaña con `pregunta_seguimiento_id` configurada: su comparación antes/después,
  llamando `medirAntesDespues()` una vez por campaña (misma lógica exacta que
  `/plataforma/campanas/[id]`, ahora en una vista consolidada de todas las campañas en vez de
  una por una). Esto requiere la misma lectura privilegiada de `encuesta_respuestas` vía
  `createAdminClient()` que ya usa esa página, ejecutada una vez por cada campaña que tenga la
  pregunta configurada.

### 6. Calidad (`/plataforma/reportes/calidad`)

Reutiliza **tal cual, sin modificar** los componentes ya construidos en el módulo de Calidad
de Datos: `CalidadDatosResumen` (resumen por tipo con tips) sobre los mismos `errores_calidad`
de las últimas 50 importaciones — misma consulta exacta que ya usa
`/plataforma/calidad-datos`. No se reutiliza `CalidadDatosTable` (el detalle fila-por-fila) —
un reporte de nivel gerencial no necesita el detalle completo, solo el resumen.

### 7. Privacidad (`/plataforma/reportes/privacidad`)

- Texto fijo explicando los principios de privacidad ya aplicados en la plataforma: tamaño
  mínimo de grupo (`MIN_GROUP_SIZE`, valor actual expuesto), separación
  administrativa/clínica (`tipo_administrativo` nunca es un diagnóstico), pseudonimización de
  RUT (`rut_hash`, nunca el RUT real), auditoría append-only.
- Conteo real (no estático): cuántos de los 6 indicadores de ausentismo del Ejecutivo están
  **actualmente suprimidos** por grupo insuficiente (`computeIndicadores`, contando cuántos
  resultados tienen `{ suprimido: true }`) — es la única cifra calculada de este reporte, y ya
  es un subproducto directo de una función existente, no un cálculo nuevo.
- Link a `/plataforma/auditoria`.

## Testing

- Sin función pura nueva (salvo la excepción ya señalada, que no es nueva lógica, solo
  invocación repetida de una función existente).
- Sin prueba automatizada para ninguna de las 7 páginas ni para el menú — mismo patrón ya
  establecido en todo el proyecto para páginas de `/plataforma/*`.
- Verificación manual explícita (controller-only): confirmar que el menú enlaza correctamente
  a los 7 reportes, que el Ejecutivo se ve idéntico en su nueva URL, y que cada uno de los 6
  reportes nuevos muestra datos reales coherentes con lo que ya se ve en sus páginas de origen
  (Resumen, Seguridad, Ergonomía, Campañas, Calidad de Datos).

## Explícitamente fuera de alcance (fases posteriores)

- Exportación a PDF por separado de la impresión del navegador (ya existente vía
  `window.print()` en el Ejecutivo; no se extiende automáticamente a los 6 nuevos en esta
  fase — cada uno puede recibir su propio botón de impresión en una fase posterior si se
  necesita).
- Selector de período configurable (todos los reportes que usan período siguen el mismo
  período fijo de 6 meses que ya usa el Ejecutivo).
- Cualquier acción de escritura desde cualquier reporte.
- Historial o versionado de reportes generados.
