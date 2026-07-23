# HealthScope — Calidad de Datos

**Fecha:** 2026-07-23
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 13 ("Calidad de Datos": Errores, Campos
faltantes, Duplicados, Actualización, Recomendaciones) — décima pieza preventiva del roadmap,
después de encuestas, seguridad laboral, ergonomía, intervenciones, campañas, profesionales,
reportes, bienestar preventivo y ausencias y licencias.

## Decisión de arquitectura: sin tabla nueva, expone `errores_calidad` tal cual existe

El dato ya existe completo desde la fase de ingesta: cada importación que corre
`app/api/platform/importaciones/ejecutar/route.ts` ya inserta filas en `errores_calidad`
(`tenant_id`, `importacion_id`, `fila`, `severidad`, `tipo`, `mensaje`). Lo que falta no es
dato — es una vista que lo muestre. Hoy esos errores solo se ven **en vivo, durante el
asistente de importación**, antes de confirmar (vía `validateRows()` client-side); una vez
persistidos, ninguna página los vuelve a mostrar. `/plataforma/importar/historial` solo
muestra `filasProcesadas`/`filasRechazadas` por importación, no el detalle de qué falló ni por
qué.

No hay modelo de datos nuevo, ni cambio de RLS. `errores_calidad_select_same_tenant` e
`importaciones_select_same_tenant` (ver `supabase/schema.sql`) ya permiten a cualquier usuario
autenticado del tenant leer estas filas — no hace falta `createAdminClient()`, igual que en
Ausencias y Licencias.

## Alcance de la consulta: las últimas 50 importaciones, sin ventana de fecha

`errores_calidad` no tiene columna `created_at` propia — hereda su fecha de la importación a
la que pertenece. Por eso el corte se hace sobre `importaciones` (`order by created_at desc`,
`.limit(50)`), y luego se traen los `errores_calidad` de esas importaciones — no sobre
`errores_calidad` directamente. La tabla de detalle (ver abajo) además tiene su propio tope de
200 filas, mismo patrón ya usado en Auditoría y en Ausencias y Licencias.

## Contenido de la página

1. **"Actualización"**: una línea con la importación más reciente — fecha, nombre de archivo,
   estado (`en_progreso`/`completada`/`revertida`/`fallida`).
2. **Resumen por tipo** (cubre "Errores. Campos faltantes. Duplicados."): una tabla `tipo →
   cantidad`, agregando todos los `errores_calidad` de las últimas 50 importaciones. Los 7
   valores reales de `tipo` que ya produce el motor de validación
   (`campo_obligatorio_faltante`, `fila_duplicada`, `duracion_invalida`, `tipo_no_reconocido`,
   `fecha_imposible`, `periodo_superpuesto`, `grupo_no_reconocido`, ver `lib/ingestion/validate.ts`
   y `app/api/platform/importaciones/ejecutar/route.ts`) tienen una etiqueta legible y un tip
   estático de una línea. **`tipo` es `text` libre en la base de datos, no un enum** — el mapa
   de etiquetas/tips usa un lookup con fallback genérico para cualquier valor no listado, no un
   `Record` exhaustivo de un union cerrado.
3. **Detalle**: tabla con cada error individual — fecha de su importación, archivo, fila,
   severidad (badge, mismo componente `Badge` ya usado en `ImportHistoryTable`), tipo
   (etiqueta legible), mensaje. Tope de 200 filas.

## "Recomendaciones": tip estático por tipo, no el motor de recomendaciones de la sección 10

El documento pide "Recomendaciones" dentro de este módulo. La sección 10 del mismo documento
("Motor de Recomendaciones") ya describe un sistema mucho más grande y estructurado
(evidencia, nivel de confianza, justificación, limitaciones, responsable sugerido, indicador a
medir, revisión humana) que está **explícitamente fuera de alcance en todo este roadmap**
hasta ahora — no se construye aquí tampoco. Lo que este módulo aporta es un mapa fijo
`tipo → texto de ayuda` (ej. `campo_obligatorio_faltante`: "Revisa que la plantilla tenga
todas las columnas requeridas antes de volver a importar"), sin IA, sin motor, sin
persistencia — coherente con cómo el resto del proyecto ya trata cualquier "sugerencia": texto
estático, no inferencia.

## Interfaz y acceso

- **`/plataforma/calidad-datos`** (nueva). Entrada de navegación "Calidad de datos" con
  `adminOnly: true` — mismo patrón que todas las páginas admin-only ya existentes
  (Encuestas, Alertas, Seguridad laboral, Ergonomía, Intervenciones, Campañas, Profesionales,
  Bienestar preventivo, Ausencias y licencias): el link se oculta para roles no-admin, la
  página misma no repite el chequeo de rol server-side.
- Sin formulario, sin filtros, sin acciones de escritura ni de resolución de errores — los
  `errores_calidad` solo se crean vía el asistente de importación; esta página es puramente de
  lectura.

## Testing

- Sin función pura nueva — el conteo por tipo es una reducción trivial sobre un arreglo ya
  tipado, mismo criterio ya aplicado en el resto del proyecto.
- Sin prueba automatizada para la página ni los dos componentes nuevos, mismo patrón ya
  establecido.
- Verificación manual explícita (controller-only): con datos reales de HealthScope Demo,
  confirmar que el resumen por tipo y la tabla de detalle coinciden con un conteo manual de
  `errores_calidad` de esa empresa, y que la línea de "Actualización" muestra la importación
  correcta.

## Explícitamente fuera de alcance (fases posteriores)

- Motor de recomendaciones real (sección 10 del documento) — sigue diferido en todo el
  roadmap, no se construye aquí.
- Filtros (por tipo, por severidad, por importación) — la página es un resumen +
  detalle simple en esta primera versión.
- Edición, resolución o descarte de errores desde esta página.
- Ventana de fecha configurable — el corte de 50 importaciones más recientes es fijo en esta
  fase.
