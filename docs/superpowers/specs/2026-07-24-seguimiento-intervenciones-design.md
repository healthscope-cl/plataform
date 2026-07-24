# HealthScope — Seguimiento (antes/durante/después de una Intervención)

**Fecha:** 2026-07-24
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 11 ("Seguimiento": Antes, Durante,
Después, Línea base, Participación, Evolución, Resultado) — la pieza final de este roadmap.
Extiende directamente el modelo de medición ya construido para Campañas
(`2026-07-23-seguimiento-campanas-design.md`), que dejó explícitamente diferido "el mismo
modelo de seguimiento para Intervenciones" hasta que se necesitara.

## Decisión de arquitectura: mismo patrón que Campañas, adaptado a un solo campo de fecha

`intervenciones` tiene un único campo `fecha date not null` — a diferencia de `campanas`
(`fecha_inicio`/`fecha_fin`), una intervención no tiene un rango de fechas, es un punto en el
tiempo (la fecha en que se implementó/decidió). Por eso el antes/después se calcula así:

- **Antes**: todo lo anterior a `fecha`.
- **Después**: todo lo posterior a `fecha`.

Esto se logra llamando a `medirAntesDespues()` (`lib/campanas/medicion.ts`, **sin
modificarla**, reutilizada literalmente del módulo anterior aunque vive en `lib/campanas/`, no
en `lib/intervenciones/` — es una función genérica sobre "valores con fecha y un límite",
nada específico de campañas) con `fechaInicio: intervencion.fecha` y `fechaFin:
intervencion.fecha` — el mismo valor en ambos parámetros. Dado que la función usa límites
estrictos (`<`/`>`), esto da exactamente "antes de la fecha" / "después de la fecha", y a
diferencia de una campaña sin `fecha_fin` todavía, **"después" nunca es `null`** aquí, porque
`intervencion.fecha` siempre existe (`not null` en el schema).

## Cambio de schema: columna `pregunta_seguimiento_id`

Igual que en Campañas: se agrega una columna nueva y nullable `pregunta_seguimiento_id text` a
`intervenciones`. Sin FK — mismo patrón que `campanas.pregunta_seguimiento_id` y
`encuestas.pregunta_ids`, un id del catálogo de encuestas validado solo a nivel de aplicación.

## Página nueva: `/plataforma/intervenciones/[id]`

Contenido, en orden:

1. **Encabezado**: problema detectado, objetivo, responsable, presupuesto (si existe), fecha,
   indicadores a medir (texto libre ya existente), estado, resultado (texto libre ya
   existente) — todos campos que ya existen en `Intervencion`, sin cálculo nuevo.
2. **Seguimiento de encuesta** (solo si `pregunta_seguimiento_id` está definida): tarjetas
   antes/después con el promedio de esa pregunta (misma supresión `MIN_GROUP_SIZE` que ya
   aplica en Campañas y Bienestar Preventivo), o "sin datos"/"grupo insuficiente" según
   corresponda. Si no está configurada, mensaje explicando que esta intervención no tiene una
   pregunta de seguimiento.
3. **Seguimiento de seguridad**: conteo de `eventos_seguridad` (por su campo `fecha`) antes y
   después de `intervencion.fecha` — mismo secundario "siempre disponible, sin supresión" ya
   usado en Campañas (no son respuestas individuales de encuesta, son eventos
   administrativos).

## Cambios a archivos existentes

- **`IntervencionSheet.tsx`** (solo creación, sin edición — no cambia eso): gana el mismo
  selector opcional "Pregunta de seguimiento" ("Ninguna" + catálogo de encuestas) que ya tiene
  `CampanaSheet.tsx`.
- **`IntervencionesTable.tsx`**: gana un botón/link "Ver seguimiento" por fila, dentro de la
  misma celda de Acciones ya gateada a `canEdit` (mismo patrón exacto ya usado en
  `CampanasTable.tsx` — esa tabla también oculta toda su columna de Acciones a no-admins, así
  que "Ver seguimiento" se agrega ahí, no como columna nueva siempre visible).

Ninguna otra página o componente existente cambia. `GestionarIntervencionSheet.tsx` no se
toca — la pregunta de seguimiento sigue sin ser editable después de creada, igual que en
Campañas.

## Interfaz y acceso

- **`/plataforma/intervenciones/[id]`** (nueva). Sin entrada propia en el Sidebar — se llega
  únicamente desde el link "Ver seguimiento" en la lista de Intervenciones. **A diferencia del
  módulo de Reportes** (donde un hallazgo real de autorización obligó a agregar un gate de rol
  porque el menú padre era `adminOnly: false`), `/plataforma/intervenciones` **ya es
  `adminOnly: true`** en el Sidebar — no hay ruta alternativa de acceso para un no-admin, así
  que esta página nueva no necesita un gate de rol propio, mismo nivel de acceso que
  `/plataforma/campanas/[id]` (que tampoco lo tiene, por la misma razón: su único camino de
  entrada ya está gateado).

## Testing

- Sin función pura nueva — se reutiliza `medirAntesDespues()` sin modificarla, ya tiene su
  propia suite de pruebas del módulo de Campañas.
- Sin prueba automatizada para la página, `IntervencionSheet.tsx` ni `IntervencionesTable.tsx`
  — mismo patrón ya establecido.
- Verificación manual explícita (controller-only): aplicar la migración a producción, crear
  una intervención con `pregunta_seguimiento_id` configurada, confirmar que el antes/después
  coincide con un cálculo manual sobre `encuesta_respuestas` reales, y que el conteo de
  eventos de seguridad también coincide.

## Explícitamente fuera de alcance (fases posteriores)

- Ventana de tiempo configurable — antes/después son simplemente todo lo anterior/posterior a
  `fecha`, sin acotar (mismo principio que Campañas).
- Múltiples preguntas de seguimiento por intervención — solo una, opcional.
- Edición de `pregunta_seguimiento_id` después de creada la intervención.
- Cualquier alerta o notificación automática basada en el resultado del seguimiento.
- Vincular esto al motor de recomendaciones (sección 10) — sigue diferido en todo el roadmap.

Con esta pieza, **"Seguimiento" queda completo tanto para Campañas como para Intervenciones**
— las 15 categorías de `referencia/instrucciones2.txt` (sección 8) están cubiertas, con
Reportes e Integraciones documentados como transparencia parcial/de estado según sus propios
specs.
