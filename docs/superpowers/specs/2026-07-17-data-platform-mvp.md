# HealthScope — Plataforma privada: ingesta y análisis de datos (MVP)

**Fecha:** 2026-07-17
**Estado:** Borrador para revisión — responde directamente la pregunta del usuario:
"¿cómo vas a pedir que entreguen la información, por qué medio, y cómo la vas a analizar
sin usar inteligencia artificial?"

## Contexto

Este spec cubre el núcleo de datos de la **plataforma privada** (`app.healthscope.cl`), no
el sitio comercial (eso ya está resuelto en `2026-07-15-home-page-design.md`). Todo lo
descrito aquí ya estaba definido en el documento maestro (`_source/inbstrucciones.txt`,
secciones 12, 13, 17 y 21) — este spec lo sintetiza y lo aterriza en decisiones concretas
para un MVP construible, sin inventar nada que contradiga esas secciones.

**Por qué sin IA para el análisis central:** el doc maestro (sección 13) es explícito sobre
dónde la IA está permitida (mapeo de columnas, detección de anomalías, clasificar texto ya
autorizado, resumir tendencias, redactar borradores) y dónde NO (inferir diagnóstico,
puntajes de "trabajador problemático", decisiones laborales automáticas). Los indicadores
que la empresa va a auditar y sobre los que va a tomar decisiones (tasa de ausentismo,
reincidencia, severidad) tienen que ser **reproducibles** — mismo input, mismo output,
explicable a un abogado o auditor sin caja negra. Eso descarta ML/LLM para el cálculo en sí;
la IA (Fase 5, después del MVP) se agrega encima como asistente de lectura, no como motor de
cálculo.

## 1. Cómo entregan los datos las empresas (canal de ingesta)

**MVP (Fase 2):**
- **Excel / CSV** subido manualmente por un usuario con permiso de importación — es el canal
  principal porque es lo que ya usan las áreas de RR.HH. chilenas (exportado de Talana, Buk,
  Rex+, Excel propio, etc.) y no depende de que el cliente tenga equipo técnico.
- **Carga manual limitada** (formulario, no bulk) para correcciones puntuales o clientes muy
  pequeños sin sistema de origen.

**Fuera del MVP, a futuro (Fase 4):** API propia, SFTP programado, webhooks, conectores HRIS
directos (Talana, Buk, Rex+, SAP), datos desde prestadores autorizados (IMED, Medipass,
canales COMPIN/Isapres). No se construyen ahora — el doc maestro pide primero validar la
taxonomía y la calidad con datos reales antes de automatizar la ingesta.

### Asistente de importación (10 pasos, sección 12 del doc maestro)

1. Seleccionar archivo.
2. Detectar encabezados automáticamente.
3. Mapear columnas del archivo → campos del modelo (aquí sí puede ayudar IA: sugerir el
   mapeo, nunca aplicarlo sin confirmación humana).
4. Validar formatos (fechas, tipos, RUT, etc.).
5. Mostrar errores fila por fila, sin bloquear la vista completa.
6. Previsualizar el resultado ya mapeado antes de tocar la base.
7. Confirmar (usuario decide si sigue pese a advertencias no críticas).
8. Ejecutar la importación.
9. Entregar un resumen (filas procesadas, rechazadas, advertencias).
10. Permitir revertir la importación completa (todo import queda versionado).

### Reglas de calidad que se validan en cada carga

Duplicados, fechas imposibles, duración negativa, períodos superpuestos para la misma
persona, unidad organizacional inexistente, tipo de licencia no reconocido, persona sin
unidad asignada, campos obligatorios faltantes, archivo repetido, y diferencias inesperadas
respecto de la carga anterior (para detectar, por ejemplo, un export corrupto). Cada carga
deja un panel de calidad: completitud, errores críticos, advertencias, rechazos, historial,
responsable y fecha.

## 2. Cómo se clasifican los datos (antes de analizarlos)

Tres niveles, cada uno con reglas fijas de negocio (no modelo entrenado):

1. **Administrativo** (lo mínimo, siempre disponible): tipo de licencia según catálogo legal
   chileno — enfermedad/accidente común, prórroga de medicina preventiva, maternal,
   enfermedad grave de hijo menor, accidente laboral/trayecto, enfermedad profesional,
   patología del embarazo, permisos administrativos, ausencia injustificada, vacaciones,
   otros.
2. **Analítico** (derivado por reglas): episodio corto/mediano/prolongado, recurrente,
   continuación, accidente, enfermedad profesional, maternal, cuidado familiar, sin
   clasificación, calidad insuficiente — se deriva de duración + frecuencia + tipo
   administrativo con umbrales fijos, no con un modelo.
3. **Clínico agregado** (solo si hay base legal y proveedor autorizado — no en el MVP): salud
   mental, musculoesquelético, respiratorio, etc. — nunca a nivel individual visible para el
   empleador.

La empresa **nunca ve el diagnóstico individual** sin autorización legal específica — el
sistema opera con tipo administrativo + clasificación analítica, que ya es suficiente para
detectar patrones organizacionales sin tocar información clínica.

## 3. Cómo se analiza sin IA (motor de reglas + fórmulas fijas)

Todo el análisis del MVP es aritmética simple sobre datos ya clasificados — filtros +
agregaciones + fórmulas documentadas, calculadas en el backend (Postgres/consultas
agregadas), no por un modelo:

| Indicador | Fórmula |
|---|---|
| Tasa de ausentismo | (días u horas perdidas / días u horas programadas) × 100 |
| Frecuencia | (episodios / dotación promedio) × 100 |
| Severidad | días perdidos / episodios |
| Duración promedio | días perdidos / episodios cerrados |
| Reincidencia | personas con ≥2 episodios / personas con ≥1 episodio |
| Participación (campañas) | participantes / población invitada |
| Adherencia | acciones completadas / acciones planificadas |
| Cambio | (valor actual − línea base) / línea base |
| Costo estimado | directos + reemplazos + horas extra + administración + otros configurables |

Reglas obligatorias sobre estos cálculos: siempre mostrar el denominador, no comparar áreas
sin ajustar por dotación, controlar estacionalidad, ocultar/agrupar resultados de grupos
demasiado pequeños (riesgo de reidentificación — el tamaño mínimo de grupo se define con
asesoría legal, no un número arbitrario), no atribuir toda mejora a una intervención sin
diseño de evaluación (línea base vs. período posterior), y guardar la metodología por
cliente para que sea auditable.

## 3.1 Formato del entregable de reportes (MVP vs. después)

El doc maestro (sección 17) lista Web/PDF/Excel controlado/CSV como formatos, y la sección 23
incluye "Reporte PDF" explícito en el MVP recomendado (ítem 13) — no es opcional para el
MVP. Para no sub-construir ni sobre-construir:

- **MVP (esta fase, Essential):** un PDF simple generado a partir de la vista actual del
  dashboard — indicadores + gráficos + filtros aplicados — con la metadata obligatoria de la
  sección 17 (fuente, fecha, filtros, definiciones, fórmulas, calidad del dato, limitaciones,
  confidencialidad, versión). Técnicamente: renderizar la misma vista que ya existe en la app
  a PDF (server-side, ej. Puppeteer/Playwright headless o una librería de PDF en React) — no
  requiere un motor de reportes aparte.
- **Fase 3+ (Pro/Enterprise):** múltiples tipos de reporte por audiencia (Ejecutivo, RR.HH.,
  Prevención, Salud ocupacional, por sucursal/campaña/intervención — la lista completa de la
  sección 17), Excel controlado, y resúmenes narrativos generados por IA con revisión humana
  obligatoria (sección 13 — nunca automático). Esto se agrega encima del PDF del MVP, no lo
  reemplaza.

**Alertas** (motor de reglas con umbrales configurables, no IA): aumento vs. línea base,
concentración por área o turno, reincidencia, ausencia prolongada, accidentes repetidos,
cambio estacional inesperado, baja participación en campaña, intervención sin seguimiento,
datos desactualizados, deterioro de calidad, riesgo de grupo pequeño. Cada alerta explica qué
cambió, respecto de qué, magnitud, datos de respaldo, posibles explicaciones, limitaciones y
un botón "Crear plan de acción" — nunca una conclusión cerrada.

**Dónde SÍ entra IA (fuera del MVP, Fase 5, siempre con revisión humana):** sugerir el mapeo
de columnas al importar, detectar anomalías estadísticas para priorizar qué mirar primero,
clasificar texto ya autorizado, resumir tendencias en lenguaje natural, y redactar borradores
de informes — todo revisable/editable por una persona antes de publicarse, con nivel de
confianza visible y opción de desactivar. Nunca decide, nunca infiere diagnóstico, nunca
genera puntajes de riesgo por trabajador.

## 4. Modelo de datos mínimo para el MVP

De las ~35 entidades del doc maestro (sección 21), el MVP necesita: Tenant, Empresa,
Sucursal, Unidad, Centro de costo, Cargo, Turno, Persona pseudonimizada, Contrato, Episodio
de ausencia, Registro fuente, Tipo administrativo, Clasificación, Regla, Alerta, Plan,
Intervención, Indicador, Línea base, Reporte, Usuario, Rol, Permiso, Auditoría, Importación,
Error de calidad. El resto (Campaña, Encuesta, Prestador, Profesional, Caso/retorno al
trabajo) queda para Fase 3 (sección 23 del doc maestro).

Cada entidad lleva tenant, fechas, origen, versión, estado y responsable — aislamiento
multi-tenant desde el día 1, con pruebas explícitas de cruce entre tenants antes de producción.

## Fuera de alcance de este spec

- Integraciones (Fase 4), IA controlada (Fase 5), campañas/profesionales/casos (Fase 3) — se
  spec-earán por separado cuando corresponda, siguiendo el orden de fases del doc maestro
  (sección 23).
- Elección definitiva de backend (ASP.NET Core vs. NestJS) y nube (Azure/AWS/GCP) — el doc
  maestro las deja abiertas explícitamente; se decide en el plan de implementación, no aquí.
- Revisión legal formal (Ley 21.719, tamaño mínimo de grupo, evaluación de impacto) — el doc
  maestro exige abogado especializado antes de producción; este spec no la reemplaza.

## Siguiente paso

Con este spec aprobado, el siguiente paso es un plan de implementación (mismo formato que
`2026-07-16-home-page-implementation.md`) para el MVP de Fase 2, tarea por tarea, ejecutado
con `subagent-driven-development`. Antes de escribirlo falta una decisión abierta: backend
ASP.NET Core vs. NestJS (ambas opciones válidas según el doc maestro).
