# HealthScope — Integraciones

**Fecha:** 2026-07-24
**Estado:** Aprobado por el usuario — listo para plan de implementación.
**Responde a:** `referencia/instrucciones2.txt`, módulo 14 ("Integraciones": Excel, CSV, HRIS,
ERP, API, IMED, Medipass, Sistemas propios) — decimotercera pieza preventiva del roadmap,
después de encuestas, seguridad laboral, ergonomía, intervenciones, campañas, profesionales,
reportes, bienestar preventivo, ausencias y licencias, calidad de datos, y seguimiento de
campañas.

## Decisión de alcance: página de estado, no conectores reales

El documento pide 8 fuentes de integración. Ninguna de las 6 externas (HRIS, ERP, API, IMED,
Medipass, Sistemas propios) es viable de construir como conector funcional real en esta fase:
no existen credenciales, contratos ni acuerdos con esos sistemas, y la sección 6 del propio
documento lo prohíbe explícitamente — *"Nunca asumir que HealthScope puede entrar directamente
a las bases de IMED o Medipass"*. Solo Excel/CSV ya existe y funciona (el asistente de
importación construido en la fase de ingesta).

Por eso este módulo construye una **página de estado/catálogo**, no integraciones
funcionales: muestra honestamente qué canal está activo (Excel/CSV, con estadísticas reales)
y cuáles no están configurados todavía (los otros 6), junto con una descripción de cómo se
conectaría cada uno cuando corresponda — según los principios de la sección 6 del documento
(exportación autorizada, API contratada, integración autorizada, nunca acceso directo).

## Arquitectura: sin tabla nueva, sin componente nuevo

Este es el primer módulo de todo este bloque que no necesita ni siquiera un componente
separado — 7 de las 8 tarjetas son texto estático, y la única dinámica (Excel/CSV) es una
consulta simple sobre `importaciones`, ya existente. Todo cabe en el propio archivo de la
página.

**Excel / CSV se muestra como una sola fuente, no dos separadas.** El asistente de
importación ya procesa ambos formatos con la misma función (`parseSpreadsheet()`) — mostrarlos
como dos tarjetas distintas implicaría un canal doble que no existe en el código real.

## Contenido de la página

Ocho fuentes en total (7 tarjetas, ya que Excel/CSV se combina en una):

1. **Excel / CSV — Activa.** Estadísticas reales sobre `importaciones` (misma tabla que ya
   usa Calidad de Datos e Historial de importaciones, sin tocar ninguna de esas páginas):
   total de importaciones realizadas, suma de filas procesadas across todas, y la importación
   más reciente (fecha, archivo, estado) — mismo tipo de "última actualización" que ya usa
   Calidad de Datos, pero aquí como indicador de salud del canal, no de calidad de los datos
   en sí.
2. **HRIS — No configurada.** *"Se conecta mediante una exportación periódica autorizada del
   sistema de Recursos Humanos del cliente — no acceso directo a su base de datos."*
3. **ERP — No configurada.** *"Requiere una integración autorizada con el ERP del cliente
   (exportación de asistencia, turnos u otros datos relevantes) — no acceso directo."*
4. **API — No configurada.** *"Requiere una API contratada y autorizada explícitamente por el
   cliente — HealthScope no expone ni consume APIs sin esa autorización."*
5. **IMED — No configurada.** *"Nunca acceso directo a la base de IMED — solo mediante
   exportación autorizada del empleador o datos clínicos agregados enviados por el
   prestador."*
6. **Medipass — No configurada.** Mismo principio que IMED — nunca acceso directo, solo
   exportación autorizada o datos agregados del prestador.
7. **Sistemas propios — No configurada.** *"Se evalúa caso a caso según qué pueda exportar de
   forma segura el sistema propio del cliente (típicamente Excel/CSV o una API contratada)."*

Cada tarjeta no-Excel/CSV es texto puro — sin formulario, sin botón de "conectar", sin ningún
estado que cambiar. No hay ninguna acción posible desde esta página todavía.

## Interfaz y acceso

- **`/plataforma/integraciones`** (nueva). Entrada de navegación "Integraciones" con
  `adminOnly: true` — mismo patrón que todas las páginas admin-only ya existentes. Se ubica
  junto a "Historial de importaciones"/"Calidad de datos" en el Sidebar, ya que
  conceptualmente pertenece al mismo grupo de páginas relacionadas con la ingesta de datos.
- Sin formulario, sin filtros, sin acciones de escritura.

## Testing

- Sin función pura nueva — el conteo/suma sobre `importaciones` es una reducción trivial,
  mismo criterio ya aplicado en el resto del proyecto.
- Sin prueba automatizada para la página, mismo patrón ya establecido.
- Verificación manual explícita (controller-only): confirmar que el total de importaciones y
  la suma de filas procesadas coinciden con un conteo manual sobre `importaciones` de esa
  empresa, y que las 6 tarjetas "No configurada" muestran el texto correcto.

## Explícitamente fuera de alcance (fases posteriores)

- Cualquier conector funcional real (HRIS, ERP, API, IMED, Medipass, Sistemas propios) — todos
  requieren credenciales/contratos reales que no existen hoy.
- Cualquier flujo de "solicitar conexión" o formulario de contacto desde esta página.
- Historial o estado detallado por fuente más allá de lo que ya existe para Excel/CSV
  (Historial de importaciones, Calidad de Datos) — esta página no duplica esas vistas, solo
  resume el estado del canal.
