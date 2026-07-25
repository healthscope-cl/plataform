# HealthScope — Plan de Acción Individual por Episodio

**Fecha:** 2026-07-25
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** pedido explícito de Jose, tras revisar la plataforma con datos reales ya cargados:
"Recomendaciones" (Motor de Recomendaciones, sección 10 del documento maestro) solo entrega
señales agregadas a nivel empresa — nunca dice qué hacer con una persona/caso específico. Jose
pidió explícitamente: *"aunque haya una licencia yo debo tener un plan de acción con esa persona
según la licencia que pide"* (caso base) + *"como también se suman temas recurrentes"*
(la recurrencia escala el plan, no lo reemplaza) + *"eso también se debe tomar en cuenta, como
también los costos, todo"* (el costo debe verse en la misma vista).

## Validación contra lo ya prometido (no es un cambio de postura de privacidad)

Se revisó el sitio público de marketing (`lib/home/content/es.ts`, FAQ) antes de diseñar esto,
porque en un principio parecía estar en tensión con el principio de "sin diagnóstico individual"
ya establecido en todo el proyecto. No lo está — el propio FAQ público dice:

> *"HealthScope funciona sin diagnóstico individual mediante tipos de licencia, duración,
> frecuencia, recurrencia, accidentes, estructura organizacional y encuestas agregadas."*

Es decir, el producto ya promete públicamente usar exactamente estas señales (tipo, duración,
frecuencia, recurrencia) **por caso**, como alternativa segura a un diagnóstico clínico — nunca
un diagnóstico. El caso de uso público "Retorno al trabajo" (episodio prolongado → *"Plan de
retorno gradual con adaptaciones y seguimiento"*) es prácticamente lo que este spec construye,
solo que faltaba conectarlo a un episodio real en la plataforma. Este spec no expone ningún dato
clínico nuevo — usa exactamente los mismos campos administrativos que ya son visibles hoy en
"Ausencias y licencias" (tipo, clasificación, código de persona).

## Arquitectura: reusar `clasificacion_analitica`, no inventar una clave nueva

`clasificarEpisodio()` (`lib/ingestion/classification.ts`, ya existe, sin cambios) ya calcula, por
cada episodio, una de 11 categorías combinando tipo administrativo + duración + recurrencia. Pero
esa función colapsa 4 tipos administrativos muy distintos (`permiso_administrativo`,
`ausencia_injustificada`, `vacaciones`, `otros`) en un solo valor `sin_clasificar` — vacaciones y
ausencia injustificada no pueden compartir la misma acción sugerida. Por eso la clave del plan de
acción es **la combinación de `tipoAdministrativo` + `clasificacionAnalitica`**, no solo uno de
los dos — igual de determinista, reglas fijas, sin IA (mismo principio que Motor de
Recomendaciones), pero sin la ambigüedad de `sin_clasificar`.

## Las 14 reglas fijas (acción + responsable + limitaciones)

| Tipo administrativo | Clasificación | Acción sugerida | Responsable |
|---|---|---|---|
| accidente_laboral, accidente_trayecto | accidente | Investigar el accidente, evaluar el riesgo del puesto y coordinar seguimiento médico. | Prevención de riesgos |
| enfermedad_profesional | enfermedad_profesional | Evaluación de salud ocupacional y revisión de condiciones del puesto asociadas. | Salud ocupacional |
| maternal, patologia_embarazo | maternal | Preparar plan de reincorporación y ajustes de puesto según indicación médica autorizada. | RR.HH. |
| enfermedad_grave_hijo_menor | cuidado_familiar | Confirmar cobertura y duración del permiso; sin acción adicional salvo solicitud del trabajador. | RR.HH. |
| prorroga_medicina_preventiva | continuacion | Dar seguimiento como episodio en curso — evaluar necesidad de apoyo adicional. | Salud ocupacional |
| permiso_administrativo | sin_clasificar | Sin acción de seguimiento — permiso administrativo estándar. | RR.HH. |
| ausencia_injustificada | sin_clasificar | Conversación con la jefatura directa para conocer la causa; evaluar si corresponde una acción de RR.HH. | RR.HH. |
| vacaciones | sin_clasificar | Sin acción de seguimiento — vacaciones. | — |
| otros | sin_clasificar | Revisar el detalle del caso para determinar clasificación específica. | RR.HH. |
| enfermedad_comun | corto | Sin acción de seguimiento — episodio corto y aislado. | — |
| enfermedad_comun | mediano | Sin acción especial; monitorear si se repite. | — |
| enfermedad_comun | **prolongado** | **Plan de retorno gradual con adaptaciones y seguimiento** (mismo texto del caso de uso público del sitio). | Salud ocupacional / RR.HH. |
| enfermedad_comun | **recurrente** | **Derivar a evaluación de salud ocupacional** — 2 o más episodios en 12 meses. | Salud ocupacional |
| (cualquiera) | calidad_insuficiente | Sin acción — datos insuficientes para clasificar el episodio. | — |

Las dos filas en negrita son exactamente el mecanismo de escalamiento que pidió Jose: un episodio
de enfermedad común aislado no genera acción, pero uno prolongado o recurrente sí, con un plan
específico.

Cada regla incluye además una limitación fija breve (ej. para `recurrente`: *"Un aumento de
licencias puede reflejar causas organizacionales, no solo individuales — revisar contexto (carga,
turno, área) antes de concluir."*) y el mismo texto de revisión humana ya usado en Motor de
Recomendaciones: *"Esta es una sugerencia basada en reglas fijas, no un diagnóstico — debe ser
evaluada por un profesional antes de implementarse."*

## Costo: se muestra junto al plan, no como parte de la clave

El costo estimado de la persona (ya calculado hoy por `computeIndicadoresPorPersona`,
`lib/indicators/porPersona.ts`, usado en el Resumen) se muestra junto al plan de acción como dato
de apoyo — no cambia qué acción se sugiere, solo da contexto de magnitud.

## Dónde se muestra

En **"Ausencias y licencias"** (`app/plataforma/ausencias/page.tsx`,
`components/platform/ausencias/AusenciasTable.tsx`), que ya lista un episodio por fila con su
`codigo` de persona, tipo y clasificación. Se agrega una columna "Acción sugerida" con un botón
"Ver plan" que expande una fila de detalle debajo (mismo patrón de tabla expandible, con estado
local de fila expandida — no existe hoy un componente `Popover` en el proyecto, solo un `Tooltip`
de una línea usado en `IndicadorCard`, insuficiente para este contenido de 4-5 líneas; se evita
agregar una dependencia de overlay nueva). La fila expandida muestra: acción, responsable,
limitaciones, costo estimado de la persona, y el texto de revisión humana. No se agrega una tabla
ni página nueva — es una capa sobre datos que ya existen.

## Dato adicional requerido: `tipos_administrativos.clave`

Hoy `app/plataforma/ausencias/page.tsx` solo selecciona `id, nombre` de `tipos_administrativos`
(línea 26) y pasa `tipoAdministrativoNombre` (un string de presentación) a `EpisodioFila` — no la
clave cruda del enum `TipoAdministrativoClave`. La clave del plan de acción necesita el enum, no el
texto de presentación (que en teoría podría cambiar sin que cambie el significado). Esto requiere:
seleccionar también `clave` en esa consulta, y agregar `tipoAdministrativoClave` como campo nuevo en
`EpisodioFila` (además de, no en reemplazo de, `tipoAdministrativoNombre`, que se sigue mostrando
igual que hoy en la columna "Tipo").

## Fuera de alcance

- Campañas dirigidas a una persona específica — proyecto separado, pospuesto explícitamente por
  Jose.
- Cualquier cambio a `clasificarEpisodio()` — se reusa exactamente como está.
- Guardar o marcar si una acción fue "revisada" o "ejecutada" — mismo patrón ya establecido en
  Motor de Recomendaciones (sin tabla de seguimiento de estado en esta fase).
- Mostrar nombre real de la persona — se mantiene solo `codigo`, sin cambios a la decisión de
  privacidad ya tomada.

## Testing

`lib/ingestion/accionSugerida.ts` — función pura nueva, TDD real con las 14 combinaciones de la
tabla de arriba (test parametrizado o uno por combinación). Sin tests para la UI del Popover
(presentacional, mismo patrón del resto del proyecto).
