import type { HomeContent } from './types'

export const content: HomeContent = {
  seo: {
    title: 'HealthScope | Absenteeism and occupational health intelligence',
    description:
      'Analyze medical leave and absences, detect trends, manage interventions, and measure outcomes with a platform for HR and occupational health teams.',
  },

  nav: {
    links: [
      { label: 'How it works', href: '#como-funciona', disabled: false },
      { label: 'Platform', href: '#plataforma', disabled: false },
      { label: 'Security', href: '#privacidad', disabled: false },
      { label: 'Solutions', href: '#beneficios', disabled: false },
      { label: 'Resources', href: '#', disabled: true },
    ],
    ingresar: { label: 'Sign in', href: '/login' },
    demoLabel: 'Request a demo',
    proximamente: 'Coming soon',
  },

  hero: {
    titulo: 'Turn absenteeism into preventive decisions.',
    texto:
      'HealthScope brings together medical leave and absence data, identifies organizational patterns, prioritizes risks, and turns findings into measurable action plans.',
    ctaPrimario: 'Request a demo',
    ctaSecundario: 'See how it works',
    microtexto: 'Built for HR, Prevention, Occupational Health, and Management teams.',
    tarjetas: [
      { label: 'Days of absence', valor: '412' },
      { label: 'Recurring episodes', valor: '38' },
      { label: 'Areas with the most variation', valor: '5' },
      { label: 'Active interventions', valor: '12' },
    ],
  },

  trustStrip: [
    'Privacy by design',
    'Aggregated and protected information',
    'Full traceability',
    'Configurable alerts',
    'Measurable interventions',
  ],

  problem: {
    titulo: 'The company already has the data. The hard part is understanding what it means.',
    texto:
      'Leave records, absences, shifts, areas, and costs are usually scattered across spreadsheets, emails, and HR systems. HealthScope organizes them and shows where changes concentrate, which factors need review, and which actions can be evaluated.',
    tarjetas: ['Scattered data', 'Little visibility into patterns', 'Actions with no follow-up measurement'],
  },

  howItWorks: {
    titulo: 'How it works',
    pasos: [
      'Connect or import data.',
      'Normalize and classify.',
      'Detect trends and priorities.',
      'Launch action plans.',
      'Measure the impact.',
    ],
  },

  features: {
    titulo: 'Everything you need to go from data to action.',
    tarjetas: [
      'Absenteeism analytics',
      'Classification and taxonomies',
      'Heat maps',
      'Early alerts',
      'Action plans',
      'Preventive campaigns',
      'Professional network',
      'Outcome tracking',
      'Executive reports',
      'Integrations',
      'Privacy and audit trail',
      'Anonymous surveys',
    ],
  },

  benefits: {
    titulo: 'Benefits by role',
    grupos: [
      {
        rol: 'Human Resources',
        items: [
          'Centralizes records',
          'Reduces manual work',
          'Detects recurrence and prolonged absences',
          'Coordinates actions',
          'Controls permissions and traceability',
        ],
      },
      {
        rol: 'Managers',
        items: [
          'Receives alerts when warranted',
          'Sees aggregated information for their area',
          'Accesses preventive guides',
          'Logs actions',
        ],
      },
      {
        rol: 'Prevention and Occupational Health',
        items: ['Prioritizes evaluations', 'Manages campaigns', 'Coordinates referrals', 'Measures interventions'],
      },
      {
        rol: 'Executives',
        items: ['Compares areas and periods', 'Prioritizes budget', 'Reviews outcomes', 'Oversees compliance'],
      },
      {
        rol: 'Employees',
        items: [
          'Accesses campaigns and materials',
          'Receives reminders',
          'Responds to voluntary surveys',
          'Keeps their sensitive information protected',
        ],
      },
    ],
  },

  useCases: {
    titulo: 'Use cases',
    labels: {
      senal: 'Signal',
      datos: 'Data',
      accion: 'Action',
      resultado: 'Outcome',
      limitaciones: 'Limitations',
    },
    items: [
      {
        titulo: 'Rising absences at one branch',
        senal: 'Sustained increase in lost days at a specific branch relative to its baseline.',
        datos: 'Episodes and lost days by branch, 3-month rolling period.',
        accion: 'Targeted action plan with local management and prevention.',
        resultado: "Change in the branch's absenteeism rate after the intervention.",
        limitaciones: 'Does not isolate external causes (seasonality, staffing changes).',
      },
      {
        titulo: 'Recurrence on a shift',
        senal: 'Concentration of recurring episodes on a specific shift.',
        datos: 'Frequency and recurrence by shift.',
        accion: 'Review of shift conditions with HR and management.',
        resultado: "Change in the shift's recurrence rate.",
        limitaciones: 'Requires sufficient staffing on the shift to be representative.',
      },
      {
        titulo: 'Concentration of accidents',
        senal: 'Increase in workplace accidents in an area or period.',
        datos: 'Episodes classified as workplace or commuting accidents.',
        accion: 'Risk assessment and accident prevention plan.',
        resultado: 'Change in accidents after the plan.',
        limitaciones: 'Data depends on the quality of the source record.',
      },
      {
        titulo: 'Aggregate musculoskeletal trend',
        senal: 'Aggregate increase in the musculoskeletal clinical category.',
        datos: 'Aggregated clinical classification, only with legal basis and an authorized provider.',
        accion: 'Targeted ergonomics program.',
        resultado: 'Evolution of the aggregate trend after the program.',
        limitaciones: 'Only available with an authorized clinical source; does not identify individuals.',
      },
      {
        titulo: 'Aggregate mental health trend',
        senal: 'Aggregate increase in the mental health clinical category.',
        datos: 'Aggregated clinical classification, only with legal basis and an authorized provider.',
        accion: 'Psychological support and preventive education campaign.',
        resultado: 'Evolution of the aggregate trend after the campaign.',
        limitaciones: 'Requires a minimum group size to avoid re-identification.',
      },
      {
        titulo: 'Vaccination campaign',
        senal: 'Seasonal window of respiratory risk.',
        datos: 'History of respiratory-related absences, participation in prior campaigns.',
        accion: 'Vaccination campaign with sign-up and scheduling.',
        resultado: 'Participation rate and change in respiratory absences.',
        limitaciones: 'Participation is voluntary; does not measure individual clinical effectiveness.',
      },
      {
        titulo: 'Ergonomics program',
        senal: 'Recurring episodes of aggregate musculoskeletal pain.',
        datos: 'Musculoskeletal pain surveys, classified episodes.',
        accion: 'Ergonomics program with evaluation and follow-up.',
        resultado: 'Change in episodes and in the follow-up survey.',
        limitaciones: 'Depends on voluntary survey participation.',
      },
      {
        titulo: 'Return to work',
        senal: 'Prolonged episode nearing closure.',
        datos: 'Episode duration, authorized functional accommodation.',
        accion: 'Gradual return plan with accommodations and follow-up.',
        resultado: 'Sustainability of the return (no relapse) at 90 days.',
        limitaciones: 'Management only receives the functional accommodation, not the diagnosis.',
      },
      {
        titulo: 'Provider evaluation',
        senal: 'Differences in outcomes between providers or professionals.',
        datos: 'Aggregated intervention outcomes by provider.',
        accion: 'Contract review and provider prioritization.',
        resultado: 'Comparison of outcomes across providers over time.',
        limitaciones: 'Requires enough case volume per provider to compare.',
      },
      {
        titulo: 'Before-and-after comparison',
        senal: 'Closure of an intervention or campaign.',
        datos: 'Baseline period, intervention period, follow-up period.',
        accion: 'Evaluation report with a stated methodology.',
        resultado: 'Percentage change relative to the baseline.',
        limitaciones: 'Does not attribute all improvement to the intervention without an evaluation design.',
      },
    ],
  },

  platformShowcase: {
    titulo: 'A clear view for complex decisions.',
    texto:
      'Explore trends, filter by organizational structure, manage alerts, and turn every finding into a plan with owners, dates, and indicators.',
    cta: 'Explore the platform',
  },

  privacy: {
    titulo: 'Built to protect sensitive information.',
    disclaimer: "Designed to support compliance with Chile's Law 21.719 on personal data protection.",
    mensajes: [
      'Administrative and clinical separation',
      'Role-based access',
      'Encryption',
      'Audit trail',
      'Pseudonymization',
      'Aggregated results',
      'Retention policies',
      'Data rights management',
    ],
  },

  results: {
    titulo: 'Measure what changes after you act.',
    etiquetaDemo: 'Demo data',
    periodoComparacion: 'comparison period: 6 months',
    barras: [
      { label: 'Baseline', valor: 68, color: '#48556A' },
      { label: 'Intervention', valor: 52, color: '#00B8F5' },
      { label: 'Current', valor: 41, color: '#38D978' },
    ],
  },

  impactCalculator: {
    titulo: 'Impact calculator',
    subtitulo: 'An estimate based on your assumptions, not a guaranteed saving.',
    campos: {
      dotacion: 'Headcount',
      diasAusencia: 'Days of absence (period)',
      costoPromedioDiario: 'Average daily cost ($)',
      horasExtra: 'Overtime ($ total)',
      reemplazos: 'Replacements ($ total)',
      costosAdministrativos: 'Administrative costs ($ total)',
      mejoraHipotetica: 'Hypothetical improvement (%, e.g. 15)',
    },
    costoActualLabel: 'Estimated current cost',
    escenarios: {
      conservador: 'Conservative',
      moderado: 'Moderate',
      alto: 'High',
    },
    formula:
      'Formula: current cost = days of absence × average daily cost + overtime + replacements + administrative costs. Estimated savings per scenario = current cost × hypothetical improvement × scenario factor (conservative ×0.5, moderate ×1.0, high ×1.5).',
  },

  faq: {
    titulo: 'Frequently asked questions',
    items: [
      {
        pregunta: 'Does it replace our HR system?',
        respuesta:
          'No. HealthScope integrates with your HR system (Excel, Talana, Buk, Rex+, SAP, or others) and focuses on analytics, alerts, and action plans, not personnel administration.',
      },
      {
        pregunta: 'Can it integrate with Excel, Talana, Buk, Rex+, SAP, or others?',
        respuesta: 'Yes, through file import and, in later phases, direct integrations with these systems.',
      },
      {
        pregunta: 'Can the company see diagnoses?',
        respuesta:
          'HealthScope works without individual diagnoses, using leave types, duration, frequency, recurrence, accidents, organizational structure, and aggregated surveys. Authorized clinical information stays separate and aggregated.',
      },
      {
        pregunta: 'How is data protected?',
        respuesta:
          'With encryption, role-based access control, pseudonymization, a full audit trail, and separation between administrative and clinical information.',
      },
      {
        pregunta: 'What alerts does it generate?',
        respuesta:
          'Configurable alerts by threshold, area, shift, recurrence, prolonged absences, and other patterns, always with human review.',
      },
      {
        pregunta: 'How are interventions measured?',
        respuesta: 'By comparing a baseline with the period after the intervention, using indicators and a stated methodology.',
      },
      {
        pregunta: 'Does it work without clinical information?',
        respuesta:
          'Yes. The administrative and analytical level does not require clinical information; the aggregated clinical level is optional and only with legal basis and an authorized provider.',
      },
      {
        pregunta: 'What happens if the data is incomplete?',
        respuesta: 'The data quality panel shows completeness, errors, and warnings before generating indicators.',
      },
      {
        pregunta: 'Does the AI make decisions automatically?',
        respuesta:
          'No. The AI supports with summaries, anomaly detection, and explainable recommendations, always with human review and an option to turn it off.',
      },
      {
        pregunta: 'Can it be configured by branch, shift, or cost center?',
        respuesta:
          'Yes, filters and alerts are configured by company, branch, unit, cost center, shift, and other organizational dimensions.',
      },
      {
        pregunta: 'How do we start a pilot?',
        respuesta: 'By requesting a demo: we review your current data and define a scoped initial rollout.',
      },
    ],
  },

  closing: {
    titulo: 'Start by understanding. Continue with a measurable action.',
    texto:
      "Request a demo and let's review how to turn your current data into a prevention and workplace wellbeing strategy.",
    cta: 'Request a demo',
  },

  footer: {
    tagline: 'Absenteeism and occupational health intelligence for Chilean companies.',
    productoTitulo: 'Product',
    producto: [
      { label: 'How it works', href: '#como-funciona' },
      { label: 'Platform', href: '#plataforma' },
      { label: 'Security and privacy', href: '#privacidad' },
    ],
    legalTitulo: 'Legal',
    legal: ['Terms', 'Privacy policy', 'Cookie policy'],
    proximamente: '(coming soon)',
    copyright: '© 2026 HealthScope. All rights reserved.',
  },

  demoSheet: {
    titulo: 'Request a demo',
    descripcion: "Tell us who you are and we'll reach out to schedule a demo.",
    exito: "Thanks, we'll be in touch soon.",
    error: "We couldn't send your request. Please try again.",
    campos: {
      nombre: 'Name',
      empresa: 'Company',
      email: 'Email',
      telefono: 'Phone (optional)',
      cargo: 'Role (optional)',
    },
    enviar: 'Send request',
    enviando: 'Sending…',
  },
}
