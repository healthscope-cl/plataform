# HealthScope — Profesionales

**Fecha:** 2026-07-22
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 10 ("Profesionales": psicólogos,
kinesiólogos, ergónomos, terapeutas ocupacionales, nutricionistas, médicos laborales,
prevencionistas, podólogos) — sexta pieza preventiva del roadmap, después de encuestas,
seguridad laboral, ergonomía, intervenciones y campañas.

## Decisión de alcance: directorio independiente, sin vincular a otros módulos

`Profesionales` es un catálogo/directorio propio — no reemplaza los campos de texto libre
`responsable` (en `intervenciones`) ni `proveedor` (en `campanas`), que siguen siendo texto
libre. Mismo razonamiento que ya se aplicó en cada módulo anterior de este roadmap: mantener
cada pieza independiente evita acoplar la evolución futura de un módulo a otro, y esta fase
no modifica ningún módulo ya en producción.

Se verificó que los roles de plataforma `prestador` y `profesional`
(`lib/platform/roles.ts`) son solo opciones de rol de **login** (para alguien que inicia
sesión en HealthScope), sin ninguna funcionalidad de directorio asociada — no tienen
relación con este módulo, que registra profesionales externos/internos con los que la
empresa trabaja, no cuentas de usuario de la plataforma.

## Decisión de alcance: estado activo/inactivo, no un flujo de tres pasos

A diferencia de `eventos_seguridad`, `evaluaciones_ergonomicas`, `intervenciones` y
`campanas` (que avanzan por un flujo de estados forward-only: pendiente → en progreso →
resuelto, o equivalente), un profesional no tiene un "ciclo de vida" de ese tipo — solo si
actualmente trabaja con la empresa o no. Este módulo usa un booleano `activo` con un botón
de encender/apagar, mismo patrón ya usado en `reglas_alerta` (`activa boolean` +
`handleToggleActiva`), no un nuevo estado de tres pasos.

Por la misma razón, el formulario permite **crear y editar** en el mismo componente (mismo
patrón dual que `ReglaAlertaSheet`) — a diferencia de los últimos cuatro módulos, que usan
un Sheet de creación separado de un Sheet de "Gestionar". Los datos de contacto de un
profesional (email, teléfono) legítimamente se corrigen con el tiempo; no tiene sentido
forzar ese cambio a pasar por un flujo de "gestión de estado".

## Modelo de datos

```sql
create table profesionales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  tipo text not null check (tipo in (
    'psicologo', 'kinesiologo', 'ergonomo', 'terapeuta_ocupacional',
    'nutricionista', 'medico_laboral', 'prevencionista', 'podologo'
  )),
  nombre text not null,
  email text,
  telefono text,
  notas text,
  activo boolean not null default true
);
```

- `email` y `telefono` son ambos opcionales — un profesional puede tener solo uno de los dos
  datos de contacto registrado, o ninguno todavía.
- `notas` es texto libre opcional — para cualquier observación (ej. "disponible solo
  martes/jueves", "atiende también sucursal Coquimbo").
- `activo` reemplaza el patrón de `estado` de los últimos cuatro módulos por un booleano
  simple, ver decisión de alcance arriba.
- **RLS:** mismo nivel que el resto del roadmap reciente — lectura para todo el tenant
  autenticado, creación/actualización solo `superadmin`/`admin_cliente`. **Sin política de
  inserción anónima** — no hay canal público para este módulo.
- **Sin borrar**, mismo principio que el resto de tablas de este tipo — un profesional que
  deja de trabajar con la empresa se marca `activo = false`, no se elimina el registro.

## Interfaz

- **`/plataforma/profesionales`** (nueva, admin para crear/editar, visible para todo el
  tenant para ver la lista — mismo patrón de acceso que el resto del roadmap): tabla de
  profesionales con tipo, nombre, contacto, estado (activo/inactivo). Formulario de
  creación/edición (admin, mismo componente para ambos casos): tipo (selector de los 8
  valores fijos), nombre, email (opcional), teléfono (opcional), notas (opcional). Acción
  sobre un profesional existente: editar sus datos, o alternar activo/inactivo con un botón,
  mismo patrón que `ReglasAlertaTable`'s `handleToggleActiva`.

## Testing

- Sin función pura nueva que amerite pruebas unitarias dedicadas — CRUD simple sin ningún
  cálculo de agregación. Solo un mapper de fila, mismo patrón no probado por separado que el
  resto de los módulos.
- Sin prueba automatizada para las páginas ni los formularios, mismo patrón ya establecido.

## Explícitamente fuera de alcance (fases posteriores)

- Vincular un profesional a intervenciones o campañas específicas (reemplazar los campos de
  texto libre `responsable`/`proveedor`) — decisión de alcance explícita de este spec (ver
  arriba).
- Resultados agregados o comparación de desempeño "por prestador" (mencionado en el sitio
  público de marketing) — es un feature de benchmarking mucho más grande, ya identificado en
  este proyecto como pendiente de suficiente volumen de clientes y revisión legal antes de
  construirse, no algo que este módulo resuelve de paso.
- Integración con sistemas externos de prestadores autorizados (IMED, Medipass) — mencionado
  en el documento como una posible fuente de datos futura, requiere acuerdos de integración
  que no existen todavía.
- Agendar o coordinar citas con un profesional — solo un directorio de contacto en esta
  fase, no un sistema de agendamiento.
