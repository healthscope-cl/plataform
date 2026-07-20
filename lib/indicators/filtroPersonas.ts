export type FiltroGrupo = {
  sucursalId: string | null
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
}

export type PersonaConGrupo = {
  id: string
  unidadId: string | null
  cargoId: string | null
  turnoId: string | null
}

export function filtrarPersonas<T extends PersonaConGrupo>(
  personas: T[],
  filtro: FiltroGrupo,
  unidades: Array<{ id: string; sucursalId: string }>
): T[] {
  const unidadIdsDeSucursal = filtro.sucursalId
    ? new Set(unidades.filter((u) => u.sucursalId === filtro.sucursalId).map((u) => u.id))
    : null

  return personas.filter((persona) => {
    if (unidadIdsDeSucursal && (!persona.unidadId || !unidadIdsDeSucursal.has(persona.unidadId))) return false
    if (filtro.unidadId && persona.unidadId !== filtro.unidadId) return false
    if (filtro.cargoId && persona.cargoId !== filtro.cargoId) return false
    if (filtro.turnoId && persona.turnoId !== filtro.turnoId) return false
    return true
  })
}
