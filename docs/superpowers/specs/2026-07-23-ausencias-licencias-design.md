# HealthScope — Ausencias y Licencias

**Fecha:** 2026-07-23
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 2 ("Ausencias y Licencias": Registros,
Estados, Tipos, Duración, Reincidencia, Evolución) — novena pieza preventiva del roadmap,
después de encuestas, seguridad laboral, ergonomía, intervenciones, campañas, profesionales,
reportes y bienestar preventivo.

## Decisión de arquitectura: sin tabla nueva, expone `episodios` tal cual existe

El dato ya existe completo desde la fase de ingesta (`docs/superpowers/plans/2026-07-17-data-ingestion-mvp-implementation.md`):
la tabla `episodios` guarda, por cada licencia/ausencia, `persona_id`, `tipo_administrativo_id`,
`fecha_inicio`, `fecha_fin`, `dias`, `clasificacion_analitica` y `estado`. Lo que falta no es
dato — es una vista que lo muestre a nivel de registro individual.

Esto es distinto de lo que ya existe hoy en `/plataforma/resumen`: `PersonaDetalleTable`
(fase "Dashboard Drilldown") ya muestra una fila **por persona**, agregando todos sus
episodios en `diasPerdidos`/`cantidadEpisodios`/`costoEstimado`. Este módulo agrega la vista
que falta — una fila **por episodio** — sin duplicar ni modificar esa tabla ni
`computeIndicadoresPorPersona()`.

No hay modelo de datos nuevo, ni cambio de RLS. `episodios_select_same_tenant` (`for select to
authenticated using (...)`, ver `supabase/schema.sql`) ya permite a cualquier usuario
autenticado del tenant leer estas filas — no hace falta `createAdminClient()` aquí, a
diferencia del módulo de Bienestar Preventivo (esa restricción era específica de
`encuesta_respuestas`, no aplica a `episodios`).

## "Reincidencia" ya está calculada — no hay que construir nada nuevo

El motor de clasificación de la fase de ingesta (`lib/ingestion/classification.ts` /
`clasificarEpisodio()`) ya asigna `clasificacionAnalitica` con valores que incluyen
`'recurrente'` y `'continuacion'` junto con `'corto'`, `'mediano'`, `'prolongado'`,
`'accidente'`, `'enfermedad_profesional'`, `'maternal'`, `'cuidado_familiar'`,
`'sin_clasificar'`, `'calidad_insuficiente'`. Mostrar esta columna en la tabla de registros
**es** la exposición de "reincidencia" que pide el documento — no se necesita ningún cálculo
adicional ni una nueva pasada sobre los datos.

## Alcance de la consulta: los 200 más recientes, sin filtro de período

Mismo patrón exacto que `/plataforma/auditoria` (`order by created_at desc` +
`.limit(200)`) — la única página de este proyecto que ya lista una cantidad potencialmente
grande de filas sin construir paginación real. Se aplica igual aquí: `order by fecha_inicio
desc` + `.limit(200)`, sin ventana de fecha fija (a diferencia de los indicadores de
`/plataforma/resumen`, que sí usan un período de 6 meses porque calculan tasas — este módulo
es un listado de auditoría/exploración, no un cálculo de indicadores).

## Filtros: tipo administrativo y estado, sobre los datos ya traídos

Dos `<select>` (tipo administrativo, estado) filtrando en memoria el arreglo ya recibido del
servidor — mismo patrón de filtrado client-side sin ida y vuelta al servidor que ya usa
`ResumenInteractivo`. **Sin filtro por sucursal/unidad/cargo/turno en esta fase** — esa
segmentación ya existe a nivel agregado en el drill-down de Resumen; añadirla aquí también
sería duplicar esa capacidad en dos lugares para un beneficio marginal. **Sin búsqueda por
código de persona** — con el tope de 200 filas, no se justifica un tercer control de filtro
en esta primera versión.

## Columnas y privacidad

Persona: solo `codigo` (nunca `rut_hash` ni nada derivado del RUT) — mismo nivel de
exposición que ya existe en "Historial de importaciones" y en `PersonaDetalleTable`. Tipo
administrativo, fechas, días, estado, clasificación analítica: estos son exactamente los
campos **administrativos** que el diseño de datos de este proyecto separa deliberadamente de
cualquier dato clínico (no hay diagnóstico, código clínico, ni nota de atención en
`episodios` — nunca existió esa columna). Mostrar `tipo_administrativo` (p. ej.
"accidente_laboral", "maternal") no es una fuga de información clínica: es la misma categoría
administrativa con la que ya opera todo el motor de clasificación desde el día uno.

**Sin supresión de grupo pequeño (`MIN_GROUP_SIZE`):** mismo razonamiento ya usado para
`PersonaDetalleTable` — cada fila es intrínsecamente de una sola persona, no un agregado; la
protección de grupo pequeño existe para vistas agregadas que podrían reidentificar
indirectamente a alguien a partir de un porcentaje, no para una herramienta operativa que ya
administra a esas personas directamente.

## Interfaz y acceso

- **`/plataforma/ausencias`** (nueva). Entrada de navegación "Ausencias y licencias" con
  `adminOnly: true` en el `Sidebar` — mismo patrón que **todas** las páginas admin-only ya
  existentes en este proyecto (Encuestas, Alertas, Seguridad laboral, Ergonomía,
  Intervenciones, Campañas, Profesionales, Bienestar preventivo): el link se oculta para
  roles no-admin en el sidebar, pero la página misma no repite el chequeo de rol
  server-side — consistente con ese precedente, no un caso especial nuevo.
  (`PersonaDetalleTable` sí hace un chequeo de rol explícito en el componente, pero eso es
  porque vive dentro de una página — `/plataforma/resumen`— que roles no-admin sí pueden
  visitar; este módulo es una página propia gateada por el Sidebar como las demás, no un
  componente embebido en una página de acceso mixto.)
- Sin formulario de creación, sin acciones de edición/eliminación — los episodios solo se
  crean o revierten a través del asistente de importación (`/plataforma/importar`) y su
  historial (`/plataforma/importar/historial`); esta página es puramente de lectura.

## Testing

- Sin función pura nueva — el filtrado por tipo/estado es una reducción trivial sobre un
  arreglo ya tipado, mismo criterio ya aplicado en el resto del proyecto para no probar por
  separado cálculos sin complejidad real.
- Sin prueba automatizada para la página ni el componente de tabla, mismo patrón ya
  establecido en el resto del proyecto.
- Verificación manual explícita (controller-only): con datos reales de HealthScope Demo,
  confirmar que el conteo de filas mostrado coincide con un conteo manual de `episodios` de
  esa empresa, que los filtros de tipo/estado funcionan correctamente, y que un usuario
  no-admin no ve el link "Ausencias y licencias" en el sidebar.

## Explícitamente fuera de alcance (fases posteriores)

- Evolución mensual (conteo de licencias/días por mes) — decisión de alcance explícita
  acordada con el usuario; puede construirse como extensión separada si se necesita.
- Filtro por período (rango de fechas) y por sucursal/unidad/cargo/turno — la segmentación
  organizacional ya existe a nivel agregado en el drill-down de Resumen.
- Paginación real (más allá del tope de 200 filas más recientes).
- Búsqueda por código de persona.
- Cualquier acción de escritura sobre `episodios` desde esta página — se mantienen como el
  único punto de mutación el asistente de importación y su reversión.
