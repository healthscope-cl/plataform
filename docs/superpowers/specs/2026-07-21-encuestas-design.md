# HealthScope — Encuestas anónimas de bienestar preventivo

**Fecha:** 2026-07-21
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 6 ("Encuestas") y la señal central del
documento: la plataforma debe entregar valor preventivo incluso cuando una empresa tiene pocas
licencias médicas. Hoy todo lo construido (indicadores, alertas, índice de suficiencia) es
reactivo — se calcula sobre licencias que ya ocurrieron. Las encuestas son la primera fuente de
señal que no depende de que algo ya haya salido mal.

## Alcance deliberadamente acotado

El documento pide tres modos de encuesta (anónimas, confidenciales, identificadas con
consentimiento) y un editor de preguntas abierto. Esta fase implementa solo lo primero:

- **Solo encuestas anónimas por link público**, sin login. "Identificadas con consentimiento"
  requeriría que cada trabajador tenga una cuenta propia en la plataforma — hoy no existe
  ningún login para trabajadores, solo para administradores/RR.HH. Construir cuentas
  individuales es su propio proyecto grande, no una extensión de este.
- **Catálogo fijo de preguntas**, no un editor de preguntas libre. El admin elige cuáles
  preguntas de un catálogo predefinido incluir en cada encuesta; no escribe preguntas nuevas ni
  define tipos de pregunta. Esto evita construir un constructor de formularios genérico.
- **Sin segmentación real por sucursal/turno/cargo.** Un link público y anónimo no puede
  verificar quién lo responde, así que la plataforma no finge poder dirigirlo a un grupo
  específico — el admin puede nombrar la encuesta pensando en un grupo ("Encuesta turno
  noche"), pero el sistema no lo aplica ni lo valida.

## Mecanismo técnico: mismo patrón que "Solicitar demostración"

El sitio público ya tiene un formulario anónimo sin sesión (`demo_requests`) que inserta
directo a Supabase con el rol `anon`, protegido por una política RLS de solo-inserción y su
`grant` correspondiente (`supabase/schema.sql`, tabla `demo_requests`). Las respuestas de
encuesta usan exactamente el mismo mecanismo — no hace falta un Route Handler nuevo ni
infraestructura de sesión para el encuestado.

## Catálogo de preguntas (fijo, en código)

Ocho preguntas estándar, todas en escala 1 a 5, tomadas de la lista de señales preventivas del
documento (sección 3.B):

| id | Texto |
|---|---|
| `estres` | Nivel de estrés percibido esta semana |
| `fatiga` | Nivel de fatiga percibida esta semana |
| `sueno` | Calidad del sueño esta semana |
| `carga` | Percepción de carga de trabajo |
| `dolor_musculoesqueletico` | Molestias musculoesqueléticas (espalda, cuello, muñecas) |
| `liderazgo` | Percepción de apoyo de la jefatura directa |
| `conciliacion` | Equilibrio entre trabajo y vida personal |
| `pausas_activas` | Cumplimiento de pausas activas durante la jornada |

El catálogo vive en código (`lib/encuestas/catalogo.ts`), no en una tabla — agregar o ajustar
una pregunta del catálogo es un cambio de código revisado, no una operación de datos.

## Modelo de datos

```sql
create table encuestas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  titulo text not null,
  descripcion text,
  pregunta_ids text[] not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'activa', 'cerrada')),
  fecha_apertura date,
  fecha_cierre date
);

create table encuesta_respuestas (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references encuestas(id) on delete cascade,
  created_at timestamptz not null default now(),
  respuestas jsonb not null
);
```

- `encuestas.pregunta_ids` guarda los ids del catálogo elegidos (ej. `['estres', 'fatiga']`) —
  no hay tabla de preguntas, el catálogo es la fuente de verdad de sus textos.
- `encuesta_respuestas.respuestas` es un objeto `{ preguntaId: valor }` con `valor` entre 1 y 5
  — una fila por persona que respondió, sin ningún identificador de quién fue. No hay
  `persona_id`, no hay `rut_hash`, no hay dirección IP ni ningún otro dato que pudiera
  reidentificar a alguien.
- **RLS de `encuestas`:** lectura para todo el tenant autenticado (como el resto de catálogos
  administrativos); lectura pública (`anon`) solo de encuestas en estado `activa` (necesario
  para que la página pública sepa qué preguntas mostrar); creación/edición solo
  `superadmin`/`admin_cliente`.
- **RLS de `encuesta_respuestas`:** inserción abierta a `anon`, pero solo si `encuesta_id`
  referencia una encuesta en estado `activa` (evita responder una encuesta cerrada o en
  borrador); lectura solo para el tenant autenticado dueño de esa encuesta (vía subconsulta);
  nadie puede editar ni borrar una respuesta ya enviada, ni siquiera un admin — es el mismo
  principio de "sin borrar, sin editar" que ya se usa en `auditoria` y `reglas_alerta`.

## Agregación (pura, con la misma protección de grupo pequeño)

`lib/encuestas/agregar.ts` — función pura nueva, misma familia que
`computeIndicadores`/`evaluarReglas`: por cada pregunta de la encuesta, si hay menos de
`MIN_GROUP_SIZE` respuestas (la misma constante ya definida en `lib/indicators/formulas.ts` —
reutilizada, no una nueva), el resultado de esa pregunta es `{ suprimido: true }` en vez de un
promedio. Esta es la razón por la que el modelo de datos no guarda ningún identificador de
persona: la protección de grupo pequeño solo tiene sentido si ya es estructuralmente imposible
cruzar una respuesta con quién la envió.

## Interfaz

- **`/plataforma/encuestas`** (nueva, admin-only para crear/editar, visible para todo el
  tenant para ver resultados — mismo patrón de acceso que `/plataforma/alertas`): lista de
  encuestas con estado, cantidad de respuestas, y un botón para copiar el link público.
  Formulario de creación: título, descripción, checkboxes del catálogo de 8 preguntas, fecha de
  apertura/cierre. Cambio de estado (borrador → activa → cerrada) mediante un control simple,
  sin edición de preguntas una vez creada (evita el caso de cambiar preguntas a mitad de
  recolección, lo que invalidaría la comparación).
- **`/plataforma/encuestas/[id]`**: vista de resultados agregados — una tarjeta por pregunta
  con el promedio (o "Grupo insuficiente para mostrar" si no llega al mínimo) y la cantidad de
  respuestas que sustentan ese promedio (misma filosofía de "nunca un número sin su
  denominador" que ya rige el resto del dashboard).
- **`/encuestas/[id]`** (pública, sin autenticación, fuera de `/plataforma`): renderiza título,
  descripción y las preguntas incluidas como escalas de 1 a 5. Si la encuesta no está `activa`
  (cerrada, en borrador, o no existe), muestra un mensaje en vez del formulario. Al enviar,
  inserta directo a `encuesta_respuestas` vía el cliente Supabase del navegador con el rol
  `anon` — mismo patrón que `DemoRequestSheet`. Después de enviar, muestra un mensaje de
  agradecimiento; no permite responder dos veces desde la misma sesión de navegador (un simple
  flag en el estado del componente, no un mecanismo anti-fraude — no es el objetivo de esta
  fase impedir a alguien decidido a responder varias veces).

## Testing

- `lib/encuestas/agregar.ts`: pruebas unitarias puras — promedio correcto por pregunta,
  supresión cuando hay menos de `MIN_GROUP_SIZE` respuestas, una encuesta sin respuestas
  todavía, y que preguntas del catálogo no incluidas en `pregunta_ids` no aparezcan en el
  resultado.
- Sin prueba automatizada para las páginas ni el formulario público — mismo patrón ya
  establecido en este proyecto.

## Explícitamente fuera de alcance (fases posteriores)

- Encuestas identificadas con consentimiento (depende de cuentas de trabajador).
- Editor de preguntas libre / preguntas de opción múltiple.
- Segmentación real por sucursal/unidad/cargo/turno.
- Envío de la encuesta por correo o recordatorios automáticos — el admin comparte el link como
  prefiera, fuera del sistema.
- Uso de la participación/resultados de encuestas como dimensión del índice de suficiencia
  (`lib/suficiencia/calcular.ts`) — mencionado como fuera de alcance en ese spec también; se
  incorpora en una fase posterior a esta, no en esta misma.
