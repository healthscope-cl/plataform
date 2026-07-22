# HealthScope — Ergonomía y salud musculoesquelética

**Fecha:** 2026-07-22
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 5 ("Ergonomía y salud musculoesquelética":
evaluaciones, dolor reportado, puestos críticos, recomendaciones, seguimiento) — la tercera
pieza preventiva del roadmap, después de encuestas y seguridad laboral.

## Decisión de alcance: qué se construye nuevo y qué se reutiliza

El documento agrupa cinco conceptos bajo un mismo módulo, pero no todos requieren
infraestructura nueva:

- **"Dolor reportado" reutiliza la encuesta existente.** El catálogo de encuestas
  (`lib/encuestas/catalogo.ts`) ya incluye la pregunta `dolor_musculoesqueletico`
  ("Molestias musculoesqueléticas: espalda, cuello, muñecas"), con la misma protección de
  grupo pequeño (`MIN_GROUP_SIZE`) que usa el resto de la plataforma. No se construye un
  segundo canal de captura para la misma señal — el admin simplemente incluye esa pregunta
  al crear una encuesta, y los resultados ya se ven en `/plataforma/encuestas/[id]`. Esta
  fase no añade nada nuevo para ese punto del documento.
- **"Evaluaciones", "Recomendaciones" y "Seguimiento" sí requieren una tabla nueva** —
  `evaluaciones_ergonomicas` — porque son un registro formal hecho por un profesional
  (ergónomo, kinesiólogo), no un autorreporte anónimo. A diferencia de seguridad laboral,
  **no hay canal público**: nadie fuera de la plataforma llena este formulario.
- **La evaluación es por puesto/cargo, no por persona.** El documento habla de "puestos
  críticos", no de "personas críticas" — y una evaluación ergonómica en la práctica evalúa
  una estación de trabajo o un rol, no el cuerpo de un trabajador específico. Esto también
  evita que esta tabla almacene cualquier dato de salud individual, mismo principio que ya
  aplica en el resto del proyecto (ningún campo nombra a una persona en `eventos_seguridad`
  tampoco).

## Corrección hecha durante la redacción de esta spec

En la conversación previa a esta spec, propuse que "puestos críticos" cruzara el
`nivel_riesgo` de las evaluaciones con el promedio de la pregunta `dolor_musculoesqueletico`
de las encuestas, por cargo. **Eso no es técnicamente posible**: `encuesta_respuestas` no
captura `cargo_id` ni ningún otro dato demográfico — es una decisión de diseño explícita del
spec de encuestas ("Sin segmentación real por sucursal/turno/cargo... la plataforma no finge
poder dirigirlo a un grupo específico"), necesaria para que el anonimato sea real. Cruzar una
respuesta anónima con un cargo específico requeriría romper esa garantía. Por eso, en esta
spec, **"puestos críticos" se calcula únicamente a partir de `evaluaciones_ergonomicas`** — ver
sección correspondiente más abajo. El promedio de dolor musculoesquelético sigue disponible,
sin cruce, en la página de resultados de cada encuesta.

## Modelo de datos

```sql
create table evaluaciones_ergonomicas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  cargo_id uuid not null references cargos(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  fecha date not null,
  nivel_riesgo text not null check (nivel_riesgo in ('bajo', 'medio', 'alto')),
  hallazgos text not null,
  recomendaciones text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_progreso', 'resuelto'))
);
```

- `cargo_id` es **obligatorio** (a diferencia de `eventos_seguridad`, donde el ámbito es todo
  opcional) — es la unidad de análisis de este módulo, no un filtro adicional.
  `sucursal_id` queda opcional, por si la evaluación se hizo en una ubicación específica de
  ese cargo.
- `creada_por` es **obligatorio** — a diferencia de `eventos_seguridad`, aquí no existe un
  camino de creación anónima; toda evaluación la crea un admin autenticado.
- `hallazgos` es obligatorio (qué encontró el evaluador); `recomendaciones` es opcional al
  crear — el evaluador puede documentar el hallazgo primero y añadir la recomendación
  después, mismo patrón que `accion_correctiva` en `eventos_seguridad`.
- `estado` avanza solo hacia adelante: `pendiente` → `en_progreso` → `resuelto`, idéntico en
  espíritu al patrón ya usado en `eventos_seguridad`.
- **RLS:** lectura para todo el tenant autenticado (mismo nivel que `reglas_alerta` /
  `eventos_seguridad` — información organizacional, no dato de salud individual);
  creación y actualización (avanzar `estado`, completar `recomendaciones`) solo
  `superadmin`/`admin_cliente`, mismo par de roles que usa `isAdminRole()` en todo el resto
  del proyecto. **Sin política de inserción anónima** — a diferencia de `eventos_seguridad`,
  no hay rol `anon` en esta tabla en absoluto.
- **Sin borrar**, mismo principio que el resto de tablas de este tipo en el proyecto.

## Puestos críticos (función pura)

`lib/ergonomia/puestosCriticos.ts` — función pura nueva:

- Para cada `cargo_id`, toma la evaluación más reciente (por `fecha`, empate resuelto por
  `created_at`).
- Un cargo es **crítico** si su evaluación más reciente tiene `nivel_riesgo = 'alto'` y
  `estado != 'resuelto'` — es decir, un hallazgo de riesgo alto que todavía no se ha resuelto.
  Una evaluación de riesgo alto ya marcada `resuelto` no mantiene el cargo en la lista.
- No requiere ningún dato de encuestas ni protección de grupo pequeño (no son datos
  individuales agregados, son evaluaciones de un puesto hechas por un profesional
  identificado).

## Interfaz

- **`/plataforma/ergonomia`** (nueva, admin para crear/gestionar, visible para todo el
  tenant para ver la lista — mismo patrón de acceso que `/plataforma/seguridad`):
  - Sección "Puestos críticos" arriba: tarjetas o tabla con los cargos marcados críticos por
    `calcularPuestosCriticos`, mostrando el cargo, la fecha de la evaluación y el hallazgo.
    Si no hay ninguno, un mensaje neutro ("Sin puestos críticos detectados"), mismo lenguaje
    responsable que ya usa `AlertasBanner`.
  - Tabla de evaluaciones: cargo, sucursal (si aplica), fecha, nivel de riesgo, estado.
    Formulario de creación (admin): cargo (selector obligatorio), sucursal (opcional),
    fecha, nivel de riesgo, hallazgos, recomendaciones (opcional). Acción de gestión sobre
    una evaluación abierta: completar/editar `recomendaciones` y avanzar el estado
    (`pendiente` → `en_progreso` → `resuelto`), mismo componente-patrón que
    `GestionarEventoSheet`.

## Testing

- `lib/ergonomia/puestosCriticos.ts`: pruebas unitarias puras — cargo con evaluación de
  riesgo alto sin resolver aparece como crítico; cargo con evaluación de riesgo alto pero
  `estado = 'resuelto'` no aparece; cargo con solo evaluaciones de riesgo bajo/medio no
  aparece; cargo con varias evaluaciones usa la más reciente por fecha (no la de mayor
  riesgo histórico); tenant sin evaluaciones no falla, devuelve lista vacía.
- Sin prueba automatizada para las páginas ni los formularios, mismo patrón ya establecido
  en este proyecto.

## Explícitamente fuera de alcance (fases posteriores)

- Cruzar el nivel de riesgo por evaluación con las respuestas de la encuesta de dolor
  musculoesquelético — no es técnicamente posible sin capturar `cargo_id` en
  `encuesta_respuestas`, lo que rompería el anonimato garantizado por diseño en el spec de
  encuestas. Si se necesita en el futuro, es una decisión de producto más grande (¿vale la
  pena sacrificar anonimato total por señal accionable por cargo?), no algo que este spec
  resuelva de paso.
- Evaluaciones a nivel de persona individual (con datos de salud identificables) — el
  documento habla de "puestos críticos", y esta fase se mantiene en ese nivel de agregación
  por la misma razón de privacidad que ya rige el resto del proyecto.
- El módulo "Intervenciones" completo (objetivo, responsable, presupuesto, resultado
  medido) — igual que en seguridad laboral, `recomendaciones` es texto libre, no un plan
  medible con seguimiento antes/durante/después.
- Adjuntar fotos o diagramas a una evaluación — solo texto en esta fase.
- Vincular evaluaciones con las reglas de alerta existentes — mismo argumento que en
  seguridad laboral: los indicadores de `reglas_alerta` hoy solo cubren los 6 indicadores de
  `lib/indicators/aggregate.ts`.
