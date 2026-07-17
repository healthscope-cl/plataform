# HealthScope — Home Page (sitio comercial) Design

**Fecha:** 2026-07-15
**Estado:** Aprobado por el usuario, listo para plan de implementación.

## Contexto

HealthScope es un SaaS chileno nuevo: inteligencia de ausentismo y salud laboral para
empresas (licencias médicas, ausencias, patrones, alertas, planes de acción, campañas
preventivas, medición de resultados). El doc maestro completo vive en
`_source/inbstrucciones.txt` (gitignored, material de referencia interno, no parte de la
app) — 1555 líneas que cubren tanto el sitio comercial (19 páginas) como la plataforma
privada (~35 entidades). Ese proyecto es demasiado grande para un solo spec.

Esta pieza cubre **solo la Home del sitio comercial** — la sección 8 del doc maestro, que ya
trae estructura y copy detallados. No toca datos sensibles ni autenticación. Es la primera
pieza construible porque no depende de nada más (la plataforma privada, el CMS de recursos y
las demás páginas del sitio se abordan en specs futuros).

El proyecto ya está escafoldado: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui +
`@supabase/ssr`, conectado a GitHub (`healthscope-cl/plataform`) y Supabase
(`healthscope-platform`, ref `jjnrrkwydpsetugxtgea`). No existe `proxy.ts` de auth todavía a
propósito — el sitio público no requiere sesión.

## Fuera de alcance (explícito)

- Cualquier página del sitio comercial que no sea Home (Plataforma, Soluciones, Casos de
  uso, Seguridad y privacidad como página propia, Recursos/blog, Nosotros, Precios, Centro de
  ayuda, Estado del servicio, Términos, Política de privacidad/cookies, Canal de derechos de
  datos, Acuerdo de tratamiento de datos).
- La plataforma privada (`/login` real, dashboard, importación, alertas, etc.) — el login
  queda como página stub sin funcionalidad.
- CMS para contenido — el copy vive hardcodeado en `lib/home/content.ts`.
- Panel de administración para ver las solicitudes de demo — se revisan directo en el
  dashboard de Supabase.
- Internacionalización (inglés) — solo español por ahora.

## Actualización 2026-07-17 — fotografía de personas

La versión original de este spec optó por tratamiento 100% ilustrado/abstracto (sin fotos)
para simplificar la Fase 1. El usuario pidió revertir esto a lo que ya indicaba la sección
8.2 del doc maestro: foto real de trabajadores/jefaturas en el Hero, recortada en forma
orgánica, con 2-3 tarjetas de indicadores superpuestas — estilo de referencia: Aino Health,
Honeydew, RioMed (capturas en `referencia/`, no copiar forma ni interfaz literal).

Como no se pueden usar fotos de bancos de imágenes de personas reales identificables sin
licencia ni fotos de las empresas de referencia, las imágenes se generan con IA (estilo
fotorrealista, dirección de arte propia) vía el agente `visual-asset-generator`. Ver
`components/home/Hero.tsx` y `public/images/` para el resultado — actualizar este spec con
la ruta final y el prompt usado una vez cerrado.

## Sistema visual

### Paleta (del doc maestro, sección 5 — no un default genérico)

| Token | Hex | Uso |
|---|---|---|
| `--navy` | `#03142F` | Fondo hero, header, footer, secciones oscuras |
| `--blue` | `#1455E6` | Botones primarios, links |
| `--cyan` | `#00B8F5` | Acentos, nodos, gráficos, foco |
| `--teal` | `#12C7B4` | Acento secundario, degradados |
| `--green` | `#38D978` | Estados positivos, resultados |
| `--ink` | `#101827` | Texto sobre fondo claro |
| `--paper` | `#F4F7FB` | Fondo claro alterno |
| `--gray` | `#48556A` | Texto secundario |

Botones tipo cápsula (radio 12px o full), tarjetas con radio 16–24px, bordes finos gris
azulado, sombras suaves, iconos lineales (lucide-react).

### Tipografía

- Títulos: **Sora** (geométrica, redondeada — amigable sin caer en corporate genérico).
- Cuerpo/UI: **Inter**.
- Números/indicadores: **Inter** con `font-variant-numeric: tabular-nums`.

Ambas se cargan vía `next/font/google`, igual patrón que `Geist`/`Geist_Mono` en
`app/layout.tsx`.

### Firma visual

El motivo de "nodos + línea de pulso" del logo es el hilo conductor de toda la página:
fondo sutil de nodos dispersos en el hero (muy tenue, `opacity` baja, no compite con el
texto), la línea literal de 5 nodos en "Cómo funciona" (así lo pide el doc, sección 8.5),
y como micro-detalle en los degradados de las secciones oscuras (hero, plataforma, cierre).
El resto de la página se mantiene disciplinado: tarjetas limpias, mucho blanco, sin
decoración adicional — un solo elemento memorable, no varios compitiendo.

### Fotografía → tratamiento ilustrado

El doc pide fotografías reales de trabajadores; no existen todavía. En su lugar: ilustración
abstracta basada en el lenguaje del logo (nodos, líneas, formas orgánicas con degradado
navy→cian) en el hero y en "Sección plataforma". Evita el riesgo de fotos de stock genéricas
y refuerza el concepto de "neurotecnología" que pide el doc (sección 4). Las tarjetas de
indicadores y el mockup ilustrado del dashboard llevan el peso de "esto es real y útil".

### Accesibilidad

WCAG 2.2 AA (requisito explícito del doc, sección 5 y 27): jerarquía semántica de
encabezados (un solo `h1` en el hero, `h2` por sección), `alt` en imágenes con contenido,
`aria-hidden` en decoración, foco visible con anillo cian, contraste verificado en texto
sobre navy y sobre paper, `prefers-reduced-motion` respetado (ver Motion), tamaño táctil
suficiente en botones/inputs.

## Estructura de página

Un solo scroll largo (`app/page.tsx`), orden exacto de la sección 8 del doc maestro,
alternando fondos claros/oscuros:

| # | Sección | Fondo | Componente |
|---|---------|-------|------------|
| 1 | Header | transparente → navy on scroll | `components/home/Header.tsx` |
| 2 | Hero | navy, degradado navy→cian | `components/home/Hero.tsx` |
| 3 | Franja de confianza | paper | `components/home/TrustStrip.tsx` |
| 4 | Problema | blanco | `components/home/ProblemSection.tsx` |
| 5 | Cómo funciona | paper | `components/home/HowItWorks.tsx` |
| 6 | Funcionalidades | blanco | `components/home/Features.tsx` |
| 7 | Beneficios por perfil | paper | `components/home/BenefitsAccordion.tsx` |
| 8 | Casos de uso | blanco | `components/home/UseCases.tsx` |
| 9 | Sección plataforma | navy | `components/home/PlatformShowcase.tsx` |
| 10 | Privacidad | paper | `components/home/PrivacySection.tsx` |
| 11 | Resultados | blanco | `components/home/ResultsSection.tsx` |
| 12 | Calculadora de impacto | paper | `components/home/ImpactCalculator.tsx` |
| 13 | FAQ | blanco | `components/home/Faq.tsx` |
| 14 | Cierre + Footer | navy | `components/home/ClosingCta.tsx`, `components/home/Footer.tsx` |
| — | Modal de demo | — | `components/home/DemoRequestSheet.tsx` (invocado desde Header y CTAs) |

Todo el copy en español vive en `lib/home/content.ts` como constantes tipadas — un solo
lugar para editar texto sin tocar componentes. El contenido exacto de cada sección está
transcrito abajo (fuente: sección 8 del doc maestro).

### Navegación del header

- **Cómo funciona** → ancla a `#como-funciona` (sección 5, en esta misma Home).
- **Plataforma** → ancla a `#plataforma` (sección 9).
- **Seguridad** → ancla a `#privacidad` (sección 10).
- **Soluciones** → ancla a `#beneficios` (sección 7, "Beneficios por perfil").
- **Recursos** → deshabilitado, `aria-disabled`, tooltip "Próximamente" (no hay blog/CMS
  aún — no crear un link roto).
- **Ingresar** → `/login`, página stub nueva (`app/login/page.tsx`) con mensaje "Plataforma
  en construcción" y logo — no hay auth real todavía.
- **Solicitar demostración** → abre `DemoRequestSheet`.

El header empieza transparente sobre el hero (que siempre es oscuro) y pasa a fondo
`--navy` sólido al hacer scroll (listener de scroll con `useState`, `'use client'`).

## Copy exacto por sección

(Transcrito literal desde `_source/inbstrucciones.txt`, sección 8, para que la
implementación no dependa de releer el doc de 1555 líneas.)

**Hero**
- Título: "Convierte el ausentismo en decisiones preventivas."
- Texto: "HealthScope reúne datos de licencias y ausencias, identifica patrones
  organizacionales, prioriza riesgos y transforma los hallazgos en planes de acción
  medibles."
- Botones: "Solicitar demostración" (primario, abre `DemoRequestSheet`) / "Ver cómo
  funciona" (secundario, ancla a `#como-funciona`).
- Microtexto: "Diseñado para Recursos Humanos, Prevención, Salud Ocupacional y Gerencia."
- Tarjetas demo superpuestas (4): "Días de ausencia", "Episodios recurrentes", "Áreas con
  mayor variación", "Intervenciones activas" — con valores de ejemplo, etiquetadas como
  demostración. **No mostrar diagnósticos individuales.**

**Franja de confianza** (5 items, ícono + label corto)
"Privacidad desde el diseño" · "Información agregada y protegida" · "Trazabilidad
completa" · "Alertas configurables" · "Intervenciones medibles". No usar sellos o
certificaciones que no existan.

**Problema**
- Título: "La empresa ya tiene los datos. Lo difícil es entender qué significan."
- Texto: "Las licencias, ausencias, turnos, áreas y costos suelen quedar repartidos entre
  planillas, correos y sistemas de Recursos Humanos. HealthScope los ordena y muestra dónde
  se concentran los cambios, qué factores requieren revisión y qué acciones pueden
  evaluarse."
- Tarjetas (3): "Datos dispersos" · "Poca visibilidad de patrones" · "Acciones sin medición
  posterior".

**Cómo funciona** (línea de 5 nodos, id `como-funciona`)
1. Conecta o importa datos.
2. Normaliza y clasifica.
3. Detecta tendencias y prioridades.
4. Activa planes de acción.
5. Mide el impacto.

**Funcionalidades**
- Título: "Todo lo necesario para pasar del dato a la acción."
- Tarjetas (12): Analítica de ausentismo · Clasificación y taxonomías · Mapas de calor ·
  Alertas tempranas · Planes de acción · Campañas preventivas · Red de profesionales ·
  Seguimiento de resultados · Informes ejecutivos · Integraciones · Privacidad y auditoría ·
  Encuestas anónimas.

**Beneficios por perfil** (acordeón, id `beneficios`, 5 roles)
- RR.HH.: Centraliza registros · Reduce trabajo manual · Detecta recurrencia y ausencias
  prolongadas · Coordina acciones · Controla permisos y trazabilidad.
- Jefaturas: Recibe alertas cuando corresponde · Ve información agregada de su área ·
  Accede a guías preventivas · Registra acciones.
- Prevención y Salud Ocupacional: Prioriza evaluaciones · Administra campañas · Coordina
  derivaciones · Mide intervenciones.
- Gerencia: Compara áreas y períodos · Prioriza presupuesto · Revisa resultados · Supervisa
  cumplimiento.
- Trabajadores: Accede a campañas y material · Recibe recordatorios · Responde encuestas
  voluntarias · Mantiene protegida su información sensible.

**Casos de uso** (10, cada uno con señal / datos / acción / indicador de resultado /
limitaciones)
Aumento de ausencias en una sucursal · Reincidencia en un turno · Concentración de
accidentes · Tendencia musculoesquelética agregada · Tendencia de salud mental agregada ·
Campaña de vacunación · Programa de ergonomía · Retorno al trabajo · Evaluación de
proveedores · Comparación antes y después.

**Sección plataforma** (id `plataforma`, fondo navy)
- Título: "Una vista clara para decisiones complejas."
- Texto: "Explora tendencias, filtra por estructura organizacional, administra alertas y
  convierte cada hallazgo en un plan con responsables, fechas e indicadores."
- Botón: "Explorar la plataforma" → ancla a `#cierre` (no hay plataforma real a la que
  llevar todavía; no debe ser un link roto).

**Privacidad** (id `privacidad`)
- Título: "Diseñada para proteger información sensible."
- Mensajes (8): Separación administrativa y clínica · Accesos por rol · Cifrado ·
  Auditoría · Pseudonimización · Resultados agregados · Políticas de conservación ·
  Gestión de derechos de datos.
- Usar siempre "diseñada para apoyar el cumplimiento", nunca "cumplimiento garantizado".

**Resultados**
- Título: "Mide lo que cambia después de actuar."
- Gráfico con línea base, intervención, participación, evolución, costos estimados,
  período de comparación — marcado "datos de demostración".

**Calculadora de impacto** (ver Arquitectura técnica para la fórmula)

**FAQ** (acordeón, 11 preguntas — copy literal del doc)
1. ¿Reemplaza el sistema de RR.HH.?
2. ¿Puede integrarse con Excel, Talana, Buk, Rex+, SAP u otros?
3. ¿La empresa puede ver diagnósticos?
4. ¿Cómo se protegen los datos?
5. ¿Qué alertas genera?
6. ¿Cómo se miden las intervenciones?
7. ¿Funciona sin información clínica?
8. ¿Qué pasa si los datos están incompletos?
9. ¿La IA toma decisiones automáticamente?
10. ¿Se configura por sucursal, turno o centro de costo?
11. ¿Cómo se inicia un piloto?

Respuesta central (pregunta 3, la más sensible): "HealthScope funciona sin diagnóstico
individual mediante tipos de licencia, duración, frecuencia, recurrencia, accidentes,
estructura organizacional y encuestas agregadas. La información clínica autorizada se
mantiene separada y agregada."

**Cierre** (id `cierre`)
- Título: "Empieza por entender. Continúa con una acción medible."
- Texto: "Solicita una demostración y revisemos cómo convertir tus datos actuales en una
  estrategia de prevención y bienestar laboral."
- Botón: "Solicitar demostración" → abre `DemoRequestSheet`.

## Arquitectura técnica

### Componentes

Un archivo por sección (tabla arriba), todos en `components/home/`, ensamblados en
`app/page.tsx` (server component que solo importa y ordena — sin lógica). Los componentes
que necesitan estado o efectos (`Header` por el scroll, `BenefitsAccordion`/`Faq` por el
acordeón interactivo, `ImpactCalculator` por el cálculo, `DemoRequestSheet` por el
formulario) son `'use client'`; el resto son server components estáticos.

### Formulario de demo

`components/home/DemoRequestSheet.tsx` — shadcn `Sheet` con formulario `react-hook-form` +
`zod`. Campos: `nombre` (string, requerido), `empresa` (string, requerido), `email` (email,
requerido), `telefono` (string, opcional), `cargo` (string, opcional). Al enviar: inserta
en la tabla `demo_requests` vía `createClient()` de `lib/supabase/client.ts`. Muestra estado
de éxito ("Gracias, te contactaremos pronto") o error inline si falla el insert.

Tres puntos distintos de la página abren este mismo Sheet (el botón del Header, el CTA
primario del Hero, el CTA del Cierre) — el estado `open`/`onOpenChange` vive en
`app/page.tsx` (único `useState<boolean>`, `'use client'` en ese nivel o un wrapper
`HomeClientShell` que envuelve toda la página) y se pasa como props a `DemoRequestSheet` y
a cada botón que lo dispara. No se usa Context ni estado global — con tres consumidores un
`useState` levantado alcanza.

**Tabla nueva** (`supabase/schema.sql`, primer schema del proyecto):

```sql
create table demo_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  empresa text not null,
  email text not null,
  telefono text,
  cargo text
);

alter table demo_requests enable row level security;

create policy "Cualquiera puede solicitar demo"
  on demo_requests for insert
  to anon
  with check (true);
```

Sin política de `select` para `anon` — nadie puede leer las solicitudes con la clave
pública. Se revisan directo en el dashboard de Supabase (Table Editor) hasta que exista un
panel de administración.

### Calculadora de impacto

`lib/home/impactCalculator.ts` — función pura, sin dependencias de React ni Supabase (fácil
de testear):

```ts
export interface ImpactCalculatorInput {
  dotacion: number
  diasAusencia: number
  costoPromedioDiario: number
  horasExtra: number
  reemplazos: number
  costosAdministrativos: number
  mejoraHipotetica: number // 0-1, ej. 0.15 = 15%
}

export interface ImpactScenario {
  nombre: 'conservador' | 'moderado' | 'alto'
  factor: number
  ahorroEstimado: number
}

export function calcularImpacto(input: ImpactCalculatorInput): {
  costoActual: number
  escenarios: ImpactScenario[]
} {
  const costoActual =
    input.diasAusencia * input.costoPromedioDiario +
    input.horasExtra +
    input.reemplazos +
    input.costosAdministrativos

  const factores: Array<[ImpactScenario['nombre'], number]> = [
    ['conservador', 0.5],
    ['moderado', 1.0],
    ['alto', 1.5],
  ]

  const escenarios = factores.map(([nombre, factor]) => ({
    nombre,
    factor,
    ahorroEstimado: costoActual * input.mejoraHipotetica * factor,
  }))

  return { costoActual, escenarios }
}
```

`ImpactCalculator.tsx` (client) mantiene el `input` en `useState`, llama
`calcularImpacto` en cada cambio, muestra `costoActual` y las 3 tarjetas de escenario.
Debajo de los resultados, texto fijo: la fórmula visible en pantalla (transparencia, punto
14 de los principios del doc) y la nota "Estimación basada en tus supuestos, no un ahorro
garantizado".

### Motion

`motion` (ya instalado) para: entrada escalonada del hero (fade + slide-up, ~400ms,
`staggerChildren`), reveals al hacer scroll en cada sección (`whileInView`, `viewport={{
once: true }}`, offset pequeño), el trazo progresivo de la línea de 5 nodos en "Cómo
funciona", hover-lift sutil en tarjetas de funcionalidades/casos de uso. Todas las
animaciones usan `useReducedMotion()` de `motion/react` para desactivarse si el usuario
prefiere movimiento reducido. Nada de parallax ni efectos pesados (instrucción explícita
del doc, sección 26, y necesario para Core Web Vitals).

### SEO

`app/page.tsx` exporta `metadata` (o el `layout.tsx` raíz se ajusta): título "HealthScope |
Inteligencia de ausentismo y salud laboral", descripción "Analiza licencias y ausencias,
detecta tendencias, administra intervenciones y mide resultados con una plataforma para
Recursos Humanos y salud ocupacional." (copy exacto del doc, sección 9). Todas las imágenes
con `alt` descriptivo; las decorativas (nodos de fondo) con `aria-hidden`.

### Página stub de login

`app/login/page.tsx` — página simple, sin formulario funcional: logo, mensaje "Plataforma
en construcción", link de vuelta a Home. No usa Supabase auth todavía (la plataforma
privada es un spec futuro).

## Testing

- `lib/home/impactCalculator.test.ts` (Vitest, no existe aún el runner — se agrega en este
  spec): casos con valores de ejemplo del doc, un caso con `mejoraHipotetica = 0` (ahorro
  debe ser 0 en los 3 escenarios), un caso con inputs en cero (costoActual = 0, sin
  división por cero en ningún cálculo).
- Sin tests de componentes React (mismo patrón que el módulo PMO de condor-crm — solo
  funciones puras en `lib/` se testean).
- Verificación manual en navegador (ver checklist abajo).

## Verificación

1. `npx tsc --noEmit` limpio.
2. `npx vitest run` — `impactCalculator.test.ts` en verde.
3. `npm run build` (usar `NODE_OPTIONS=--max-old-space-size=4096` si el sandbox local
   vuelve a quedarse sin memoria, mismo patrón visto en condor-crm).
4. Revisión visual en navegador: recorrer las 14 secciones en orden, probar acordeón de
   beneficios y FAQ, probar la calculadora con números reales y confirmar que la fórmula
   mostrada en pantalla coincide con el resultado, enviar el formulario de demo y confirmar
   la fila nueva en `demo_requests` desde el Supabase Table Editor, revisar responsive en
   mobile (375px) y desktop, confirmar que el header pasa de transparente a navy sólido al
   hacer scroll, confirmar que "Recursos" está deshabilitado y "Ingresar" lleva al stub de
   `/login`.
5. Accesibilidad: navegación completa por teclado (incluyendo el Sheet del formulario y los
   acordeones), foco visible en todos los elementos interactivos, sin errores de contraste
   evidentes en texto sobre `--navy`.

## Global Constraints

- No Server Actions (consistente con el patrón de condor-crm) — inserts vía cliente de
  Supabase directo desde componentes `'use client'`.
- Paleta y tipografía exactas de la sección "Sistema visual" — no introducir colores fuera
  de esos 8 tokens sin volver a este spec.
- Copy en español, textual según la sección "Copy exacto por sección" — no parafrasear.
- Sin fotografía real (tratamiento ilustrado, ver Sistema visual).
- Sin animaciones pesadas / parallax — motion contenido, siempre respetando
  `prefers-reduced-motion`.
- No prometer cifras de ahorro garantizado en ningún texto (calculadora incluida) —
  siempre mostrar la fórmula y aclarar que es una estimación.
- No usar sellos, certificaciones, testimonios o clientes inventados en ningún punto de la
  página (principio explícito del doc maestro).
