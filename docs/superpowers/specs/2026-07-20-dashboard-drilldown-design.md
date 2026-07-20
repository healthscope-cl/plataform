# HealthScope — Desglose por persona y filtros por grupo en el dashboard de indicadores

**Fecha:** 2026-07-20
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** el dashboard de indicadores (`2026-07-19-indicators-dashboard-implementation.md`)
quedó funcionando pero mostraba solo 6 números agregados de toda la empresa, sin forma de
cortar los datos por nada — "no puedo hacer nada con esos datos". Este spec es la Fase 1 de
cerrar esa brecha, sin construir nada que la página de marketing promete pero que depende de
entidades que no existen todavía (alertas, planes de acción, campañas — quedan para fases
posteriores).

## Contexto

Al revisar el código se encontraron dos hechos que cambian el orden de trabajo:

1. **`personas` no tiene ninguna vinculación organizacional poblada hoy.** La tabla sí tiene
   columnas `unidad_id`, `cargo_id`, `turno_id` (de la etapa de plataforma base), pero el
   endpoint de ejecución de importaciones (`app/api/platform/importaciones/ejecutar/route.ts`)
   nunca las usa al crear una persona — solo guarda `codigo` y `rut_hash`. Es decir: aunque
   hoy se construyeran filtros por sucursal/unidad/cargo/turno, no tendrían con qué filtrar.
2. **No existe vínculo a centro de costo en absoluto** — ni columna en `personas` ni forma de
   asignarlo. Agregarlo requiere una migración de esquema nueva; queda **fuera de esta fase**
   explícitamente (ver "Explícitamente fuera de alcance").

Por eso esta fase se divide en dos partes dependientes en el orden correcto: primero lo que
ya funciona con los datos que existen (1A), después lo que requiere que el asistente de
importación capture datos nuevos (1B).

## Decisión de acceso (confirmada por el usuario)

La vista de detalle por persona (1A) queda **solo para `superadmin` y `admin_cliente`** en
esta fase — mismo nivel de acceso que ya tiene "Guardar línea base". Abrir esto a
`rrhh_corporativo`/`rrhh_local`/`jefatura` queda como una decisión de negocio a revisar en una
fase posterior, no se construye ahora.

## Arquitectura general

`app/plataforma/resumen/page.tsx` deja de ser un Server Component que renderiza directamente
el HTML final. Pasa a:

- **Server Component (sigue siendo `page.tsx`):** hace exactamente las mismas consultas que
  hoy (personas, episodios de los últimos 6 meses, última línea base) **más** los catálogos
  de `sucursales`/`unidades`/`cargos`/`turnos` de la empresa. Le entrega todo eso, ya
  mapeado, a un Client Component nuevo.
- **Client Component nuevo (`components/platform/dashboard/ResumenInteractivo.tsx`):**
  mantiene el estado de los 4 filtros (sucursal/unidad/cargo/turno, cada uno con "Todos" por
  defecto) y, cada vez que cambian, vuelve a llamar a `computeIndicadores()` y a la nueva
  función por-persona **en el navegador**, filtrando primero el arreglo de personas/episodios
  ya recibido del servidor. No hay ida y vuelta al servidor por cada cambio de filtro — las
  fórmulas ya son funciones puras sobre datos que ya están en memoria del cliente.

**Línea base y "cambio" siguen siendo solo a nivel de toda la empresa.** Cuando hay un filtro
activo, las 6 tarjetas muestran el valor en vivo del grupo filtrado, pero sin porcentaje de
cambio (comparar un subgrupo contra una línea base de toda la empresa no sería una
comparación válida). Esto se anuncia en la interfaz ("La comparación con línea base solo está
disponible sin filtros"), no se oculta silenciosamente.

**Supresión de grupos pequeños:** no se toca la regla existente (`MIN_GROUP_SIZE = 5`) — al
filtrar a un grupo con menos de 5 personas, las tarjetas ya muestran automáticamente "Grupo
insuficiente para mostrar", que es exactamente el comportamiento correcto para este caso.

## 1A — Vista de detalle por persona

**Qué se agrega:**

- `lib/indicators/porPersona.ts` — función pura nueva, `computeIndicadoresPorPersona(input)`,
  que recibe las mismas filas de personas/episodios que ya usa `computeIndicadores()` y
  devuelve un arreglo con una entrada por persona activa: `codigo`, `diasPerdidos`,
  `cantidadEpisodios`, `costoEstimado`. No aplica `MIN_GROUP_SIZE` (cada fila ya es
  intrínsecamente una sola persona, no un agregado — la protección de grupo pequeño no aplica
  a este tipo de vista, que es una herramienta operativa para quien ya administra a esas
  personas, no un reporte agregado de exposición pública).
- `components/platform/dashboard/PersonaDetalleTable.tsx` — tabla ordenable (por defecto,
  costo estimado descendente, para que el mayor gasto salte a la vista primero), visible
  debajo de las 6 tarjetas, **solo si el rol del usuario es admin** (ver decisión de acceso
  arriba). Nunca muestra el RUT — solo `codigo`, que es el mismo nivel de exposición que ya
  existe hoy en "Historial de importaciones".
- La tabla respeta los filtros de 1B cuando estén activos (misma fuente de datos ya filtrada
  que alimenta las 6 tarjetas).

## 1B — Filtros por sucursal, unidad, cargo y turno

**Parte 1 — extender el asistente de importación** (`lib/ingestion/columnMapping.ts`,
`app/plataforma/importar/*`, `app/api/platform/importaciones/ejecutar/route.ts`):

- Se agregan 4 campos canónicos nuevos: `sucursal`, `unidad`, `cargo`, `turno`, con alias de
  columna igual de permisivos que los campos existentes (ej. `unidad` acepta "Unidad", "Área",
  "Departamento").
- Al ejecutar la importación, cada valor de texto se compara contra el catálogo existente de
  la empresa (`sucursales`/`unidades`/`cargos`/`turnos`), con la misma normalización
  insensible a mayúsculas/acentos que ya usa `suggestColumnMapping`. Si hay coincidencia, la
  persona queda vinculada (`unidad_id`, `cargo_id`, `turno_id`). Si no hay coincidencia, la
  fila no se rechaza — queda como **advertencia** (no crítica) tipo `grupo_no_reconocido`
  ("La unidad 'X' no existe en el catálogo; la persona quedará sin unidad asignada"), y la
  persona se importa sin ese vínculo. **No se crea automáticamente un registro nuevo en el
  catálogo** — eso podría llenar Organización de variantes con errores de tipeo; si falta un
  catálogo, el admin lo crea a mano en Organización (ya existe esa pantalla) y puede corregir
  el dato con una re-importación o edición futura de personas (edición manual de persona
  queda fuera de esta fase — ver "Explícitamente fuera de alcance").
- Nota sobre sucursal: como `unidades.sucursal_id` ya vincula unidad → sucursal, mapear
  "Unidad" es suficiente para poder filtrar por sucursal indirectamente (se deriva con un
  join, no se guarda un `sucursal_id` redundante en `personas`).

**Parte 2 — filtros en el dashboard:**

- 4 selectores en `ResumenInteractivo.tsx`: Sucursal, Unidad, Cargo, Turno, cada uno con
  "Todos" por defecto. Elegir una Sucursal filtra las opciones de Unidad a las que pertenecen
  a esa sucursal (evita mostrar combinaciones imposibles).
- Los filtros afectan tanto las 6 tarjetas como la tabla por persona (1A) al mismo tiempo —
  una sola fuente de verdad del filtro.

## Testing

- `porPersona.ts`: pruebas unitarias puras, mismo patrón que `formulas.ts`/`aggregate.ts` —
  casos con 0 episodios, con múltiples episodios, verificando que no se aplica supresión de
  grupo pequeño.
- Extensión de `columnMapping.ts`: pruebas para los 4 alias nuevos, siguiendo el patrón ya
  existente en `columnMapping.test.ts`.
- Extensión de `validate.ts` o el punto donde se resuelve el catálogo: prueba de que un valor
  sin coincidencia produce advertencia (no crítico) y no bloquea la fila.
- El filtrado en `ResumenInteractivo.tsx` se prueba mejor con una prueba unitaria de la
  función de filtrado pura (extraída, no probada a través de render de React), siguiendo el
  mismo principio de "lógica pura, testeable sin base de datos ni DOM" del resto del proyecto.

## Explícitamente fuera de alcance (fase posterior)

- **Centro de costo** como filtro — requiere agregar `centro_costo_id` a `personas` (columna
  nueva + migración) y extender el asistente de importación otra vez; se deja para una fase
  separada para no mezclar una migración de esquema con esta fase.
- **Edición manual de la vinculación organizacional de una persona ya importada** — hoy la
  única forma de vincular unidad/cargo/turno es en el momento de importar; corregir a una
  persona ya cargada requiere una pantalla de edición que no existe. Se puede resolver
  reimportando con el dato corregido, o como una fase futura de UI de edición de personas.
- **Abrir la vista por persona a roles no-admin** (`rrhh_corporativo`, `rrhh_local`,
  `jefatura`) — decisión de negocio pendiente, no técnica.
- **Línea base por grupo filtrado** — la comparación de cambio sigue siendo solo a nivel de
  toda la empresa en esta fase.
- **Alertas por umbral y planes de acción con seguimiento** — Fase 2 y 3 de la hoja de ruta
  acordada con el usuario, entidades completamente nuevas, no tocadas por este spec.
