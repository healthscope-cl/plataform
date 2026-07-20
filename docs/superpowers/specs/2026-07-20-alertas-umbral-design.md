# HealthScope — Alertas configurables por umbral (Fase 2)

**Fecha:** 2026-07-20
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** el dashboard de indicadores (filtros + vista por persona, ya en producción)
resolvía "ver los datos", pero no "que el sistema avise". Esta es la Fase 2 del roadmap
acordado con el usuario tras el análisis de brecha entre lo que promete el sitio público y lo
que existe hoy: alertas configurables por umbral, la primera pieza de "actuar" en el ciclo
detectar → actuar → medir.

## Contexto

La plataforma ya calcula 6 indicadores por empresa (`computeIndicadores`,
`lib/indicators/aggregate.ts`) y, desde la fase anterior, puede recalcularlos filtrados por
sucursal/unidad/cargo/turno (`filtrarPersonas`, `lib/indicators/filtroPersonas.ts`) en el
cliente. Esta fase reutiliza esa misma infraestructura de cálculo — una alerta no es más que
"¿el valor de este indicador, en este ámbito, supera este umbral?", evaluado con las mismas
funciones puras ya construidas y revisadas.

No existe ninguna infraestructura de envío de correo/push en este proyecto — se confirmó
revisando `package.json` y el árbol de `lib/`. Construir eso ahora sería agregar una
integración externa nueva (proveedor de email, claves, límites de envío) para una función que
el usuario no ha validado que necesita. Por eso esta fase es deliberadamente **alertas en la
aplicación, evaluadas cuando se visita el dashboard** — no notificaciones push ni email, no
evaluación programada en segundo plano, no historial persistente de disparos. Cada una de esas
tres cosas es una fase futura razonable si esta primera versión resulta útil, no una que se
decide ahora.

## Modelo de datos

Tabla nueva `reglas_alerta`, siguiendo exactamente el mismo patrón de las tablas existentes
(RLS + políticas + grants en el mismo bloque, `tenant_id` + `empresa_id` en toda fila):

```sql
create table reglas_alerta (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  nombre text not null,
  indicador text not null check (indicador in (
    'tasaAusentismo', 'frecuencia', 'severidad', 'duracionPromedio', 'reincidencia', 'costoEstimado'
  )),
  operador text not null check (operador in ('mayor_que', 'mayor_o_igual')),
  umbral numeric not null,
  sucursal_id uuid references sucursales(id) on delete set null,
  unidad_id uuid references unidades(id) on delete set null,
  cargo_id uuid references cargos(id) on delete set null,
  turno_id uuid references turnos(id) on delete set null,
  activa boolean not null default true
);
```

- `indicador` reutiliza literalmente las 6 claves de `IndicadorResultados` (mismo string, sin
  traducir) — así la evaluación no necesita una tabla de mapeo adicional.
- El ámbito (`sucursal_id`/`unidad_id`/`cargo_id`/`turno_id`) es la misma forma que
  `FiltroGrupo` (`lib/indicators/filtroPersonas.ts`), todos opcionales — una regla sin ámbito
  aplica a toda la empresa. No hay una columna "tipo de ámbito" separada: los cuatro campos
  opcionales, igual que el filtro del dashboard, y la evaluación reutiliza `filtrarPersonas`
  directamente con el mismo shape.
- Solo `superadmin`/`admin_cliente` pueden crear/editar reglas (política `insert`/`update`
  igual a `lineas_base_insert_admin`); cualquier usuario autenticado del tenant puede leerlas
  (`select`), porque el banner de alertas en el dashboard es visible para todos los roles, no
  solo admins — a diferencia de la tabla de detalle por persona, una alerta ya es un dato
  agregado sin riesgo de reidentificación.

## Evaluación (pura, sin base de datos)

`lib/alertas/evaluar.ts` — función pura nueva, misma familia que `computeIndicadores`:

- Input: la lista de reglas activas de la empresa, más los mismos `personas`/`episodios` ya
  cargados en el dashboard (no una consulta nueva — el Server Component de `/plataforma/resumen`
  ya los tiene).
- Para cada regla: filtra `personas`/`episodios` por su ámbito (reutilizando `filtrarPersonas`
  tal cual, con los 4 campos de la regla como `FiltroGrupo`), llama a `computeIndicadores` sobre
  ese subconjunto, lee el valor del indicador de la regla, y compara contra el umbral con el
  operador de la regla.
- Una regla cuyo indicador resultó `{ suprimido: true }` (grupo pequeño) nunca se evalúa como
  disparada — no hay valor con el que comparar, y mostrar una alerta sobre un número oculto por
  protección de reidentificación contradiría el propósito de esa protección.
- Salida: la lista de reglas disparadas, cada una con el valor actual que la disparó (para
  mostrarlo en el banner, con la misma auditabilidad — nunca un número sin contexto — que ya
  exige el resto del dashboard).

## Interfaz

- **`/plataforma/alertas`** (nueva, solo admins, mismo patrón que Organización): tabla de
  reglas existentes + un `Sheet` de creación/edición (react-hook-form + zod, mismo patrón que
  `SucursalSheet.tsx`) con: nombre, selector de indicador, selector de operador, umbral
  (input numérico), y los mismos 4 selectores de ámbito ya usados en `ResumenInteractivo.tsx`
  (con la misma cascada sucursal→unidad). Activar/desactivar sin borrar (toggle sobre
  `activa`). Toda creación/edición pasa por `logAudit`, igual que el resto de Organización.
- **Banner en `/plataforma/resumen`**: si hay una o más reglas disparadas, una franja visible
  arriba de las tarjetas (antes de los filtros), listando cada alerta ("Tasa de ausentismo en
  Ventas (Santiago Centro): 8.2% — supera el umbral de 5%"). Visible para todos los roles (ver
  modelo de datos). Si el usuario aplica un filtro manual en el dashboard, el banner no cambia
  — evalúa siempre contra el ámbito propio de cada regla, no contra el filtro que el usuario
  tenga seleccionado en ese momento (son dos cosas independientes).
- Ítem nuevo en el sidebar (`components/platform/Sidebar.tsx`), `adminOnly: true` solo para el
  link de gestión (`/plataforma/alertas`) — el banner del dashboard en sí es visible para todos
  sin necesitar el link del menú.

## Testing

- `lib/alertas/evaluar.ts`: pruebas unitarias puras — regla sin ámbito (toda la empresa), regla
  con ámbito (solo dispara si el subconjunto filtrado supera el umbral, no si el total de la
  empresa lo supera pero el subconjunto no), regla sobre un indicador suprimido (nunca dispara),
  operador `mayor_que` vs `mayor_o_igual` en el valor límite exacto, múltiples reglas
  evaluadas independientemente.
- Sin prueba automatizada para la página/Sheet de gestión ni el banner (mismo patrón ya
  establecido en este proyecto: solo funciones puras de `lib/` se prueban con Vitest,
  integración se verifica manualmente).

## Explícitamente fuera de alcance (fases posteriores)

- Notificaciones por correo o push — requiere elegir e integrar un proveedor de email nuevo.
- Evaluación programada en segundo plano (cron) — hoy se evalúa solo al visitar el dashboard.
- Historial persistente de cuándo se disparó cada alerta — se calcula en vivo, no se guarda.
- Reglas sobre indicadores por persona (la vista de detalle de la Fase 1) — esta fase solo
  cubre los 6 indicadores agregados.
