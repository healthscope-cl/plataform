import { describe, expect, it } from 'vitest'
import { clasificarEpisodio } from './classification'

describe('clasificarEpisodio', () => {
  it('classifies accidents by administrative type regardless of duration', () => {
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'accidente_laboral', dias: 2, episodiosPrevios12Meses: 0 })
    ).toBe('accidente')
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'accidente_trayecto', dias: 30, episodiosPrevios12Meses: 0 })
    ).toBe('accidente')
  })

  it('classifies enfermedad_profesional and maternal by administrative type', () => {
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'enfermedad_profesional', dias: 5, episodiosPrevios12Meses: 0 })
    ).toBe('enfermedad_profesional')
    expect(clasificarEpisodio({ tipoAdministrativo: 'maternal', dias: 100, episodiosPrevios12Meses: 0 })).toBe(
      'maternal'
    )
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'patologia_embarazo', dias: 20, episodiosPrevios12Meses: 0 })
    ).toBe('maternal')
  })

  it('classifies enfermedad_grave_hijo_menor as cuidado_familiar', () => {
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'enfermedad_grave_hijo_menor', dias: 3, episodiosPrevios12Meses: 0 })
    ).toBe('cuidado_familiar')
  })

  it('classifies common-illness episodes by duration when not recurrent', () => {
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: 2, episodiosPrevios12Meses: 0 })).toBe(
      'corto'
    )
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: 5, episodiosPrevios12Meses: 0 })).toBe(
      'mediano'
    )
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: 31, episodiosPrevios12Meses: 0 })).toBe(
      'prolongado'
    )
  })

  it('classifies as recurrente when the person has 2+ prior episodes in 12 months, overriding duration', () => {
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: 2, episodiosPrevios12Meses: 2 })).toBe(
      'recurrente'
    )
  })

  it('treats prorroga_medicina_preventiva as continuacion', () => {
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'prorroga_medicina_preventiva', dias: 10, episodiosPrevios12Meses: 0 })
    ).toBe('continuacion')
  })

  it('classifies non-clinical administrative types (permits, vacation, unjustified) as sin_clasificar', () => {
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'permiso_administrativo', dias: 1, episodiosPrevios12Meses: 0 })
    ).toBe('sin_clasificar')
    expect(clasificarEpisodio({ tipoAdministrativo: 'vacaciones', dias: 15, episodiosPrevios12Meses: 0 })).toBe(
      'sin_clasificar'
    )
    expect(
      clasificarEpisodio({ tipoAdministrativo: 'ausencia_injustificada', dias: 1, episodiosPrevios12Meses: 0 })
    ).toBe('sin_clasificar')
    expect(clasificarEpisodio({ tipoAdministrativo: 'otros', dias: 4, episodiosPrevios12Meses: 0 })).toBe(
      'sin_clasificar'
    )
  })

  it('returns calidad_insuficiente when dias is not a positive number', () => {
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: 0, episodiosPrevios12Meses: 0 })).toBe(
      'calidad_insuficiente'
    )
    expect(clasificarEpisodio({ tipoAdministrativo: 'enfermedad_comun', dias: -1, episodiosPrevios12Meses: 0 })).toBe(
      'calidad_insuficiente'
    )
  })
})
