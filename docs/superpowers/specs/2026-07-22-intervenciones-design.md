# HealthScope — Intervenciones

**Fecha:** 2026-07-22
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 8 ("Intervenciones": problema detectado,
objetivo, responsable, presupuesto, fecha, indicadores, resultado) — cuarta pieza preventiva
del roadmap, después de encuestas, seguridad laboral y ergonomía. Los specs de esos tres
módulos ya habían marcado explícitamente "el módulo Intervenciones completo" como fuera de
alcance propio — este spec lo abre.

## Decisión de alcance: qué se construye y qué queda para después

El documento describe Intervenciones en tres niveles distintos de ambición, en secciones
separadas:

- **Módulo 8 ("Intervenciones")** — un registro simple: problema, objetivo, responsable,
  presupuesto, fecha, indicadores, resultado. **Esto es lo que construye este spec.**
- **Sección "Medición de campañas"** — un modelo antes/intervención/después ligado a
  campañas específicas (tipo, duración, costo, participantes, proveedor, asistencia, y
  comparación de indicadores pre/post). Es un entregable propio y más grande (medir el
  efecto real de una intervención requiere el módulo de Campañas, que todavía no existe).
- **"Motor de recomendaciones" + "Catálogo de intervenciones"** — sugerir automáticamente
  qué intervención aplicar según una señal detectada (ej. "fatiga alta en turno noche" →
  "revisar rotación", "evaluar pausas"), desde un catálogo curado. Es un entregable propio
  en la lista de 18 del documento (#12 y #13, separados de "permita medir intervenciones",
  #11).

Esta fase construye solo el módulo 8: un registro CRUD de intervenciones, con estado y
resultado, sin motor de recomendaciones, sin catálogo estructurado, sin vínculo a campañas.

## Decisión de alcance: sin vínculo a eventos de seguridad ni evaluaciones ergonómicas

Una intervención **no referencia** un `eventos_seguridad` ni una `evaluaciones_ergonomicas`
específicos — es un registro independiente. El campo `problema` es texto libre; si el admin
quiere describir que la intervención responde a un incidente o evaluación concreta, lo escribe
ahí. Esto evita acoplar este módulo a la evolución futura de los otros dos, y mantiene el
alcance de esta fase acotado a lo que el documento realmente pide (el módulo 8 no menciona
ningún vínculo estructurado a otras tablas).

## Modelo de datos

```sql
create table intervenciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  created_at timestamptz not null default now(),
  creada_por uuid not null references usuarios(id),
  problema text not null,
  objetivo text not null,
  responsable text not null,
  presupuesto numeric,
  fecha date not null,
  indicadores text not null,
  resultado text,
  estado text not null default 'planificada' check (estado in ('planificada', 'en_ejecucion', 'completada'))
);
```

- `responsable` es texto libre, no una referencia a `usuarios` — el responsable de una
  intervención suele ser un proveedor externo (kinesiólogo, psicólogo, capacitador) sin
  cuenta en la plataforma, mismo razonamiento que ya se aplicó al campo `hallazgos`/
  `recomendaciones` de `evaluaciones_ergonomicas`.
- `presupuesto` es **opcional** — varias intervenciones del catálogo de ejemplo del
  documento (revisar rotación, aplicar encuesta) no tienen costo formal.
- `indicadores` es texto libre, no una referencia a los 6 indicadores de
  `lib/indicators/aggregate.ts` — la mayoría de intervenciones reales descritas en el
  documento (evaluación ergonómica, taller de liderazgo, programa psicológico) miden cosas
  que esos 6 indicadores de ausentismo/licencias no capturan (fatiga percibida,
  participación, molestias, riesgo psicosocial). Forzar el campo a ese enum representaría
  mal la mayoría de casos reales.
- `resultado` es **opcional al crear** — se completa progresivamente o al cerrar la
  intervención, mismo patrón que `accion_correctiva`/`recomendaciones` en los módulos
  anteriores.
- `estado` **no está en la lista literal de campos del módulo 8**, pero se agrega porque el
  documento sí menciona "Intervenciones en ejecución" como parte del contenido esperado del
  dashboard (sección de escenarios de datos insuficientes) — eso requiere una noción de
  estado en alguna parte del sistema, y este es el lugar natural. Avanza solo hacia
  adelante: `planificada` → `en_ejecucion` → `completada`, mismo patrón ya usado en
  `eventos_seguridad` y `evaluaciones_ergonomicas`.
- **RLS:** mismo nivel que `evaluaciones_ergonomicas` — lectura para todo el tenant
  autenticado, creación/actualización solo `superadmin`/`admin_cliente`. **Sin política de
  inserción anónima** — no hay canal público para este módulo, igual que ergonomía.
- **Sin borrar**, mismo principio que el resto de tablas de este tipo.

## Interfaz

- **`/plataforma/intervenciones`** (nueva, admin para crear/gestionar, visible para todo el
  tenant para ver la lista — mismo patrón de acceso que `/plataforma/ergonomia`): tabla de
  intervenciones con problema, objetivo, responsable, fecha, estado. Formulario de creación
  (admin): problema, objetivo, responsable, presupuesto (opcional), fecha, indicadores.
  Acción de gestión sobre una intervención abierta: completar/editar `resultado` y avanzar
  el estado (`planificada` → `en_ejecucion` → `completada`), mismo componente-patrón que
  `GestionarEvaluacionSheet`.
- No hay una sección "en ejecución" separada en esta fase — el filtro visual por estado
  queda para una fase posterior si se confirma que se necesita; la tabla simple ya muestra
  el estado de cada fila. Mostrar "Intervenciones en ejecución" en el dashboard principal
  (`/plataforma/resumen`) también queda fuera de esta fase — es una integración cruzada con
  ese dashboard que no está pedida explícitamente para este módulo todavía.

## Testing

- Sin función pura nueva que amerite pruebas unitarias dedicadas — este módulo es CRUD con
  control de estado, sin ningún cálculo de agregación (a diferencia de "puestos críticos"
  en ergonomía). Solo un mapper de fila, mismo patrón no probado por separado que
  `lib/seguridad/types.ts`/`lib/ergonomia/types.ts`.
- Sin prueba automatizada para las páginas ni los formularios, mismo patrón ya establecido.

## Explícitamente fuera de alcance (fases posteriores)

- El modelo antes/intervención/después ligado a campañas (sección "Medición de campañas"
  del documento) — depende del módulo de Campañas, que no existe todavía.
- El motor de recomendaciones (sugerir intervenciones automáticamente desde una señal
  detectada) y el catálogo estructurado de tipos de intervención — son entregables propios
  y más grandes en la lista de 18 del documento, separados de "permita medir
  intervenciones".
- Vincular una intervención a un `eventos_seguridad` o `evaluaciones_ergonomicas`
  específico — decisión de alcance explícita de este spec (ver arriba).
- Mostrar "Intervenciones en ejecución" en `/plataforma/resumen` — integración cruzada con
  el dashboard principal que no se resuelve en esta fase.
- Adjuntar archivos o evidencia a una intervención — solo texto en esta fase.
