# HealthScope — Reportes (Reporte Ejecutivo)

**Fecha:** 2026-07-23
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 12 ("Reportes": Ejecutivo, Recursos
Humanos, Prevención, Gerencia, Campañas, Calidad, Privacidad) — séptima pieza preventiva del
roadmap, después de encuestas, seguridad laboral, ergonomía, intervenciones, campañas y
profesionales.

## Decisión de alcance: solo el Reporte Ejecutivo, no los 7 tipos

A diferencia de los módulos anteriores (que agregaban una tabla nueva con su propio CRUD),
"Reportes" es fundamentalmente distinto: **agrega datos que ya existen** en otros módulos
(indicadores, suficiencia, alertas, seguridad, campañas) en vistas curadas por audiencia. El
documento pide 7 audiencias distintas, cada una con su propio contenido y énfasis — construir
las 7 de una vez es un salto de alcance mucho mayor que cualquier módulo anterior de este
roadmap.

Esta fase construye **solo el Reporte Ejecutivo** — la audiencia más pedida explícitamente en
el documento ("20. Genere reportes ejecutivos claros" en la lista de 18 requisitos). Los otros
6 (Recursos Humanos, Prevención, Gerencia, Campañas, Calidad, Privacidad) quedan para fases
posteriores, cada uno como su propia pieza de trabajo cuando se confirme que se necesita.

## Decisión de arquitectura: sin tabla nueva, reutiliza cálculos y componentes existentes

No hay modelo de datos nuevo. El Reporte Ejecutivo es una página que:

- Reutiliza `calcularIndiceSuficiencia()` (`lib/suficiencia/calcular.ts`) y el componente
  `SuficienciaBanner` **sin modificarlos** — mismo cálculo y misma presentación que ya usa
  `/plataforma/resumen`.
- Reutiliza `computeIndicadores()` (`lib/indicators/aggregate.ts`) para los 6 indicadores
  clave, con una tabla de presentación nueva (no el `IndicadorCard` del dashboard
  interactivo, que está pensado para una grilla de tarjetas con flechas de cambio — una
  tabla simple es más apropiada para un reporte impreso).
- Reutiliza `evaluarReglas()` (`lib/alertas/evaluar.ts`) y el componente `AlertasBanner`
  **sin modificarlos** — mismas alertas disparadas que ya muestra `/plataforma/resumen`.
- Agrega dos resúmenes nuevos y simples (conteo de eventos de seguridad por estado, conteo y
  lista de campañas activas) directamente en la página, sin una función pura dedicada — son
  reducciones/filtros triviales sobre datos ya tipados, no ameritan la misma inversión de
  testing que `calcularPuestosCriticos` o `agregarRespuestas`.

Esto significa: **ningún módulo existente cambia su comportamiento**. `SuficienciaBanner` y
`AlertasBanner` se importan tal cual están, sin tocarlos.

## Impresión: sin generación de PDF en el servidor

El reporte se genera con `window.print()` del navegador (Guardar como PDF desde el diálogo de
impresión), mismo enfoque ya usado en este proyecto para los documentos de
`docs/entregables/`. No se agrega ninguna librería de generación de PDF ni un servicio nuevo.

Para que la impresión se vea como un reporte limpio (sin el menú lateral ni la barra
superior), se agrega la clase `print:hidden` de Tailwind al `Sidebar` y al `Topbar`
compartidos (`components/platform/Sidebar.tsx`, `components/platform/Topbar.tsx`). Esto
afecta **todas** las páginas de `/plataforma/*`, pero **solo quiere decir algo cuando el
navegador está en modo impresión** — hoy no existe ningún estilo de impresión definido en el
proyecto, así que esto no cambia el comportamiento en pantalla de ninguna página existente,
y tampoco cambia qué se imprime hoy en otras páginas más allá de ocultar el menú/barra que de
todas formas no tendría sentido imprimir.

## Contenido del Reporte Ejecutivo

En orden:

1. **Encabezado**: nombre de la empresa, "Reporte Ejecutivo", período (mismo cálculo de
   período que ya usa `/plataforma/resumen`: últimos 6 meses), fecha de generación, generado
   por (nombre del usuario).
2. **Índice de suficiencia de datos** (`SuficienciaBanner`).
3. **Indicadores clave** (tabla nueva): los 6 indicadores con su valor formateado, o "Grupo
   insuficiente para mostrar" cuando el indicador viene suprimido — mismo lenguaje ya
   establecido en el resto del proyecto.
4. **Alertas activas** (`AlertasBanner`).
5. **Seguridad laboral**: conteo de eventos por estado (abierto, en seguimiento, cerrado).
6. **Campañas activas**: conteo y lista de nombre + tipo de las campañas con
   `estado = 'activa'`.
7. Botón "Imprimir" (oculto al imprimir vía `print:hidden`) que llama a `window.print()`.

## Interfaz

- **`/plataforma/reportes`** (nueva, visible para todo el tenant autenticado — mismo nivel
  de acceso que `/plataforma/resumen`, no restringido a admin, porque es una vista de solo
  lectura sin ninguna acción de escritura). Sin formulario de creación, sin acciones de
  gestión — es una página de presentación pura.
- Entrada de navegación "Reportes" en el `Sidebar`, con `adminOnly: false` (mismo patrón que
  "Resumen").

## Testing

- Sin función pura nueva que amerite pruebas unitarias dedicadas — los dos resúmenes nuevos
  (seguridad por estado, campañas activas) son reducciones/filtros triviales, mismo criterio
  ya aplicado en el resto del proyecto para no probar por separado cálculos sin complejidad
  real.
- Sin prueba automatizada para la página, mismo patrón ya establecido.
- Verificación manual explícita de que la vista previa de impresión (Ctrl+P) oculta
  correctamente el menú lateral y la barra superior en `/plataforma/reportes` — y que otras
  páginas del sistema (ej. `/plataforma/resumen`) siguen viéndose exactamente igual en
  pantalla tras el cambio a `Sidebar`/`Topbar`.

## Explícitamente fuera de alcance (fases posteriores)

- Los otros 6 tipos de reporte del documento (Recursos Humanos, Prevención, Gerencia,
  Campañas, Calidad, Privacidad) — decisión de alcance explícita de este spec (ver arriba).
- Generación de PDF en el servidor (ej. con una librería como Puppeteer o un servicio
  externo) — se usa impresión del navegador en esta fase.
- Selector de período personalizado (el reporte usa el mismo período fijo de 6 meses que ya
  usa `/plataforma/resumen`) — un selector de rango de fechas que recalcule los indicadores
  para un período distinto es una extensión más grande, no algo que este spec resuelve de
  paso.
- Historial de reportes generados (guardar una copia de cada reporte generado como registro)
  — el reporte es una vista en vivo, no se persiste ningún snapshot en esta fase.
- Envío automático o programado del reporte por correo — el usuario lo genera cuando lo
  necesita, no hay automatización en esta fase.
