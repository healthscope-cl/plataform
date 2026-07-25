# HealthScope — Campos opcionales adicionales para Personas

**Fecha:** 2026-07-25
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** pedido explícito de Jose de poder subir más datos de cada persona al importar,
manteniendo el RUT solo hasheado (decisión de privacidad ya tomada en el proyecto, confirmada de
nuevo por Jose — no se toca).

## Alcance: reducido a 3 campos tras una revisión crítica (ver más abajo)

Se agregan 3 campos nuevos, **todos opcionales** (ninguno obligatorio, igual que la mayoría de
los 10 campos actuales del asistente de importación):

- `email`
- `telefono`
- `fechaIngreso` — fecha de contratación/ingreso

El mapeo de columnas ya funciona por nombre de encabezado, no por posición (`suggestColumnMapping`
en `lib/ingestion/columnMapping.ts`), así que el orden del archivo de origen ya no importa hoy —
esto se mantiene igual para los campos nuevos, sin cambios adicionales.

**El RUT sigue sin guardarse en texto plano.** Solo se guarda `rut_hash` (SHA-256), igual que hoy
— decisión de privacidad confirmada explícitamente por Jose en esta conversación, no se reversa.

## Por qué se descartaron nombre, fecha de nacimiento y sexo

El pedido original incluía también `nombre`, `fechaNacimiento` y `sexo`. Jose pidió explícitamente
una revisión crítica de si estos campos realmente sirven para un producto que se va a vender —
no solo si técnicamente se pueden agregar. La conclusión, presentada a Jose y aceptada:

- **Nombre completo**: todo el proyecto está construido sobre el principio de "sin diagnóstico
  individual visible, grupo mínimo para evitar reidentificación" (Ley 21.719) — hoy una persona es
  solo un `codigo` interno, nunca un nombre real ligado a sus episodios de ausencia/salud. Agregar
  nombre en texto plano junto a datos de salud debilitaría el argumento de venta de cumplimiento
  normativo del producto, no lo reforzaría.
- **Fecha de nacimiento y sexo/género**: son datos cuasi-identificadores (combinados con RUT
  hasheado + nombre, casi permiten reconstruir a la persona), y **no existe ningún reporte,
  gráfico o indicador en toda la plataforma que los use hoy** — se estarían guardando sin ningún
  consumidor real, exactamente el patrón de "recolectar por si acaso" que este proyecto ha evitado
  en todos los módulos anteriores.
- **Email, teléfono y fecha de ingreso, en cambio, sí tienen utilidad real o una ruta clara a
  utilidad futura**: contacto directo se conecta con el módulo de Campañas ya existente (poder
  contactar a la persona para una campaña de bienestar/seguimiento); fecha de ingreso permite en
  el futuro cruzar antigüedad con patrones de ausentismo (análisis estándar de RR.HH.), y es un
  dato de bajo riesgo de privacidad (no es un dato de salud).

Si más adelante se necesita nombre/fecha de nacimiento/sexo, es una conversación aparte sobre
postura de privacidad del producto (quién puede verlos, si se protegen de forma distinta), no un
simple campo más del importador.

## Comportamiento en reimportación

Si se sube un archivo más adelante para una persona que ya existe (mismo `rut_hash`), los campos
nuevos **no se actualizan** — se guardan solo la primera vez que se crea la persona (`insert`).
Esto replica el comportamiento ya existente de `unidad_id`/`cargo_id`/`turno_id`, que tampoco se
actualizan en una reimportación — confirmado explícitamente por Jose como el comportamiento
deseado, no una limitación accidental.

## Fuera de alcance

- **No se muestran estos campos en `PersonaDetalleTable`** (la tabla "Detalle por persona" del
  dashboard de Resumen) — esa tabla está armada específicamente para métricas de indicadores
  (días perdidos, episodios, costo estimado), alimentada por `IndicadorPersona`
  (`lib/indicators/porPersona.ts`), no por atributos demográficos de la persona. Mezclar ambas
  cosas es un cambio de diseño aparte, no incluido aquí. Si se necesita ver estos datos en algún
  lugar de la plataforma, es un pedido futuro separado.
- Ninguna validación de formato para `email`/`telefono` más allá de aceptar el texto tal cual —
  son campos opcionales de contacto, no se bloquea la fila si vienen vacíos o con formato
  inconsistente.
- `nombre`, `fechaNacimiento`, `sexo` — descartados, ver sección de arriba.

## Arquitectura

**Schema (`supabase/schema.sql`):** 3 columnas nuevas en `personas`, todas `nullable`:
`email text`, `telefono text`, `fecha_ingreso date`. Mismo patrón de tipos ya usado en el proyecto
(`date` para fechas, igual que `episodios.fecha_inicio`/`fecha_fin`).

**Asistente de importación:**
- `lib/ingestion/columnMapping.ts` — `CANONICAL_FIELDS` gana 3 entradas nuevas; `ALIASES` gana
  las variantes de encabezado esperadas para cada una.
- `components/platform/import/ColumnMappingStep.tsx` — `FIELD_LABELS` gana las 3 etiquetas
  nuevas (sin "(obligatorio)", ya que son opcionales) — el componente ya itera genéricamente
  sobre `CANONICAL_FIELDS`, no necesita más cambios.
- `app/plataforma/importar/page.tsx` — `toMappedRows()` gana 3 líneas más (mismo patrón que las
  10 actuales); el tipo inline extendido con los 3 campos opcionales.
- `app/api/platform/importaciones/ejecutar/route.ts` — el body type gana los 3 campos opcionales;
  el `.insert()` de `personas` (solo para personas nuevas, `!personaId`) gana los 3 valores.

**Testing:** sin tests automatizados nuevos — la lógica de mapeo/inserción ya existente para los
10 campos actuales tampoco tiene tests unitarios dedicados (se prueba end-to-end vía el asistente
real), y estos 3 campos siguen exactamente el mismo patrón. Verificación: 3 casos de prueba reales
subiendo datos simulando una clínica (pedido explícito de Jose, con un enfoque crítico sobre si
los datos capturados realmente sirven para el producto), ejecutados manualmente contra producción
usando su sesión ya autenticada — resultados reportados directamente, no como parte de este plan
de código.
