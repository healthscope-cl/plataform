import { normalize } from './columnMapping'

export type CatalogoSimple = { id: string; nombre: string }
export type CatalogoUnidad = { id: string; nombre: string; sucursalId: string }

export function resolveIdPorNombre(nombre: string | null, catalogo: CatalogoSimple[]): string | null {
  if (!nombre) return null
  const normalizado = normalize(nombre)
  return catalogo.find((item) => normalize(item.nombre) === normalizado)?.id ?? null
}

// When the sheet also provides a Sucursal column, use it to disambiguate — unidad names are
// only unique within a sucursal in this schema (two branches can both have a "Ventas" unit).
// Without a Sucursal value, fall back to the first unidad matching that name anywhere in the
// empresa's catalog.
export function resolveUnidadId(
  unidadNombre: string | null,
  sucursalNombre: string | null,
  sucursales: CatalogoSimple[],
  unidades: CatalogoUnidad[]
): string | null {
  if (!unidadNombre) return null
  const unidadNormalizada = normalize(unidadNombre)

  if (sucursalNombre) {
    const sucursalId = resolveIdPorNombre(sucursalNombre, sucursales)
    if (!sucursalId) return null
    return unidades.find((u) => u.sucursalId === sucursalId && normalize(u.nombre) === unidadNormalizada)?.id ?? null
  }

  return unidades.find((u) => normalize(u.nombre) === unidadNormalizada)?.id ?? null
}
