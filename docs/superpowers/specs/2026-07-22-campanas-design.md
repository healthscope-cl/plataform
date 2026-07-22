# HealthScope — Campañas

**Fecha:** 2026-07-22
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 9 ("Campañas": bienestar, salud mental,
ergonomía, vacunación, pausas activas, prevención, sueño, alimentación, liderazgo) — quinta
pieza preventiva del roadmap, después de encuestas, seguridad laboral, ergonomía e
intervenciones.

## Decisión de alcance: sin medición cuantitativa antes/después

El documento describe, en una sección separada ("Medición de campañas"), un modelo que
compara indicadores (encuestas, molestias, incidentes, cumplimiento, participación) antes y
después de cada campaña, con cifras de ejemplo ("40% declara molestias lumbares" → "26%
después de la campaña"). Esta fase **no construye esa comparación cuantitativa** — mismo
razonamiento que ya se aplicó al decidir el alcance de Intervenciones: requiere elegir qué
indicadores fotografiar y en qué momento exacto (¿al crear la campaña? ¿al marcarla activa?),
una decisión de diseño más grande que no está pedida explícitamente para esta fase. Esta
fase construye el registro base de una campaña — tipo, fechas, costo, participantes,
proveedor, estado — con un campo `resultado` de texto libre para que el admin documente el
efecto observado manualmente, igual que en `intervenciones`.

## Modelo de datos

```sql
create table campanas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  tipo text not null check (tipo in (
    'bienestar', 'salud_mental', 'ergonomia', 'vacunacion', 'pausas_activas',
    'prevencion', 'sueno', 'alimentacion', 'liderazgo'
  )),
  nombre text not null,
  fecha_inicio date not null,
  fecha_fin date,
  responsable text not null,
  proveedor text,
  costo numeric,
  participantes integer,
  resultado text,
  estado text not null default 'planificada' check (estado in ('planificada', 'activa', 'finalizada'))
);
```

- `tipo` usa exactamente los 9 valores del módulo 9 del documento — a diferencia de
  `indicadores` en intervenciones, aquí el documento sí da una lista cerrada de categorías,
  así que se modela como un `check` constraint, no texto libre.
- `fecha_fin` es **opcional** — algunas campañas (ej. una charla de liderazgo puntual) no
  tienen un cierre definido de antemano, o son de un solo día.
- `proveedor` es opcional — no toda campaña la ejecuta un tercero externo.
- `costo` es opcional, mismo patrón que `presupuesto` en `intervenciones` (numérico
  nullable, sin forzar a completar un valor que puede no existir).
- `participantes` es un **conteo** (entero), no una lista de personas — mismo principio de
  privacidad que ya rige el resto del proyecto: ningún dato individual identificable se
  guarda en esta tabla.
- `resultado` es opcional al crear, se completa progresivamente o al finalizar — mismo
  patrón que `resultado` en `intervenciones` y `recomendaciones`/`accion_correctiva` en los
  módulos anteriores.
- `estado` avanza solo hacia adelante: `planificada` → `activa` → `finalizada`, mismo patrón
  ya usado en todos los módulos anteriores.
- **RLS:** mismo nivel que `intervenciones`/`evaluaciones_ergonomicas` — lectura para todo
  el tenant autenticado, creación/actualización solo `superadmin`/`admin_cliente`. **Sin
  política de inserción anónima** — no hay canal público para este módulo.
- **Sin borrar**, mismo principio que el resto de tablas de este tipo.

## Interfaz

- **`/plataforma/campanas`** (nueva, admin para crear/gestionar, visible para todo el
  tenant para ver la lista — mismo patrón de acceso que `/plataforma/intervenciones`):
  tabla de campañas con tipo, nombre, fecha de inicio, estado. Formulario de creación
  (admin): tipo (selector de los 9 valores fijos), nombre, fecha de inicio, fecha de fin
  (opcional), responsable, proveedor (opcional), costo (opcional), participantes
  (opcional). Acción de gestión sobre una campaña abierta: completar/editar `resultado` y
  avanzar el estado (`planificada` → `activa` → `finalizada`), mismo componente-patrón que
  `GestionarIntervencionSheet`.
- Este es el primer módulo de esta fase que necesita un selector (`Select`) — el campo
  `tipo`. Debe usar el patrón ya corregido en este proyecto: `SelectValue` con una función
  `children` que resuelve la etiqueta legible (ej. "Salud mental" para `salud_mental`), no
  `<SelectValue />` sola.

## Testing

- Sin función pura nueva que amerite pruebas unitarias dedicadas — CRUD con control de
  estado, sin ningún cálculo de agregación (misma razón que `intervenciones`). Solo un
  mapper de fila, mismo patrón no probado por separado que el resto de los módulos.
- Sin prueba automatizada para las páginas ni los formularios, mismo patrón ya establecido.

## Explícitamente fuera de alcance (fases posteriores)

- La comparación cuantitativa antes/después con indicadores de encuestas, molestias e
  incidentes (sección "Medición de campañas" del documento) — decisión de alcance explícita
  de este spec (ver arriba).
- El motor de recomendaciones que sugeriría campañas automáticamente según una señal
  detectada — mismo entregable separado ya mencionado como fuera de alcance en el spec de
  intervenciones.
- Registrar la lista de personas que participaron en una campaña — solo un conteo agregado,
  por la misma razón de privacidad que ya rige el resto del proyecto.
- Vincular una campaña a una intervención, evento de seguridad o evaluación ergonómica
  específica — cada módulo de este roadmap se ha mantenido independiente por la misma razón
  (evitar acoplar la evolución futura de un módulo a otro).
- Mostrar "campañas activas" en `/plataforma/resumen` — integración cruzada con el
  dashboard principal que no se resuelve en esta fase (mismo alcance que ya se decidió para
  "puestos críticos" y "evaluaciones en ejecución").
