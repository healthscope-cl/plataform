import type { HomeContent } from './types'

export const content: HomeContent = {
  seo: {
    title: 'HealthScope | Inteligência de absenteísmo e saúde ocupacional',
    description:
      'Analise licenças e ausências, detecte tendências, administre intervenções e meça resultados com uma plataforma para RH e saúde ocupacional.',
  },

  nav: {
    links: [
      { label: 'Como funciona', href: '#como-funciona', disabled: false },
      { label: 'Plataforma', href: '#plataforma', disabled: false },
      { label: 'Segurança', href: '#privacidad', disabled: false },
      { label: 'Soluções', href: '#beneficios', disabled: false },
      { label: 'Recursos', href: '#', disabled: true },
    ],
    ingresar: { label: 'Entrar', href: '/login' },
    demoLabel: 'Solicitar demonstração',
    proximamente: 'Em breve',
  },

  hero: {
    titulo: 'Transforme o absenteísmo em decisões preventivas.',
    texto:
      'A HealthScope reúne dados de licenças e ausências, identifica padrões organizacionais, prioriza riscos e transforma os achados em planos de ação mensuráveis.',
    ctaPrimario: 'Solicitar demonstração',
    ctaSecundario: 'Ver como funciona',
    microtexto: 'Feito para RH, Prevenção, Saúde Ocupacional e Gerência.',
    tarjetas: [
      { label: 'Dias de ausência', valor: '412' },
      { label: 'Episódios recorrentes', valor: '38' },
      { label: 'Áreas com maior variação', valor: '5' },
      { label: 'Intervenções ativas', valor: '12' },
    ],
  },

  trustStrip: [
    'Privacidade desde a concepção',
    'Informação agregada e protegida',
    'Rastreabilidade completa',
    'Alertas configuráveis',
    'Intervenções mensuráveis',
  ],

  problem: {
    titulo: 'A empresa já tem os dados. O difícil é entender o que significam.',
    texto:
      'Licenças, ausências, turnos, áreas e custos costumam ficar dispersos entre planilhas, e-mails e sistemas de RH. A HealthScope os organiza e mostra onde as mudanças se concentram, quais fatores exigem revisão e quais ações podem ser avaliadas.',
    tarjetas: ['Dados dispersos', 'Pouca visibilidade de padrões', 'Ações sem medição posterior'],
  },

  howItWorks: {
    titulo: 'Como funciona',
    pasos: [
      'Conecte ou importe dados.',
      'Normalize e classifique.',
      'Detecte tendências e prioridades.',
      'Ative planos de ação.',
      'Meça o impacto.',
    ],
  },

  features: {
    titulo: 'Tudo o que você precisa para transformar dado em ação.',
    tarjetas: [
      'Analítica de absenteísmo',
      'Classificação e taxonomias',
      'Mapas de calor',
      'Alertas antecipados',
      'Planos de ação',
      'Campanhas preventivas',
      'Rede de profissionais',
      'Acompanhamento de resultados',
      'Relatórios executivos',
      'Integrações',
      'Privacidade e auditoria',
      'Pesquisas anônimas',
    ],
  },

  benefits: {
    titulo: 'Benefícios por perfil',
    grupos: [
      {
        rol: 'Recursos Humanos',
        items: [
          'Centraliza registros',
          'Reduz trabalho manual',
          'Detecta recorrência e ausências prolongadas',
          'Coordena ações',
          'Controla permissões e rastreabilidade',
        ],
      },
      {
        rol: 'Chefias',
        items: [
          'Recebe alertas quando necessário',
          'Vê informação agregada da sua área',
          'Acessa guias preventivos',
          'Registra ações',
        ],
      },
      {
        rol: 'Prevenção e Saúde Ocupacional',
        items: ['Prioriza avaliações', 'Administra campanhas', 'Coordena encaminhamentos', 'Mede intervenções'],
      },
      {
        rol: 'Gerência',
        items: ['Compara áreas e períodos', 'Prioriza orçamento', 'Revisa resultados', 'Supervisiona conformidade'],
      },
      {
        rol: 'Colaboradores',
        items: [
          'Acessa campanhas e materiais',
          'Recebe lembretes',
          'Responde pesquisas voluntárias',
          'Mantém protegida sua informação sensível',
        ],
      },
    ],
  },

  useCases: {
    titulo: 'Casos de uso',
    labels: {
      senal: 'Sinal',
      datos: 'Dados',
      accion: 'Ação',
      resultado: 'Resultado',
      limitaciones: 'Limitações',
    },
    items: [
      {
        titulo: 'Aumento de ausências em uma filial',
        senal: 'Alta sustentada de dias perdidos em uma filial específica em relação à sua linha de base.',
        datos: 'Episódios e dias perdidos por filial, período móvel de 3 meses.',
        accion: 'Plano de ação focalizado com a chefia local e prevenção.',
        resultado: 'Variação da taxa de absenteísmo da filial após a intervenção.',
        limitaciones: 'Não isola causas externas (sazonalidade, mudanças de quadro).',
      },
      {
        titulo: 'Reincidência em um turno',
        senal: 'Concentração de episódios recorrentes em um turno específico.',
        datos: 'Frequência e reincidência por turno.',
        accion: 'Revisão das condições do turno com RH e chefia.',
        resultado: 'Mudança na taxa de reincidência do turno.',
        limitaciones: 'Requer quadro suficiente no turno para ser representativo.',
      },
      {
        titulo: 'Concentração de acidentes',
        senal: 'Aumento de acidentes de trabalho em uma área ou período.',
        datos: 'Episódios classificados como acidente de trabalho ou de trajeto.',
        accion: 'Avaliação de risco e plano de prevenção de acidentes.',
        resultado: 'Variação em acidentes após o plano.',
        limitaciones: 'Os dados dependem da qualidade do registro de origem.',
      },
      {
        titulo: 'Tendência musculoesquelética agregada',
        senal: 'Aumento agregado na categoria clínica musculoesquelética.',
        datos: 'Classificação clínica agregada, somente com base legal e provedor autorizado.',
        accion: 'Programa de ergonomia focalizado.',
        resultado: 'Evolução da tendência agregada após o programa.',
        limitaciones: 'Disponível apenas com fonte clínica autorizada; não identifica pessoas.',
      },
      {
        titulo: 'Tendência de saúde mental agregada',
        senal: 'Aumento agregado na categoria clínica de saúde mental.',
        datos: 'Classificação clínica agregada, somente com base legal e provedor autorizado.',
        accion: 'Campanha de apoio psicológico e educação preventiva.',
        resultado: 'Evolução da tendência agregada após a campanha.',
        limitaciones: 'Requer grupo mínimo para evitar reidentificação.',
      },
      {
        titulo: 'Campanha de vacinação',
        senal: 'Janela sazonal de risco respiratório.',
        datos: 'Histórico de ausências por causas respiratórias, participação em campanhas anteriores.',
        accion: 'Campanha de vacinação com inscrição e agenda.',
        resultado: 'Taxa de participação e variação de ausências respiratórias.',
        limitaciones: 'A participação é voluntária; não mede efetividade clínica individual.',
      },
      {
        titulo: 'Programa de ergonomia',
        senal: 'Episódios recorrentes de dor musculoesquelética agregada.',
        datos: 'Pesquisas de dor musculoesquelética, episódios classificados.',
        accion: 'Programa de ergonomia com avaliação e acompanhamento.',
        resultado: 'Mudança em episódios e na pesquisa de acompanhamento.',
        limitaciones: 'Depende da participação voluntária nas pesquisas.',
      },
      {
        titulo: 'Retorno ao trabalho',
        senal: 'Episódio prolongado próximo do encerramento.',
        datos: 'Duração do episódio, adaptação funcional autorizada.',
        accion: 'Plano de retorno gradual com adaptações e acompanhamento.',
        resultado: 'Sustentabilidade do retorno (sem recaída) em 90 dias.',
        limitaciones: 'A chefia recebe apenas a adaptação funcional, não o diagnóstico.',
      },
      {
        titulo: 'Avaliação de prestadores',
        senal: 'Diferenças nos resultados entre prestadores ou profissionais.',
        datos: 'Resultados agregados de intervenções por prestador.',
        accion: 'Revisão de convênio e priorização de prestadores.',
        resultado: 'Comparação de resultados entre prestadores ao longo do tempo.',
        limitaciones: 'Requer volume suficiente de casos por prestador para comparar.',
      },
      {
        titulo: 'Comparação antes e depois',
        senal: 'Encerramento de uma intervenção ou campanha.',
        datos: 'Linha de base, período de intervenção, período posterior.',
        accion: 'Relatório de avaliação com metodologia declarada.',
        resultado: 'Variação percentual em relação à linha de base.',
        limitaciones: 'Não atribui toda a melhora à intervenção sem um desenho de avaliação.',
      },
    ],
  },

  platformShowcase: {
    titulo: 'Uma visão clara para decisões complexas.',
    texto:
      'Explore tendências, filtre pela estrutura organizacional, administre alertas e transforme cada achado em um plano com responsáveis, prazos e indicadores.',
    cta: 'Explorar a plataforma',
  },

  privacy: {
    titulo: 'Projetada para proteger informação sensível.',
    disclaimer: 'Projetada para apoiar a conformidade com a Lei 21.719 chilena de proteção de dados pessoais.',
    mensajes: [
      'Separação administrativa e clínica',
      'Acessos por perfil',
      'Criptografia',
      'Auditoria',
      'Pseudonimização',
      'Resultados agregados',
      'Políticas de retenção',
      'Gestão de direitos sobre dados',
    ],
  },

  results: {
    titulo: 'Meça o que muda depois de agir.',
    etiquetaDemo: 'Dados de demonstração',
    periodoComparacion: 'período de comparação: 6 meses',
    barras: [
      { label: 'Linha de base', valor: 68, color: '#48556A' },
      { label: 'Intervenção', valor: 52, color: '#00B8F5' },
      { label: 'Atual', valor: 41, color: '#38D978' },
    ],
  },

  impactCalculator: {
    titulo: 'Calculadora de impacto',
    subtitulo: 'Estimativa baseada nas suas premissas, não uma economia garantida.',
    campos: {
      dotacion: 'Quadro de pessoal',
      diasAusencia: 'Dias de ausência (período)',
      costoPromedioDiario: 'Custo médio diário ($)',
      horasExtra: 'Horas extras ($ total)',
      reemplazos: 'Substituições ($ total)',
      costosAdministrativos: 'Custos administrativos ($ total)',
      mejoraHipotetica: 'Melhoria hipotética (%, ex. 15)',
    },
    costoActualLabel: 'Custo atual estimado',
    escenarios: {
      conservador: 'Conservador',
      moderado: 'Moderado',
      alto: 'Alto',
    },
    formula:
      'Fórmula: custo atual = dias de ausência × custo médio diário + horas extras + substituições + custos administrativos. Economia estimada por cenário = custo atual × melhoria hipotética × fator do cenário (conservador ×0.5, moderado ×1.0, alto ×1.5).',
  },

  faq: {
    titulo: 'Perguntas frequentes',
    items: [
      {
        pregunta: 'Substitui o sistema de RH?',
        respuesta:
          'Não. A HealthScope se integra ao seu sistema de RH (Excel, Talana, Buk, Rex+, SAP ou outros) e foca em analítica, alertas e planos de ação, não em administração de pessoal.',
      },
      {
        pregunta: 'Pode integrar com Excel, Talana, Buk, Rex+, SAP ou outros?',
        respuesta: 'Sim, por meio de importação de arquivos e, em fases posteriores, integrações diretas com esses sistemas.',
      },
      {
        pregunta: 'A empresa pode ver diagnósticos?',
        respuesta:
          'A HealthScope funciona sem diagnóstico individual, usando tipos de licença, duração, frequência, recorrência, acidentes, estrutura organizacional e pesquisas agregadas. A informação clínica autorizada permanece separada e agregada.',
      },
      {
        pregunta: 'Como os dados são protegidos?',
        respuesta:
          'Com criptografia, controle de acesso por perfil, pseudonimização, auditoria completa e separação entre informação administrativa e clínica.',
      },
      {
        pregunta: 'Que alertas são gerados?',
        respuesta:
          'Alertas configuráveis por limite, área, turno, reincidência, ausências prolongadas e outros padrões, sempre com revisão humana.',
      },
      {
        pregunta: 'Como as intervenções são medidas?',
        respuesta: 'Comparando uma linha de base com o período posterior à intervenção, com indicadores e metodologia declarada.',
      },
      {
        pregunta: 'Funciona sem informação clínica?',
        respuesta:
          'Sim. O nível administrativo e analítico não requer informação clínica; o nível clínico agregado é opcional e só com base legal e provedor autorizado.',
      },
      {
        pregunta: 'O que acontece se os dados estiverem incompletos?',
        respuesta: 'O painel de qualidade de dados mostra completude, erros e avisos antes de gerar indicadores.',
      },
      {
        pregunta: 'A IA toma decisões automaticamente?',
        respuesta:
          'Não. A IA apoia com resumos, detecção de anomalias e recomendações explicáveis, sempre com revisão humana e opção de desativação.',
      },
      {
        pregunta: 'Configura-se por filial, turno ou centro de custo?',
        respuesta:
          'Sim, os filtros e alertas são configurados por empresa, filial, unidade, centro de custo, turno e outras dimensões organizacionais.',
      },
      {
        pregunta: 'Como iniciar um piloto?',
        respuesta: 'Solicitando uma demonstração: revisamos seus dados atuais e definimos um escopo inicial limitado.',
      },
    ],
  },

  closing: {
    titulo: 'Comece por entender. Continue com uma ação mensurável.',
    texto:
      'Solicite uma demonstração e vamos analisar como transformar seus dados atuais em uma estratégia de prevenção e bem-estar no trabalho.',
    cta: 'Solicitar demonstração',
  },

  footer: {
    tagline: 'Inteligência de absenteísmo e saúde ocupacional para empresas chilenas.',
    productoTitulo: 'Produto',
    producto: [
      { label: 'Como funciona', href: '#como-funciona' },
      { label: 'Plataforma', href: '#plataforma' },
      { label: 'Segurança e privacidade', href: '#privacidad' },
    ],
    legalTitulo: 'Legal',
    legal: ['Termos', 'Política de privacidade', 'Política de cookies'],
    proximamente: '(em breve)',
    copyright: '© 2026 HealthScope. Todos os direitos reservados.',
  },

  demoSheet: {
    titulo: 'Solicitar demonstração',
    descripcion: 'Conte-nos quem você é e entraremos em contato para agendar uma demonstração.',
    exito: 'Obrigado, entraremos em contato em breve.',
    error: 'Não foi possível enviar sua solicitação. Tente novamente.',
    campos: {
      nombre: 'Nome',
      empresa: 'Empresa',
      email: 'E-mail',
      telefono: 'Telefone (opcional)',
      cargo: 'Cargo (opcional)',
    },
    enviar: 'Enviar solicitação',
    enviando: 'Enviando…',
  },
}
