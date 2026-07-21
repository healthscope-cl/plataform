export type PreguntaCatalogo = { id: string; texto: string }

export const CATALOGO_PREGUNTAS: PreguntaCatalogo[] = [
  { id: 'estres', texto: 'Nivel de estrés percibido esta semana' },
  { id: 'fatiga', texto: 'Nivel de fatiga percibida esta semana' },
  { id: 'sueno', texto: 'Calidad del sueño esta semana' },
  { id: 'carga', texto: 'Percepción de carga de trabajo' },
  { id: 'dolor_musculoesqueletico', texto: 'Molestias musculoesqueléticas (espalda, cuello, muñecas)' },
  { id: 'liderazgo', texto: 'Percepción de apoyo de la jefatura directa' },
  { id: 'conciliacion', texto: 'Equilibrio entre trabajo y vida personal' },
  { id: 'pausas_activas', texto: 'Cumplimiento de pausas activas durante la jornada' },
]
