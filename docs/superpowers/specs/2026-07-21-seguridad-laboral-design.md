# HealthScope — Seguridad laboral: accidentes, incidentes y condiciones inseguras

**Fecha:** 2026-07-21
**Estado:** Aprobado por el usuario (decisión de alcance delegada al análisis propio) — listo
para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 4 ("Seguridad laboral": accidentes,
incidentes, cuasi accidentes, condiciones inseguras, acciones correctivas) — la segunda pieza
preventiva del roadmap después de encuestas, y la que más directamente conecta con la promesa
de "detectar lo que está comenzando a ocurrir" del documento.

## Decisión de alcance: quién reporta cada tipo de evento

El documento agrupa cuatro tipos bajo un mismo módulo, pero no todos tienen la misma necesidad
de trazabilidad ni el mismo perfil de riesgo de privacidad:

- **Accidentes e incidentes** (algo ya ocurrió, alguien pudo resultar afectado) quedan como
  **registro exclusivo de admin/prevención**. Estos casos típicamente requieren seguimiento con
  la persona afectada — que, si generó licencia médica, ya se registra vía el pipeline de
  importación existente (`episodios`, tipo `accidente_laboral`/`accidente_trayecto`) — y
  documentación formal. No tiene sentido ni es deseable que sean anónimos.
- **Cuasi accidentes y condiciones inseguras** (nada pasó todavía, pero podría) se abren
  además a **reporte anónimo por link público**, reutilizando exactamente el mismo mecanismo ya
  construido para encuestas (`demo_requests`/`encuesta_respuestas`: inserción `anon` gateada
  por RLS, sin Route Handler). Es precisamente el tipo de reporte donde el miedo a represalias
  frena que alguien avise de un cable suelto o un piso mojado sin señalizar — quitar la
  necesidad de identificarse baja esa barrera.

Ambos caminos escriben a la misma tabla; la diferencia es qué valores de `tipo` puede insertar
cada rol, aplicado en la política RLS de inserción anónima (nunca en la de admin, que puede
crear cualquier tipo).

## Modelo de datos

```sql
create table eventos_seguridad (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid references usuarios(id),
  tipo text not null check (tipo in ('accidente', 'incidente', 'cuasi_accidente', 'condicion_insegura')),
  descripcion text not null,
  gravedad text not null check (gravedad in ('leve', 'moderada', 'grave')),
  fecha date not null,
  sucursal_id uuid references sucursales(id) on delete set null,
  unidad_id uuid references unidades(id) on delete set null,
  cargo_id uuid references cargos(id) on delete set null,
  turno_id uuid references turnos(id) on delete set null,
  estado text not null default 'abierto' check (estado in ('abierto', 'en_seguimiento', 'cerrado')),
  accion_correctiva text
);
```

- `creada_por` es **nullable** — a diferencia de toda otra tabla creada en este proyecto hasta
  ahora, un reporte anónimo no tiene un `usuarios.id` que asignarle. Cuando lo crea un admin,
  se guarda su id; cuando lo crea un visitante anónimo, queda `null`.
- El ámbito (`sucursal_id`/`unidad_id`/`cargo_id`/`turno_id`) reutiliza exactamente la misma
  forma que `reglas_alerta` — todos opcionales, sin una columna "tipo de ámbito" separada. Un
  reporte anónimo puede indicar dónde ocurrió (si el formulario lo pregunta) sin que eso
  identifique a quién lo reportó.
- **RLS de inserción:** dos políticas separadas en la misma tabla —
  - `eventos_seguridad_insert_admin`: `to authenticated`, cualquier `tipo`, solo
    `superadmin`/`admin_cliente` — el mismo par de roles que ya usa `isAdminRole()` en todo el
    resto de este proyecto (`reglas_alerta`, `encuestas`, Organización). Este spec no extiende
    el sistema de permisos a los roles `prevencion`/`salud_ocupacional`; eso sería un cambio de
    autorización que afecta a todo el proyecto, no algo que este módulo decida de paso — queda
    como una posible fase futura si se confirma que se necesita.
  - `eventos_seguridad_insert_publico`: `to anon, authenticated`, con
    `with check (tipo in ('cuasi_accidente', 'condicion_insegura'))` — un visitante anónimo
    nunca puede insertar `tipo = 'accidente'` ni `'incidente'`, sin importar qué envíe el
    formulario (la restricción vive en la base de datos, no solo en la UI).
- **RLS de lectura:** todo el tenant autenticado puede ver los eventos (mismo nivel que
  `reglas_alerta`/`encuestas` — datos organizacionales, no individualmente sensibles del mismo
  modo que una respuesta de encuesta de salud mental). Ningún dato personal se almacena en esta
  tabla en ningún camino (ni siquiera en el camino admin — no hay un campo para nombrar a la
  persona involucrada; ver "Explícitamente fuera de alcance").
- **Actualización:** solo `superadmin`/`admin_cliente` puede cambiar `estado` y escribir
  `accion_correctiva` — mismo patrón de roles que la inserción admin.
- **Sin borrar**, mismo principio que `auditoria`/`reglas_alerta`/`encuesta_respuestas` en este
  proyecto — un evento cerrado sigue siendo parte del historial, no desaparece.

## Interfaz

- **`/plataforma/seguridad`** (nueva, admin para crear y gestionar, visible para todo el
  tenant para ver la lista — mismo patrón de acceso que `/plataforma/alertas` y
  `/plataforma/encuestas`): tabla de eventos con tipo, gravedad, ubicación, estado, fecha.
  Formulario de creación (admin): tipo, descripción, gravedad, fecha, ubicación (los mismos 4
  selectores en cascada ya usados en `ReglaAlertaSheet`/`ResumenInteractivo`). Acción sobre un
  evento abierto: agregar `accion_correctiva` y avanzar el estado (`abierto` → `en_seguimiento`
  → `cerrado`, igual de secuencial que el estado de una `regla_alerta`/`encuesta`).
- **`/reportar/[empresaId]`** (pública, sin autenticación, fuera de `/plataforma` — mismo
  motivo que `/encuestas/[id]`: `proxy.ts` solo protege `/plataforma/:path*`): formulario simple
  — tipo (limitado a "Cuasi accidente" o "Condición insegura", las dos únicas opciones que la
  política de inserción anónima permite), descripción, y opcionalmente sucursal/unidad si el
  reportante quiere indicar dónde (sin obligarlo). A diferencia de una encuesta, este link es
  **estable por empresa**, no por evento — no hay un estado "activa/cerrada" que consultar
  antes de mostrar el formulario, porque el canal de reporte de seguridad está siempre abierto,
  no es una campaña con fecha de cierre.

## Testing

- Sin lógica de agregación pura nueva en esta fase (a diferencia de encuestas/alertas, esto es
  principalmente CRUD con control de estado, no un cálculo) — no hay una función `lib/` que
  amerite pruebas unitarias dedicadas más allá de un mapper de fila, que sigue el mismo patrón
  ya usado (y no probado por separado) en `lib/alertas/types.ts`/`lib/encuestas/types.ts`.
- Verificación manual: confirmar que un reporte público con `tipo = 'accidente'` es rechazado
  por la base de datos (no solo oculto en la UI), y que el estado solo avanza hacia adelante.

## Explícitamente fuera de alcance (fases posteriores)

- El módulo "Intervenciones" completo del documento (sección 8: objetivo, responsable,
  presupuesto, indicadores, resultado medido) — la `accion_correctiva` de esta fase es texto
  libre, no un plan medible con seguimiento antes/durante/después. Ese es un módulo propio y
  más grande, no una extensión de este.
- Vincular un evento de seguridad con las reglas de alerta existentes (ej. "avisar si hay más
  de 3 accidentes en 30 días") — los indicadores de `reglas_alerta` hoy solo cubren los 6
  indicadores de `lib/indicators/aggregate.ts`; extenderlos a eventos de seguridad es un cambio
  al motor de alertas, no algo que este spec resuelve de paso.
- Adjuntar fotos o archivos a un reporte (ej. una foto del cable suelto) — solo texto en esta
  fase.
- Notificación automática a prevención cuando se crea un reporte — el admin revisa la lista
  cuando entra a la plataforma, no hay email ni push, mismo alcance que ya se decidió para
  alertas y encuestas.
