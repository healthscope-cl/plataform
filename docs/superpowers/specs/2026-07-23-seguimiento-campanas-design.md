# HealthScope — Seguimiento (antes/durante/después de una Campaña)

**Fecha:** 2026-07-23
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 11 ("Seguimiento": Antes, Durante,
Después, Línea base, Participación, Evolución, Resultado) y la sección 9 ("Medición de
Campañas") — undécima pieza preventiva del roadmap, después de encuestas, seguridad laboral,
ergonomía, intervenciones, campañas, profesionales, reportes, bienestar preventivo, ausencias
y licencias, y calidad de datos.

Este spec construye directamente lo que el spec de Campañas (`2026-07-22-campanas-design.md`)
ya había diferido explícitamente: *"El documento describe... un modelo que compara
indicadores... antes y después de cada campaña... Esta fase no construye esa comparación
cuantitativa"*.

## Decisión de alcance: solo Campañas, no Intervenciones

El documento pide "seguimiento" también para intervenciones (su propio spec lo difirió por la
misma razón: dependía de que existiera el módulo de Campañas). Esta fase construye el modelo
de medición **solo para Campañas** — es la entidad que el propio documento ejemplifica con
cifras concretas (sección 9), y ya tiene los campos estructurados (`tipo`, `fechaInicio`,
`fechaFin`, `participantes`, `resultado`) que este modelo necesita. Intervenciones queda para
una fase posterior, mismo patrón de sub-planes secuenciales ya usado en este roadmap.

## Decisión de arquitectura: una señal configurable (encuesta) + una siempre disponible (seguridad)

**Cambio de schema (el primero desde Calidad de Datos):** se agrega una columna nueva y
nullable `pregunta_seguimiento_id text` a `campanas`. Sin FK — sigue el mismo patrón que
`encuestas.pregunta_ids text[]`: un id del catálogo de encuestas (`lib/encuestas/catalogo.ts`),
validado solo a nivel de aplicación, no una referencia de base de datos. Ninguna otra columna,
RLS o grant de `campanas` cambia.

Con esa columna, la vista de seguimiento de una campaña compara:

1. **Pregunta de encuesta (opcional, configurable por campaña):** si `pregunta_seguimiento_id`
   está definida, se promedian las respuestas a esa pregunta específica (de cualquier encuesta
   de la empresa que la incluya, mismo criterio de "todas las encuestas" ya usado en
   Bienestar Preventivo) separadas en dos grupos por fecha: antes de `fecha_inicio` de la
   campaña, después de `fecha_fin`. Cubre el "40% declara molestias lumbares → 26%" del
   ejemplo del documento.
2. **Eventos de seguridad (siempre disponible, sin configuración):** conteo de
   `eventos_seguridad` (por su campo `fecha`, no `created_at`) antes de `fecha_inicio` vs
   después de `fecha_fin`. Cubre el "20 incidentes → 11" del ejemplo. Sin supresión de grupo
   pequeño — mismo criterio que ya usa Reportes para estos mismos conteos (no son respuestas
   individuales de encuesta, son eventos administrativos).

**Sin ventana de tiempo acotada.** "Antes" es todo lo anterior a `fecha_inicio`; "después" es
todo lo posterior a `fecha_fin` (hasta hoy). No se acota a "los 3 meses previos" ni nada
similar — mismo principio de simplicidad ya aplicado en Bienestar Preventivo (snapshot
acumulado, no ventana configurable).

## Función pura nueva: `medirAntesDespues()`

A diferencia de los últimos cuatro módulos (Reportes, Bienestar Preventivo, Ausencias y
Licencias, Calidad de Datos), que solo reutilizaron funciones ya existentes, este spec sí
necesita una función nueva — dividir una lista de valores fechados en dos grupos por un límite
de fecha y promediar cada lado no es algo que ya exista en el proyecto:

```
medirAntesDespues(input: {
  valores: Array<{ valor: number; fecha: string }>
  fechaInicio: string
  fechaFin: string | null
}): {
  antes: { promedio: number; cantidad: number } | { suprimido: true } | { sinDatos: true }
  despues: (misma forma) | null   // null si la campaña todavía no tiene fecha_fin
}
```

Aplica `MIN_GROUP_SIZE` (mismo umbral compartido, `lib/indicators/formulas.ts`) a cada grupo
por separado. Distingue explícitamente "sin datos todavía" (cero respuestas en esa ventana) de
"grupo insuficiente" (1 a `MIN_GROUP_SIZE - 1` respuestas) — son mensajes distintos para el
usuario. Esta función es genérica sobre "valores numéricos con fecha"; la página la usa para
la pregunta de encuesta configurada, no para los eventos de seguridad (esos son un conteo
simple, no un promedio, y no llevan supresión).

Como es una función nueva y genuinamente nueva lógica (no una transcripción de algo ya
existente), lleva sus propias pruebas unitarias (TDD) — a diferencia del resto de este bloque
de módulos.

## Página nueva: `/plataforma/campanas/[id]`

Contenido, en orden:

1. **Encabezado**: nombre, tipo, fechas, estado, responsable, participantes, resultado (texto
   libre) — todos campos que ya existen en `Campana`, sin cálculo nuevo.
2. **Seguimiento de encuesta** (solo si `pregunta_seguimiento_id` está definida): tarjetas
   antes/después con el promedio de esa pregunta, o el mensaje de "sin datos"/"grupo
   insuficiente" según corresponda. Si no hay `pregunta_seguimiento_id`, se muestra un mensaje
   indicando que esta campaña no tiene una pregunta de seguimiento configurada (no se oculta
   la sección sin explicación).
3. **Seguimiento de seguridad**: conteo de eventos de seguridad antes/después de la campaña.
4. Si `fecha_fin` es `null` (campaña sin terminar): el lado "después" de ambas comparaciones
   muestra "La campaña todavía no tiene fecha de término" en vez de un número — no se inventa
   un "después" para una campaña en curso.

## Cambios a archivos existentes

- **`CampanaSheet.tsx`** (solo creación, sin edición — no cambia eso): gana un selector
  opcional "Pregunta de seguimiento" con "Ninguna" + las preguntas del catálogo de encuestas.
  Campo nullable, sin validación adicional (cualquier pregunta del catálogo es válida, o
  ninguna).
- **`CampanasTable.tsx`**: gana un botón/link "Ver seguimiento" por fila, enlazando a
  `/plataforma/campanas/[id]` — mismo patrón exacto que "Ver resultados" ya usa
  `EncuestasTable.tsx` para encuestas.

Ninguna otra página o componente existente cambia. No se agrega edición de campaña en esta
fase (fuera de alcance, ver abajo).

## Interfaz y acceso

- **`/plataforma/campanas/[id]`** (nueva). No tiene entrada propia en el Sidebar — se llega
  únicamente desde el link "Ver seguimiento" en la lista de Campañas (mismo patrón que
  `/plataforma/encuestas/[id]`, que tampoco tiene su propia entrada de nav). Mismo nivel de
  acceso que la lista de Campañas — la ruta no repite el chequeo de rol server-side, mismo
  precedente que el resto del proyecto.

## Testing

- `medirAntesDespues()`: pruebas unitarias reales — promedio correcto cuando hay suficientes
  valores en cada lado, supresión cuando hay menos de `MIN_GROUP_SIZE`, "sin datos" cuando un
  lado tiene cero valores, `despues: null` cuando `fechaFin` es `null`, y el caso límite de un
  valor exactamente en la fecha de corte (antes/después estrictos, no inclusivos de la fecha
  límite misma — a definir explícitamente en el plan de implementación, no dejarlo ambiguo).
- Sin prueba automatizada para la página, `CampanaSheet.tsx` ni `CampanasTable.tsx` — mismo
  patrón ya establecido para páginas y formularios en este proyecto.
- Verificación manual explícita (controller-only): aplicar la migración a producción, crear
  una campaña con `pregunta_seguimiento_id` configurada, confirmar que el antes/después
  coincide con un cálculo manual sobre `encuesta_respuestas` reales, y que el conteo de
  eventos de seguridad también coincide.

## Explícitamente fuera de alcance (fases posteriores)

- El mismo modelo de seguimiento para Intervenciones — depende de este spec, se construye
  como una pieza separada cuando se confirme que se necesita.
- Ventana de tiempo configurable (ej. "últimos 3 meses antes de la campaña") — antes/después
  son simplemente todo lo anterior/posterior a las fechas de la campaña, sin acotar.
- Múltiples preguntas de seguimiento por campaña — solo una, opcional.
- Edición de una campaña existente (incluyendo cambiar su `pregunta_seguimiento_id` después de
  creada) — `CampanaSheet` sigue siendo solo-creación en esta fase.
- Cualquier alerta o notificación automática basada en el resultado del seguimiento — esta
  vista es de solo lectura/consulta, no dispara ninguna acción.
- Vincular esto al motor de recomendaciones (sección 10) — sigue diferido en todo el roadmap.
