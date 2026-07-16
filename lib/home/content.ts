export const seo = {
  title: 'HealthScope | Inteligencia de ausentismo y salud laboral',
  description:
    'Analiza licencias y ausencias, detecta tendencias, administra intervenciones y mide resultados con una plataforma para Recursos Humanos y salud ocupacional.',
}

export const nav = {
  links: [
    { label: 'Cómo funciona', href: '#como-funciona', disabled: false },
    { label: 'Plataforma', href: '#plataforma', disabled: false },
    { label: 'Seguridad', href: '#privacidad', disabled: false },
    { label: 'Soluciones', href: '#beneficios', disabled: false },
    { label: 'Recursos', href: '#', disabled: true },
  ],
  ingresar: { label: 'Ingresar', href: '/login' },
  demoLabel: 'Solicitar demostración',
}

export const hero = {
  titulo: 'Convierte el ausentismo en decisiones preventivas.',
  texto:
    'HealthScope reúne datos de licencias y ausencias, identifica patrones organizacionales, prioriza riesgos y transforma los hallazgos en planes de acción medibles.',
  ctaPrimario: 'Solicitar demostración',
  ctaSecundario: 'Ver cómo funciona',
  microtexto: 'Diseñado para Recursos Humanos, Prevención, Salud Ocupacional y Gerencia.',
  tarjetas: [
    { label: 'Días de ausencia', valor: '412' },
    { label: 'Episodios recurrentes', valor: '38' },
    { label: 'Áreas con mayor variación', valor: '5' },
    { label: 'Intervenciones activas', valor: '12' },
  ],
}

export const trustStrip = [
  'Privacidad desde el diseño',
  'Información agregada y protegida',
  'Trazabilidad completa',
  'Alertas configurables',
  'Intervenciones medibles',
]

export const problem = {
  titulo: 'La empresa ya tiene los datos. Lo difícil es entender qué significan.',
  texto:
    'Las licencias, ausencias, turnos, áreas y costos suelen quedar repartidos entre planillas, correos y sistemas de Recursos Humanos. HealthScope los ordena y muestra dónde se concentran los cambios, qué factores requieren revisión y qué acciones pueden evaluarse.',
  tarjetas: ['Datos dispersos', 'Poca visibilidad de patrones', 'Acciones sin medición posterior'],
}

export const howItWorks = {
  pasos: [
    'Conecta o importa datos.',
    'Normaliza y clasifica.',
    'Detecta tendencias y prioridades.',
    'Activa planes de acción.',
    'Mide el impacto.',
  ],
}

export const features = {
  titulo: 'Todo lo necesario para pasar del dato a la acción.',
  tarjetas: [
    'Analítica de ausentismo',
    'Clasificación y taxonomías',
    'Mapas de calor',
    'Alertas tempranas',
    'Planes de acción',
    'Campañas preventivas',
    'Red de profesionales',
    'Seguimiento de resultados',
    'Informes ejecutivos',
    'Integraciones',
    'Privacidad y auditoría',
    'Encuestas anónimas',
  ],
}

export const benefits = [
  {
    rol: 'Recursos Humanos',
    items: [
      'Centraliza registros',
      'Reduce trabajo manual',
      'Detecta recurrencia y ausencias prolongadas',
      'Coordina acciones',
      'Controla permisos y trazabilidad',
    ],
  },
  {
    rol: 'Jefaturas',
    items: [
      'Recibe alertas cuando corresponde',
      'Ve información agregada de su área',
      'Accede a guías preventivas',
      'Registra acciones',
    ],
  },
  {
    rol: 'Prevención y Salud Ocupacional',
    items: ['Prioriza evaluaciones', 'Administra campañas', 'Coordina derivaciones', 'Mide intervenciones'],
  },
  {
    rol: 'Gerencia',
    items: ['Compara áreas y períodos', 'Prioriza presupuesto', 'Revisa resultados', 'Supervisa cumplimiento'],
  },
  {
    rol: 'Trabajadores',
    items: [
      'Accede a campañas y material',
      'Recibe recordatorios',
      'Responde encuestas voluntarias',
      'Mantiene protegida su información sensible',
    ],
  },
]

export const useCases = [
  {
    titulo: 'Aumento de ausencias en una sucursal',
    senal: 'Alza sostenida de días perdidos en una sucursal específica respecto de su línea base.',
    datos: 'Episodios y días perdidos por sucursal, período móvil de 3 meses.',
    accion: 'Plan de acción focalizado con jefatura local y prevención.',
    resultado: 'Variación de la tasa de ausentismo de la sucursal tras la intervención.',
    limitaciones: 'No aísla causas externas (estacionalidad, cambios de dotación).',
  },
  {
    titulo: 'Reincidencia en un turno',
    senal: 'Concentración de episodios recurrentes en un turno específico.',
    datos: 'Frecuencia y reincidencia por turno.',
    accion: 'Revisión de condiciones de turno con RR.HH. y jefatura.',
    resultado: 'Cambio en la tasa de reincidencia del turno.',
    limitaciones: 'Requiere suficiente dotación en el turno para ser representativo.',
  },
  {
    titulo: 'Concentración de accidentes',
    senal: 'Aumento de accidentes laborales en un área o período.',
    datos: 'Episodios clasificados como accidente laboral o de trayecto.',
    accion: 'Evaluación de riesgo y plan de prevención de accidentes.',
    resultado: 'Variación en accidentes tras el plan.',
    limitaciones: 'Los datos dependen de la calidad del registro de origen.',
  },
  {
    titulo: 'Tendencia musculoesquelética agregada',
    senal: 'Aumento agregado en la categoría clínica musculoesquelética.',
    datos: 'Clasificación clínica agregada, solo con base legal y proveedor autorizado.',
    accion: 'Programa de ergonomía focalizado.',
    resultado: 'Evolución de la tendencia agregada tras el programa.',
    limitaciones: 'Solo disponible con fuente clínica autorizada; no identifica personas.',
  },
  {
    titulo: 'Tendencia de salud mental agregada',
    senal: 'Aumento agregado en la categoría clínica de salud mental.',
    datos: 'Clasificación clínica agregada, solo con base legal y proveedor autorizado.',
    accion: 'Campaña de apoyo psicológico y educación preventiva.',
    resultado: 'Evolución de la tendencia agregada tras la campaña.',
    limitaciones: 'Requiere grupo mínimo para evitar reidentificación.',
  },
  {
    titulo: 'Campaña de vacunación',
    senal: 'Ventana estacional de riesgo respiratorio.',
    datos: 'Historial de ausencias por causas respiratorias, participación en campañas previas.',
    accion: 'Campaña de vacunación con inscripción y agenda.',
    resultado: 'Tasa de participación y variación de ausencias respiratorias.',
    limitaciones: 'La participación es voluntaria; no mide efectividad clínica individual.',
  },
  {
    titulo: 'Programa de ergonomía',
    senal: 'Episodios recurrentes de dolor musculoesquelético agregado.',
    datos: 'Encuestas de dolor musculoesquelético, episodios clasificados.',
    accion: 'Programa de ergonomía con evaluación y seguimiento.',
    resultado: 'Cambio en episodios y en encuesta de seguimiento.',
    limitaciones: 'Depende de la participación voluntaria en encuestas.',
  },
  {
    titulo: 'Retorno al trabajo',
    senal: 'Episodio prolongado próximo a cierre.',
    datos: 'Duración del episodio, adaptación funcional autorizada.',
    accion: 'Plan de retorno gradual con adaptaciones y seguimiento.',
    resultado: 'Sostenibilidad del retorno (sin recaída) a 90 días.',
    limitaciones: 'La jefatura solo recibe la adaptación funcional, no el diagnóstico.',
  },
  {
    titulo: 'Evaluación de proveedores',
    senal: 'Diferencias en resultados entre prestadores o profesionales.',
    datos: 'Resultados agregados de intervenciones por prestador.',
    accion: 'Revisión de convenio y priorización de prestadores.',
    resultado: 'Comparación de resultados entre prestadores en el tiempo.',
    limitaciones: 'Requiere volumen suficiente de casos por prestador para comparar.',
  },
  {
    titulo: 'Comparación antes y después',
    senal: 'Cierre de una intervención o campaña.',
    datos: 'Línea base, período de intervención, período posterior.',
    accion: 'Informe de evaluación con metodología declarada.',
    resultado: 'Cambio porcentual respecto a la línea base.',
    limitaciones: 'No atribuye toda la mejora a la intervención sin diseño de evaluación.',
  },
]

export const platformShowcase = {
  titulo: 'Una vista clara para decisiones complejas.',
  texto:
    'Explora tendencias, filtra por estructura organizacional, administra alertas y convierte cada hallazgo en un plan con responsables, fechas e indicadores.',
  cta: 'Explorar la plataforma',
}

export const privacy = {
  titulo: 'Diseñada para proteger información sensible.',
  mensajes: [
    'Separación administrativa y clínica',
    'Accesos por rol',
    'Cifrado',
    'Auditoría',
    'Pseudonimización',
    'Resultados agregados',
    'Políticas de conservación',
    'Gestión de derechos de datos',
  ],
}

export const results = {
  titulo: 'Mide lo que cambia después de actuar.',
  etiquetaDemo: 'Datos de demostración',
}

export const faq = [
  {
    pregunta: '¿Reemplaza el sistema de RR.HH.?',
    respuesta:
      'No. HealthScope se integra con tu sistema de RR.HH. (Excel, Talana, Buk, Rex+, SAP u otros) y se enfoca en analítica, alertas y planes de acción, no en administración de personal.',
  },
  {
    pregunta: '¿Puede integrarse con Excel, Talana, Buk, Rex+, SAP u otros?',
    respuesta: 'Sí, mediante importación de archivos y, en fases posteriores, integraciones directas con estos sistemas.',
  },
  {
    pregunta: '¿La empresa puede ver diagnósticos?',
    respuesta:
      'HealthScope funciona sin diagnóstico individual mediante tipos de licencia, duración, frecuencia, recurrencia, accidentes, estructura organizacional y encuestas agregadas. La información clínica autorizada se mantiene separada y agregada.',
  },
  {
    pregunta: '¿Cómo se protegen los datos?',
    respuesta:
      'Con cifrado, control de accesos por rol, pseudonimización, auditoría completa y separación entre información administrativa y clínica.',
  },
  {
    pregunta: '¿Qué alertas genera?',
    respuesta:
      'Alertas configurables por umbral, área, turno, reincidencia, ausencias prolongadas y otros patrones, siempre con revisión humana.',
  },
  {
    pregunta: '¿Cómo se miden las intervenciones?',
    respuesta: 'Comparando una línea base con el período posterior a la intervención, con indicadores y metodología declarada.',
  },
  {
    pregunta: '¿Funciona sin información clínica?',
    respuesta:
      'Sí. El nivel administrativo y analítico no requiere información clínica; el nivel clínico agregado es opcional y solo con base legal y proveedor autorizado.',
  },
  {
    pregunta: '¿Qué pasa si los datos están incompletos?',
    respuesta: 'El panel de calidad de datos muestra completitud, errores y advertencias antes de generar indicadores.',
  },
  {
    pregunta: '¿La IA toma decisiones automáticamente?',
    respuesta:
      'No. La IA apoya con resúmenes, detección de anomalías y recomendaciones explicables, siempre con revisión humana y opción de desactivarse.',
  },
  {
    pregunta: '¿Se configura por sucursal, turno o centro de costo?',
    respuesta:
      'Sí, los filtros y alertas se configuran por empresa, sucursal, unidad, centro de costo, turno y otras dimensiones organizacionales.',
  },
  {
    pregunta: '¿Cómo se inicia un piloto?',
    respuesta: 'Solicitando una demostración: revisamos tus datos actuales y definimos un alcance inicial acotado.',
  },
]

export const closing = {
  titulo: 'Empieza por entender. Continúa con una acción medible.',
  texto:
    'Solicita una demostración y revisemos cómo convertir tus datos actuales en una estrategia de prevención y bienestar laboral.',
  cta: 'Solicitar demostración',
}

export const footer = {
  tagline: 'Inteligencia de ausentismo y salud laboral para empresas chilenas.',
  producto: [
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Plataforma', href: '#plataforma' },
    { label: 'Seguridad y privacidad', href: '#privacidad' },
  ],
  legal: ['Términos', 'Política de privacidad', 'Política de cookies'],
  copyright: '© 2026 HealthScope. Todos los derechos reservados.',
}
