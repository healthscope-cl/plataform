# HealthScope — Empresa Activa (soporte multiempresa real)

**Fecha:** 2026-07-24
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** Criterio de Aceptación #18 de `referencia/instrucciones2.txt` ("Sea multiempresa"),
detectado como incumplido al revisar el documento tras completar el roadmap de 15 módulos + el
motor de recomendaciones.

## El problema

`empresas` es una tabla hija de `tenants` (un tenant puede tener más de una empresa) y 13 tablas
del modelo de datos (`personas`, `encuestas`, `eventos_seguridad`, `campanas`, `intervenciones`,
`profesionales`, etc.) están scoped por `empresa_id`. Pero 19 de los 29 `page.tsx` bajo
`app/plataforma/` — y el asistente de importación — resuelven "la" empresa del tenant con el mismo
bloque repetido:

```ts
const { data: empresaRows } = await supabase.from('empresas').select('*').limit(1)
```

(o su variante `select('id').limit(1)` cuando la página solo necesita el id para filtrar). Con más
de una empresa en el tenant, esto siempre devuelve la primera fila que entrega Postgres —
silenciosamente, sin selector, sin aviso — y el asistente de importación asigna todo dato nuevo a
esa misma empresa arbitraria.

El Topbar ya tiene un `EmpresaSwitcher` (`components/platform/EmpresaSwitcher.tsx`) que recibe la
lista real de empresas del tenant (`app/plataforma/layout.tsx:34`, sin `.limit()`, correctamente
scoped por RLS) y renderiza un `<Select>` cuando hay más de una. Pero el `<Select>` no tiene
`onValueChange`: elegir una opción distinta no cambia nada — es decorativo.

## Decisión de alcance: una empresa activa a la vez, no vista agregada

El documento solo exige "sea multiempresa", sin especificar el comportamiento. Se descartó
"agregar/promediar automáticamente todas las empresas del tenant en cada página" — requeriría
lógica de agregación nueva en las 19 páginas. Se eligió el modelo que el propio `EmpresaSwitcher`
ya insinúa (un `<Select>` de una sola opción, no multi-select): **el usuario elige una empresa
activa, y todas las páginas —incluida la escritura de datos nuevos vía importación— leen y
escriben solo esa empresa hasta que la cambie.**

Con una sola empresa en el tenant (el caso de hoy — el tenant demo), el comportamiento es idéntico
al actual: el switcher ya colapsa a una etiqueta fija cuando `empresas.length <= 1`.

## Persistencia: cookie de sesión, sin migración de schema

Se decidió **no** agregar un campo en `usuarios` para recordar la empresa activa entre
dispositivos — una cookie de sesión (httpOnly, 1 año, `path: '/'`) es suficiente y no requiere
migración. Si el usuario cambia de navegador o borra cookies, vuelve a la empresa por defecto (la
primera del tenant) — comportamiento aceptable, igual al de hoy.

## Arquitectura

**`lib/platform/empresa-activa.ts`** (nuevo) — una función pura de resolución:

```ts
export async function getEmpresaActiva(
  supabase: SupabaseClient
): Promise<Empresa | null>
```

Lee todas las empresas del tenant (`supabase.from('empresas').select('*')`, sin `.limit()` — RLS ya
las scoped por tenant), lee la cookie `empresa_activa` (vía `cookies()` de `next/headers`), y:
- Si no hay empresas: retorna `null` (mismo caso ya manejado hoy como "cuenta sin empresa
  configurada").
- Si la cookie apunta a un id presente en la lista: retorna esa empresa.
- Si no hay cookie, o la cookie apunta a un id que ya no está en la lista (tenant cambió, empresa
  eliminada, cookie de una sesión distinta): retorna la primera empresa de la lista — mismo
  fallback que el comportamiento actual, nunca un error visible al usuario.

Este helper reemplaza el bloque de 5 líneas repetido en las 19 páginas y en el asistente de
importación por una sola llamada. Las páginas que hoy solo usan `select('id')` (10 de las 19)
pasan a recibir el objeto `Empresa` completo y usar `.id` — una sola forma de resolver la empresa
en todo el proyecto, no dos.

**`app/api/platform/empresa-activa/route.ts`** (nuevo, Route Handler `POST`) — sigue el patrón de
mutación ya establecido en el proyecto (`app/api/platform/importaciones/*`,
`app/api/platform/usuarios/invitar`), no Server Actions (que este proyecto no usa en ningún otro
lugar). Recibe `{ empresaId: string }`, verifica sesión (`supabase.auth.getUser()`), confirma que
`empresaId` pertenece al tenant del usuario autenticado (consulta `empresas` scoped por RLS — si no
aparece, es de otro tenant o no existe, se responde 400), y si es válido escribe la cookie
`empresa_activa` en la respuesta. No requiere rol admin — cualquier usuario autenticado del tenant
puede cambiar su propia empresa activa, igual que hoy cualquiera puede ver el switcher.

**`components/platform/EmpresaSwitcher.tsx`** (modificado) — recibe una prop nueva
`empresaActivaId: string` (en vez de usar `defaultValue={empresas[0].id}` a ciegas). El `<Select>`
pasa a ser controlado (`value={empresaActivaId}`) con `onValueChange` que hace `fetch('/api/platform/empresa-activa', { method: 'POST', body: JSON.stringify({ empresaId }) })`
y, al resolver, `router.refresh()` — mismo patrón ya usado por `Topbar.handleLogout` (llamada
async + `router.refresh()`).

**`app/plataforma/layout.tsx`** (modificado) — ya hace `supabase.from('empresas').select('*')` sin
`.limit()` para poblar el switcher; se agrega una llamada a `getEmpresaActiva(supabase)` para saber
cuál pasar como `empresaActivaId` a `Topbar` → `EmpresaSwitcher` (hoy el switcher asume que la
"activa" es siempre `empresas[0]`, lo cual dejaría de ser cierto en cuanto alguien la cambie).

**19 páginas + el asistente de importación** (modificados, cambio mecánico e idéntico en cada
una): reemplazar el bloque `empresas.select('*'|'id').limit(1)` + su chequeo de "no hay empresa"
por `const empresa = await getEmpresaActiva(supabase)` + el mismo chequeo de `null` ya existente en
cada página (el mensaje "Esta cuenta todavía no tiene una empresa configurada." ya está escrito en
cada una, se mantiene igual).

## Testing

- `getEmpresaActiva()` no es una función pura simple (depende de `cookies()` y de una consulta a
  Supabase), así que no se testea con Vitest aislado — se verifica manualmente junto con el resto
  del flujo (Task de verificación manual, mismo patrón ya usado en todo este proyecto para páginas
  Server Component).
- El Route Handler se verifica manualmente: cambiar de empresa vía el switcher y confirmar que
  las páginas ya visitadas muestran datos de la nueva empresa; intentar (vía request directo) un
  `empresaId` de otro tenant y confirmar que se rechaza.
- Sin test automatizado nuevo de página — mismo patrón ya establecido en todo el roadmap.

## Explícitamente fuera de alcance

- Vista agregada o comparación entre empresas del mismo tenant (ver también sección 14 del
  documento, "Benchmark" — comparación entre *empresas distintas*, explícitamente fase futura y no
  relacionada con este cambio).
- Persistencia de la empresa activa en base de datos / entre dispositivos.
- Cualquier cambio a RLS o al schema de `empresas` — ya soportan multiempresa correctamente hoy;
  el problema era enteramente de las páginas, no de la base de datos.
- Restringir el cambio de empresa activa a un rol específico — cualquier usuario autenticado del
  tenant puede cambiarla, igual que cualquiera puede ver el switcher hoy.
