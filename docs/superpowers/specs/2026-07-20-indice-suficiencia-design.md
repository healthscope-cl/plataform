# HealthScope — Índice de suficiencia de datos y degradación honesta del dashboard

**Fecha:** 2026-07-20
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt` — un documento de rediseño estratégico completo
que exige que HealthScope "no dependa exclusivamente de que una empresa tenga un gran volumen
de licencias médicas" y nunca muestre "gráficos vacíos ni porcentajes engañosos". Ese
documento describe ~15 módulos y un cambio de modo completo del dashboard (analítico /
preventivo / sin licencias); este spec cubre solo la primera pieza, la que todo lo demás
necesita para tener sentido: saber y comunicar cuándo los datos alcanzan para confiar en un
indicador.

## Contexto y alcance deliberadamente acotado

El documento pide un "Modo preventivo" completo que muestre encuestas, seguridad laboral,
ergonomía, campañas, etc. cuando el volumen de licencias es bajo. **Ninguno de esos módulos
existe todavía** en esta plataforma — son fases futuras completamente separadas (ver
`referencia/instrucciones2.txt` secciones 3.B y 8). Construir una pantalla "modo preventivo"
ahora mostraría casi exclusivamente mensajes de "próximamente", que es precisamente lo que el
propio documento prohíbe ("no llenar el espacio con gráficos vacíos").

Por eso este spec implementa la versión honesta de lo que ya se puede cumplir hoy: **un índice
de suficiencia calculado solo con datos que ya existen** (personas, episodios, estructura
organizacional), mostrado como un banner informativo que explica cuándo confiar en los
indicadores y qué falta — sin fingir un módulo preventivo que todavía no está construido. La
sección 15 del documento ("Criterios de aceptación") pide explícitamente "explique cuándo los
datos son insuficientes" y "no genere conclusiones engañosas" — este spec cumple exactamente
eso, sin sobre-construir.

## Qué mide el índice

Cuatro dimensiones, todas calculables con datos que el dashboard ya trae hoy
(`app/plataforma/resumen/page.tsx` ya fetchea `personas`/`episodios`/catálogos organizacionales):

1. **Dotación** — cantidad de personas activas.
2. **Volumen de episodios** — cantidad de episodios en el período de 6 meses ya usado por el
   resto del dashboard.
3. **Cobertura temporal** — si existe al menos una importación completada cuyo rango de fechas
   cubre el período (una señal simple de "hay datos recientes", no un análisis de huecos
   exhaustivo — eso queda fuera de alcance).
4. **Completitud organizacional** — porcentaje de personas activas con `unidad_id`, `cargo_id`
   y `turno_id` asignados (los tres a la vez cuentan como "completa"; cualquiera faltante
   cuenta como incompleta). Esto importa porque, sin esa vinculación, los filtros de sucursal/
   unidad/cargo/turno (ya construidos) no tienen sobre qué operar para esa persona.

**Explícitamente fuera de esta fase:** participación en encuestas, calidad de integraciones —
ambas mencionadas en la sección 5 del documento, pero no aplican porque ninguna de las dos
fuentes existe todavía. Se agregan a esta fórmula cuando esos módulos se construyan, no antes.

## Estados y umbrales (placeholder, igual que `MIN_GROUP_SIZE`)

Cuatro estados, evaluados en este orden (el primero que califica gana, de más exigente a menos):

| Estado | Condición |
|---|---|
| Sólido | ≥30 personas activas **y** ≥20 episodios en el período **y** ≥70% completitud organizacional |
| Utilizable | ≥10 personas activas **y** ≥5 episodios en el período |
| Limitado | ≥5 personas activas (el mínimo para que un indicador no quede suprimido) **o** al menos 1 episodio |
| Insuficiente | Menos de 5 personas activas **y** cero episodios en el período |

Estos números son un punto de partida razonable, no una decisión de negocio validada — se
exportan como constantes nombradas (mismo patrón que `MIN_GROUP_SIZE` en
`lib/indicators/formulas.ts`), comentadas como ajustables, fáciles de encontrar y cambiar sin
tocar la lógica que las usa.

## Salida de la función

```typescript
type EstadoSuficiencia = 'insuficiente' | 'limitado' | 'utilizable' | 'solido'

type IndiceSuficiencia = {
  estado: EstadoSuficiencia
  razones: string[]         // qué está impulsando este estado, en lenguaje llano
  recomendaciones: string[] // qué se puede hacer para mejorarlo
}
```

`razones` y `recomendaciones` son listas de frases ya armadas por la función (no códigos que la
UI tenga que traducir) — por ejemplo, `razones` puede incluir "Solo 3 personas activas
registradas" y `recomendaciones` "Importa datos de más personas o completa la asignación de
unidad/cargo/turno de las que ya existen". Cuando el estado es `solido`, ambas listas están
vacías (no hay nada que señalar).

## Interfaz

- **`lib/suficiencia/calcular.ts`** — función pura nueva, `calcularIndiceSuficiencia()`, misma
  familia que `evaluarReglas()`/`computeIndicadores()`: sin llamadas a Supabase, opera sobre
  arreglos que el Server Component ya tiene.
- **`components/platform/dashboard/SuficienciaBanner.tsx`** — banner informativo (tono neutro,
  no de alarma como `AlertasBanner`), visible **solo cuando el estado no es `solido`** — un
  dataset sano no debe mostrar ningún aviso. Lista `razones` y `recomendaciones`, y cuando el
  estado es `insuficiente` o `limitado` agrega una frase fija: "Los indicadores de abajo deben
  interpretarse con precaución dado el tamaño de la muestra." No se modifica `IndicadorCard` —
  la advertencia vive una sola vez en el banner, no repetida en cada tarjeta.
- **`app/plataforma/resumen/page.tsx`**: calcula el índice junto a los demás cálculos server-side
  ya existentes (misma ubicación que el cálculo de alertas de la fase anterior) y renderiza el
  banner antes de `ResumenInteractivo`.

## Testing

- `lib/suficiencia/calcular.ts`: pruebas unitarias puras cubriendo cada uno de los 4 estados
  (incluyendo los valores límite exactos de cada umbral), completitud organizacional parcial
  (algunas personas con vínculo, otras sin), y que `razones`/`recomendaciones` estén vacías en
  estado `solido`.
- Sin prueba automatizada para `SuficienciaBanner` ni la integración en `page.tsx` — mismo
  patrón ya establecido en este proyecto (solo funciones puras de `lib/` se prueban con
  Vitest).

## Explícitamente fuera de alcance (fases posteriores)

- El "Modo preventivo" completo (pantalla alternativa con encuestas, seguridad laboral,
  ergonomía) — depende de que esos módulos existan primero.
- Participación en encuestas y calidad de integraciones como dimensiones del índice.
- Cobertura temporal exhaustiva (detectar huecos específicos en el calendario) — esta fase solo
  verifica "hay una importación completada que cubre el período", no un análisis fila por fila.
- Cualquiera de los otros 14 módulos listados en `referencia/instrucciones2.txt` sección 8
  (bienestar, campañas, intervenciones, profesionales, motor de recomendaciones, benchmark,
  etc.) — cada uno es su propio spec futuro.
