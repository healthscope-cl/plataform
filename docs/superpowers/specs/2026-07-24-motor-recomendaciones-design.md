# HealthScope — Motor de Recomendaciones

**Fecha:** 2026-07-24
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, sección 10 ("Motor de Recomendaciones") — la
única pieza transversal que quedó explícitamente fuera de alcance en los 15 módulos del
roadmap (sección 8), ahora que todos están completos.

## Decisión de alcance: 4 señales simplificadas a lo que es calculable hoy

El documento da 4 ejemplos de señal→acciones. Dos de ellos piden datos que ningún módulo de
este proyecto calcula todavía:

- *"Aumento de fatiga en turno **nocturno**"* — pide segmentar por turno. Bienestar
  Preventivo decidió explícitamente **no segmentar** (ver su spec). Simplificado a **"Fatiga
  elevada"**, empresa completa, sin segmentar — mismo alcance que ya tiene Bienestar
  Preventivo.
- *"**Incremento** de incidentes"* — pide comparar períodos. Ningún módulo de este roadmap
  calcula una tendencia; todos son snapshots del estado actual. Esta es la única señal que
  necesita lógica genuinamente nueva: comparar el conteo de `eventos_seguridad` de los
  últimos 3 meses contra los 3 meses anteriores.

Las otras dos ejemplos ya son calculables tal cual con datos que ya existen:

- *"Molestias lumbares elevadas"* → promedio de la pregunta `dolor_musculoesqueletico` de
  Bienestar Preventivo.
- *"Alta tensión psicosocial"* → promedio de la pregunta `estres` de Bienestar Preventivo.

Las acciones sugeridas por señal, la justificación y las limitaciones vienen **verbatim** del
propio documento — no se inventan acciones nuevas.

## Arquitectura: reuso de `agregarRespuestas()` para 3 señales, una función nueva para la cuarta

**Señales 1-3 (Fatiga elevada, Molestias lumbares elevadas, Alta tensión psicosocial):**
mismo mecanismo exacto que ya usa `/plataforma/bienestar` — `agregarRespuestas()`
(`lib/encuestas/agregar.ts`, **sin modificar**) sobre todas las respuestas de todas las
encuestas de la empresa (vía `createAdminClient()`, mismo patrón ya revisado en Bienestar
Preventivo y en los reportes de Campañas). Cada señal se considera "activa" cuando el
promedio de su pregunta es `>= 3.5` (escala 1-5) — un umbral fijo simple, no un modelo de
IA/scoring. Si la pregunta está suprimida por `MIN_GROUP_SIZE` o sin datos, la señal se
muestra como "sin datos suficientes para evaluar", nunca como falsamente activa o inactiva.

**Señal 4 (Incremento de incidentes):** función pura nueva,
`lib/recomendaciones/incidentes.ts` — `huboIncrementoIncidentes(input: { fechas: string[];
fechaCorte: string }): { actual: number; anterior: number; incremento: boolean }`. Cuenta
cuántas fechas de `eventos_seguridad` caen en los 3 meses antes de `fechaCorte` ("actual") y
cuántas en los 3 meses anteriores a esos ("anterior"), y marca `incremento: true` si
`actual > anterior`. Sin `MIN_GROUP_SIZE` — mismo criterio ya usado para conteos de
`eventos_seguridad` en todo el proyecto (son eventos administrativos, no respuestas
individuales de encuesta). Esta es la primera función de comparación de períodos de todo el
proyecto — con sus propias pruebas unitarias (TDD), incluyendo el caso límite de una fecha
exactamente en el borde entre "actual" y "anterior".

Las señales 1-3 no necesitan una función nueva — son una comparación trivial
`promedio >= 3.5`, escrita directamente en la página, mismo criterio ya usado en otras
páginas de este proyecto para no sobre-construir pruebas para lógica sin complejidad real.

## Contenido de cada tarjeta (los 7 campos que pide el documento)

1. **Evidencia** (dato real, no texto fijo): para las señales 1-3, el promedio calculado y la
   cantidad de respuestas (ej. "Promedio actual: 3.8 / 5, basado en 14 respuestas"). Para la
   señal 4, los conteos actual/anterior (ej. "8 incidentes en los últimos 3 meses, frente a 5
   en los 3 meses anteriores").
2. **Nivel de confianza** (texto fijo por señal): calificación cualitativa simple ("Media" —
   dato autoreportado o administrativo, no un diagnóstico clínico).
3. **Justificación** (texto fijo, tomado del documento): por qué esta señal implica estas
   acciones.
4. **Limitaciones** (texto fijo por señal): ej. "no segmentado por turno, área ni sucursal" /
   "basado en encuesta autoreportada, no en evaluación clínica" / "sujeto a supresión de
   grupo pequeño, que puede ocultar el resultado real".
5. **Responsable sugerido** (texto fijo por señal): ej. "Prevención de riesgos", "Salud
   ocupacional", "RR.HH.".
6. **Indicador a medir** (texto fijo por señal): qué seguir a futuro para confirmar si la
   acción funcionó (ej. "promedio de fatiga en la próxima medición").
7. **Revisión humana** (texto fijo, idéntico en las 4 tarjetas): *"Esta es una sugerencia
   basada en reglas fijas, no un diagnóstico — debe ser evaluada por un profesional antes de
   implementarse."*

Cada tarjeta muestra también la lista de acciones sugeridas (verbatim del documento) y un
badge de estado: "Activa" (umbral cruzado / incremento detectado), "No activa", o "Sin datos
suficientes".

## Interfaz y acceso

- **`/plataforma/recomendaciones`** (nueva). Entrada de navegación "Recomendaciones" con
  `adminOnly: true` — mismo nivel de acceso que Bienestar Preventivo, Ergonomía y Seguridad
  Laboral, ya que agrega los mismos datos sensibles que esos módulos.
- Las 4 señales se muestran siempre (activas o no), mismo patrón ya usado en Integraciones
  para sus 8 fuentes — transparencia total, no se ocultan señales inactivas.
- Sin formulario, sin filtros, sin acción de "marcar como revisada" — no se agrega una tabla
  de seguimiento de estado en esta fase (ver fuera de alcance).

## Testing

- `huboIncrementoIncidentes()`: pruebas unitarias reales (TDD) — incremento correcto cuando
  actual > anterior, sin incremento cuando actual <= anterior, caso límite de una fecha
  exactamente en el borde de los 3 meses (debe caer de un lado, no contarse en ambos ni en
  ninguno).
- Sin prueba automatizada para la página — mismo patrón ya establecido en el resto del
  proyecto.
- Verificación manual explícita (controller-only): confirmar que el promedio mostrado para
  cada una de las 3 señales de encuesta coincide con un cálculo manual sobre
  `encuesta_respuestas` reales, y que el conteo de incidentes actual/anterior coincide con un
  conteo manual sobre `eventos_seguridad`.

## Explícitamente fuera de alcance (fases posteriores)

- Segmentación por turno/sucursal/área en cualquiera de las 4 señales.
- Cualquier modelo de IA/machine learning para detectar señales o generar recomendaciones —
  el motor completo es reglas fijas con umbrales explícitos, coherente con el resto del
  proyecto.
- Seguimiento de si una recomendación fue "revisada" o "implementada" — no se agrega tabla ni
  estado persistente para esto en esta fase.
- Catálogo de señales configurable por el usuario (agregar/editar señales o umbrales desde la
  UI) — las 4 señales y sus umbrales son fijos en el código en esta fase.
- Vincular esto a `reglas_alerta`/`evaluarReglas` (el motor de alertas de ausentismo) — son
  sistemas independientes; unificarlos sería una refactorización mayor sin necesidad clara
  todavía.

Con este módulo, la sección 10 del documento — la última pieza explícitamente pendiente de
todo `referencia/instrucciones2.txt` — queda atendida.
