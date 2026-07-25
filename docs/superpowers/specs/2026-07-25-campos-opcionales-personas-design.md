# HealthScope — Campos opcionales adicionales para Personas

**Fecha:** 2026-07-25
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** pedido explícito de Jose de poder subir más datos de cada persona al importar
(nombre, fecha de nacimiento, etc.), manteniendo el RUT solo hasheado (decisión de privacidad ya
tomada en el proyecto, confirmada de nuevo por Jose — no se toca).

## Alcance

Se agregan 6 campos nuevos, **todos opcionales** (ninguno obligatorio, igual que la mayoría de
los 10 campos actuales del asistente de importación):

- `nombre` — nombre completo
- `fechaNacimiento` — fecha de nacimiento
- `sexo` — sexo/género (texto libre, sin lista fija — para no rechazar datos válidos de una
  clínica real que use su propia terminología)
- `email`
- `telefono`
- `fechaIngreso` — fecha de contratación/ingreso

El mapeo de columnas ya funciona por nombre de encabezado, no por posición (`suggestColumnMapping`
en `lib/ingestion/columnMapping.ts`), así que el orden del archivo de origen ya no importa hoy —
esto se mantiene igual para los campos nuevos, sin cambios adicionales.

**El RUT sigue sin guardarse en texto plano.** Solo se guarda `rut_hash` (SHA-256), igual que hoy
— decisión de privacidad confirmada explícitamente por Jose en esta conversación, no se reversa.

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
- Sin lista fija de valores válidos para `sexo` — texto libre.

## Arquitectura

**Schema (`supabase/schema.sql`):** 6 columnas nuevas en `personas`, todas `nullable`:
`nombre text`, `fecha_nacimiento date`, `sexo text`, `email text`, `telefono text`,
`fecha_ingreso date`. Mismo patrón de tipos ya usado en el proyecto (`date` para fechas, igual que
`episodios.fecha_inicio`/`fecha_fin`).

**Asistente de importación:**
- `lib/ingestion/columnMapping.ts` — `CANONICAL_FIELDS` gana 6 entradas nuevas; `ALIASES` gana
  las variantes de encabezado esperadas para cada una (ej. `nombre`: "nombre", "nombre completo",
  "nombre trabajador").
- `components/platform/import/ColumnMappingStep.tsx` — `FIELD_LABELS` gana las 6 etiquetas
  nuevas (sin "(obligatorio)", ya que son opcionales) — el componente ya itera genéricamente
  sobre `CANONICAL_FIELDS`, no necesita más cambios.
- `app/plataforma/importar/page.tsx` — `toMappedRows()` gana 6 líneas más (mismo patrón que las
  10 actuales); el tipo inline extendido con los 6 campos opcionales.
- `app/api/platform/importaciones/ejecutar/route.ts` — el body type gana los 6 campos opcionales;
  el `.insert()` de `personas` (solo para personas nuevas, `!personaId`) gana los 6 valores.

**Testing:** sin tests automatizados nuevos — la lógica de mapeo/inserción ya existente para los
10 campos actuales tampoco tiene tests unitarios dedicados (se prueba end-to-end vía el asistente
real), y estos 6 campos siguen exactamente el mismo patrón. Verificación: 3 casos de prueba reales
subiendo datos simulando una clínica (pedido explícito de Jose), ejecutados manualmente contra
producción usando su sesión ya autenticada — resultados reportados directamente, no como parte de
este plan de código.
