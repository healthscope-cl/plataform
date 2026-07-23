# HealthScope — Bienestar Preventivo

**Fecha:** 2026-07-23
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 3 ("Bienestar Preventivo": estrés,
fatiga, sueño, clima, carga, liderazgo, conciliación) — octava pieza preventiva del roadmap,
después de encuestas, seguridad laboral, ergonomía, intervenciones, campañas, profesionales y
reportes.

## Decisión de arquitectura: sin tabla nueva, agrega encuestas ya existentes

El catálogo de preguntas de encuestas (`lib/encuestas/catalogo.ts`) ya cubre casi todo el
módulo: `estres`, `fatiga`, `sueno`, `carga`, `liderazgo`, `conciliacion`. Y
`agregarRespuestas()` (`lib/encuestas/agregar.ts`) ya calcula, para un arreglo plano de
respuestas y una lista de `preguntaIds`, el promedio por pregunta con supresión de grupos
pequeños (`MIN_GROUP_SIZE`, `lib/indicators/formulas.ts`) — es genérica respecto a de qué
encuesta viene cada respuesta.

Esto significa que Bienestar Preventivo **no necesita una función de agregación nueva**: es
una página que reúne respuestas de *todas* las encuestas de la empresa (no de una sola, como
hace hoy `/plataforma/encuestas/[id]`) y llama a `agregarRespuestas()` sin modificarla, igual
que Ergonomía reutilizó sin tocar la pregunta `dolor_musculoesqueletico` del mismo catálogo.

No hay modelo de datos nuevo, ni cambio de RLS, ni cambio en `agregarRespuestas`,
`CATALOGO_PREGUNTAS` (salvo la adición descrita abajo), ni en la página de resultados de una
encuesta individual.

## Pregunta de catálogo faltante: "Clima"

El documento pide "clima" como señal de bienestar y el catálogo no la tiene. Se agrega una
entrada más a `CATALOGO_PREGUNTAS` (mismo patrón que las 8 existentes):

```ts
{ id: 'clima', texto: 'Percepción del clima laboral en el equipo' }
```

Esto la deja disponible de inmediato tanto para encuestas nuevas (`EncuestaSheet` ya lista el
catálogo completo sin cambios) como para el dashboard de este módulo.

## Qué preguntas entran en "Bienestar" (y cuáles no)

```ts
export const BIENESTAR_PREGUNTA_IDS = ['estres', 'fatiga', 'sueno', 'carga', 'liderazgo', 'conciliacion', 'clima']
```

Quedan **fuera** de esta lista dos preguntas que ya existen en el catálogo pero pertenecen a
otro módulo por diseño:

- `dolor_musculoesqueletico` — es el indicador propio de Ergonomía (ver su spec, sección de
  "Dolor reportado reutiliza la encuesta existente").
- `pausas_activas` — es más afín a Seguridad Laboral / cumplimiento operacional que a
  bienestar percibido; no se le asigna un hogar en esta fase, queda disponible en el catálogo
  para quien la use en una encuesta ad hoc.

## Alcance de la agregación: toda la empresa, sin ventana temporal, sin segmentación

- **Snapshot acumulado:** se agregan **todas** las respuestas históricas de la empresa a cada
  pregunta de bienestar, sin filtrar por fecha — mismo criterio que el resumen de
  `eventos_seguridad`/`campañas` en el módulo de Reportes (estado actual, no serie temporal).
  Una vez que exista una razón concreta para mostrar evolución mensual, será una fase
  separada.
- **Toda la empresa, no por encuesta:** a diferencia de `/plataforma/encuestas/[id]` (que
  agrega las respuestas de una encuesta puntual), este dashboard agrega respuestas de
  cualquier encuesta de la empresa que haya incluido alguna pregunta de bienestar — sin
  importar el título o propósito con que se creó esa encuesta, porque `Encuesta` no tiene
  ningún campo de categoría/tipo (una encuesta es simplemente un conjunto libre de
  `preguntaIds` elegidos del catálogo).
- **Sin segmentación por sucursal/unidad/cargo/turno:** `encuesta_respuestas` no captura
  ningún dato demográfico (ver su spec original) — no hay forma de segmentar sin cambiar el
  schema, que está explícitamente fuera de alcance aquí.

## Flujo de datos y seguridad

Mismo patrón exacto que `app/plataforma/encuestas/[id]/page.tsx` (auth → verificación de
tenant/empresa → `createAdminClient()` solo para la lectura privilegiada), adaptado a "todas
las encuestas de la empresa" en vez de una sola:

1. `createClient()` + `auth.getUser()` → `redirect('/login')` si no hay sesión.
2. `usuarios` (cliente normal, respeta RLS) → `mapUsuarioRow`.
3. `encuestas` (cliente normal, respeta RLS) filtradas por `empresa_id = usuario.empresaId`,
   trayendo solo `id` — esto determina el conjunto de encuestas cuyas respuestas están
   autorizadas a agregarse aquí.
4. `createAdminClient()` (server-only; `encuesta_respuestas` no tiene SELECT para
   `authenticated` por diseño, mismo motivo documentado en el spec de Encuestas) →
   `encuesta_respuestas` filtradas con `.in('encuesta_id', idsDeLaEmpresa)`. Si
   `idsDeLaEmpresa` está vacío, no se hace esta consulta (evita un `.in()` vacío) y se trata
   como cero respuestas.
5. `agregarRespuestas({ preguntaIds: BIENESTAR_PREGUNTA_IDS, respuestas: filas.map(r =>
   r.respuestas) })`.
6. Igual que en la página de resultados de una encuesta: los datos crudos de
   `encuesta_respuestas` nunca llegan al navegador, solo el resultado ya agregado/suprimido.

## Interfaz

- **`/plataforma/bienestar`** (nueva), listada en el `Sidebar` como "Bienestar preventivo",
  con `adminOnly: true` — mismo nivel de acceso que "Encuestas", porque expone (aunque
  agregado y con supresión) señales sensibles de clima/estrés del personal, no una vista
  puramente operacional como "Resumen"/"Reportes".
- Contenido: una tarjeta por pregunta de `BIENESTAR_PREGUNTA_IDS`, con el mismo diseño visual
  que ya usa `/plataforma/encuestas/[id]` (texto de la pregunta, promedio `/5` + cantidad, o
  "Grupo insuficiente para mostrar" si está suprimida). Sin formulario, sin acciones de
  escritura — página de presentación pura, igual que Reportes.
- Sin selector de período, sin filtros, sin botón de impresión (eso ya lo resuelve
  `/plataforma/reportes` para la vista ejecutiva; este módulo no lo duplica).

## Testing

- Sin función pura nueva — se reutiliza `agregarRespuestas()` tal cual, que ya tiene su propia
  suite de pruebas (5/5, ver Task 2 de Encuestas). No hace falta duplicar esa cobertura aquí.
- Sin prueba automatizada para la página, mismo patrón ya establecido en el resto del
  proyecto.
- Verificación manual explícita (controller-only, sin tocar la BD real más allá de
  lectura): con datos reales de HealthScope Demo, confirmar que el promedio mostrado
  coincide con un cálculo manual sobre las respuestas reales de `encuesta_respuestas`, y que
  una pregunta con menos de `MIN_GROUP_SIZE` respuestas en total se muestra correctamente
  suprimida.

## Explícitamente fuera de alcance (fases posteriores)

- Evolución temporal / tendencia mensual de cada indicador de bienestar — snapshot acumulado
  únicamente en esta fase (ver arriba).
- Segmentación por sucursal/unidad/cargo/turno — la tabla base no captura esos datos por
  diseño de privacidad.
- Uso de estos indicadores como dimensión del índice de suficiencia de datos
  (`lib/suficiencia/calcular.ts`) — ya estaba marcado como fuera de alcance en el spec
  original de Encuestas, se mantiene así aquí también.
- Alertas basadas en umbrales de bienestar (ej. "fatiga promedio subió") — el motor de
  `reglas_alerta` existente no tiene ningún vínculo con preguntas de encuestas hoy; conectarlo
  sería una extensión de ese módulo, no de este.
- Recomendaciones automáticas (ej. sugerir una campaña de pausas activas cuando fatiga es
  alta) — corresponde al "motor de recomendaciones" de la sección 10 del documento, que no
  existe todavía como pieza propia.
