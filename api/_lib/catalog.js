// Tracked skills and data-source metadata.
//
// This file is configuration, not statistics: it lists WHICH skills the app follows and
// HOW to recognise them in job ads (search terms). Every number shown in the app comes from
// the sources fetched by the daily job (see api/_lib/pipeline.js). ESCO adds official
// labels, synonyms and the occupations each skill belongs to.
//
// categories match the existing career categories in src/data/careers.ts
// (ai | green | biomed | space | meta) plus 'core' for cross-cutting skills.

export const SKILLS = [
  // --- AI, data and software -------------------------------------------------------------
  { id: 'python', bg: 'Python програмиране', en: 'Python', categories: ['ai'], esco: 'Python (computer programming)',
    terms: ['python'] },
  { id: 'machine-learning', bg: 'Машинно обучение', en: 'Machine learning', categories: ['ai'], esco: 'machine learning',
    terms: ['machine learning', 'deep learning', 'pytorch', 'tensorflow', 'scikit-learn', 'ml engineer', 'computer vision'] },
  { id: 'generative-ai', bg: 'Генеративен AI и LLM', en: 'Generative AI & LLMs', categories: ['ai'], esco: 'artificial intelligence',
    terms: ['generative ai', 'genai', 'llm', 'llms', 'large language model', 'large language models', 'prompt engineering', 'langchain', 'retrieval-augmented', 'ai agents'] },
  { id: 'data-analysis', bg: 'Анализ на данни', en: 'Data analysis', categories: ['ai', 'core'], esco: 'analyse big data',
    terms: ['data analysis', 'data analytics', 'data analyst', 'pandas', 'power bi', 'tableau', 'business intelligence'] },
  { id: 'sql', bg: 'SQL и бази данни', en: 'SQL & databases', categories: ['ai'], esco: 'SQL',
    terms: ['sql', 'postgresql', 'postgres', 'mysql', 'database design'] },
  { id: 'cloud', bg: 'Облачни технологии', en: 'Cloud computing', categories: ['ai'], esco: 'cloud technologies',
    terms: ['aws', 'azure', 'gcp', 'google cloud', 'cloud computing', 'cloud infrastructure', 'cloud native'] },
  { id: 'cybersecurity', bg: 'Киберсигурност', en: 'Cybersecurity', categories: ['ai'], esco: 'cyber security',
    terms: ['cybersecurity', 'cyber security', 'information security', 'infosec', 'penetration testing', 'siem', 'security engineer'] },
  { id: 'devops', bg: 'DevOps и автоматизация', en: 'DevOps', categories: ['ai'], esco: 'DevOps',
    terms: ['devops', 'kubernetes', 'docker', 'ci/cd', 'terraform', 'site reliability'] },
  { id: 'software-engineering', bg: 'Софтуерна разработка', en: 'Software engineering', categories: ['ai', 'meta'], esco: 'computer programming',
    terms: ['software engineering', 'software development', 'typescript', 'javascript', 'java', 'c#', '.net', 'golang'] },
  { id: 'ai-governance', bg: 'Етика и регулации на AI', en: 'AI ethics & governance', categories: ['ai'], esco: 'ethics',
    terms: ['ai ethics', 'responsible ai', 'ai governance', 'ai act', 'algorithmic bias', 'trustworthy ai'] },
  { id: 'data-privacy', bg: 'Защита на данните (GDPR)', en: 'Data protection', categories: ['ai', 'core'], esco: 'data protection',
    terms: ['gdpr', 'data protection', 'data privacy'] },
  { id: 'ux-design', bg: 'UX/UI дизайн', en: 'UX/UI design', categories: ['meta'], esco: 'user experience design',
    terms: ['ux', 'ui/ux', 'user experience', 'figma', 'user research', 'interaction design'] },
  { id: 'xr-3d', bg: '3D, VR и AR', en: '3D, VR & AR', categories: ['meta', 'space'], esco: '3D modelling',
    terms: ['unreal engine', 'unity3d', 'augmented reality', 'virtual reality', 'ar/vr', 'mixed reality', '3d modeling', '3d modelling', 'blender'] },
  { id: 'robotics', bg: 'Роботика и автоматизация', en: 'Robotics', categories: ['space'], esco: 'robotics',
    terms: ['robotics', 'robot', 'plc', 'industrial automation', 'mechatronics'] },
  { id: 'embedded-iot', bg: 'Вградени системи и IoT', en: 'Embedded systems & IoT', categories: ['space', 'ai'], esco: 'embedded systems',
    terms: ['embedded', 'iot', 'internet of things', 'firmware', 'microcontroller'] },

  // --- Green transition -------------------------------------------------------------------
  { id: 'renewable-energy', bg: 'Възобновяема енергия', en: 'Renewable energy', categories: ['green'], esco: 'renewable energy technologies',
    terms: ['renewable energy', 'renewables', 'solar', 'photovoltaic', 'wind energy', 'wind turbine', 'energy storage', 'battery storage'] },
  { id: 'sustainability', bg: 'Устойчивост и ESG', en: 'Sustainability & ESG', categories: ['green', 'core'], esco: 'sustainability',
    terms: ['sustainability', 'esg', 'carbon accounting', 'decarbonization', 'decarbonisation', 'net zero', 'climate'] },
  { id: 'circular-economy', bg: 'Кръгова икономика', en: 'Circular economy', categories: ['green'], esco: 'circular economy',
    terms: ['circular economy', 'recycling', 'life cycle assessment', 'waste management'] },

  // --- Bio & health -----------------------------------------------------------------------
  { id: 'bioinformatics', bg: 'Биоинформатика', en: 'Bioinformatics', categories: ['biomed', 'ai'], esco: 'bioinformatics',
    terms: ['bioinformatics', 'genomics', 'computational biology'] },
  { id: 'biotechnology', bg: 'Биотехнологии', en: 'Biotechnology', categories: ['biomed'], esco: 'biotechnology',
    terms: ['biotechnology', 'biotech', 'cell culture', 'crispr', 'molecular biology', 'laboratory'] },
  { id: 'digital-health', bg: 'Дигитално здравеопазване', en: 'Digital health', categories: ['biomed'], esco: 'e-health',
    terms: ['digital health', 'healthcare', 'medical device', 'clinical', 'e-health'] },

  // --- Engineering ------------------------------------------------------------------------
  { id: 'systems-engineering', bg: 'Системно инженерство', en: 'Systems engineering', categories: ['space'], esco: 'systems engineering',
    terms: ['systems engineering', 'systems engineer', 'requirements engineering'] },
  { id: 'materials-science', bg: 'Материалознание', en: 'Materials science', categories: ['space', 'green', 'biomed'], esco: 'materials science',
    terms: ['materials science', 'composite materials', 'materials engineer'] },

  // --- Cross-cutting (human) skills -------------------------------------------------------
  { id: 'project-management', bg: 'Управление на проекти', en: 'Project management', categories: ['core'], esco: 'perform project management',
    terms: ['project management', 'project manager', 'agile', 'scrum', 'kanban'] },
  { id: 'communication', bg: 'Комуникация', en: 'Communication', categories: ['core'], esco: 'communication',
    terms: ['communication skills', 'stakeholder management', 'presentation skills', 'excellent communication', 'strong communication'] },
  { id: 'leadership', bg: 'Лидерство', en: 'Leadership', categories: ['core'], esco: 'lead others',
    terms: ['leadership', 'team lead', 'people management', 'mentoring', 'coaching'] },
  { id: 'analytical-thinking', bg: 'Аналитично и критично мислене', en: 'Analytical & critical thinking', categories: ['core'], esco: 'think analytically',
    terms: ['analytical thinking', 'analytical skills', 'problem solving', 'problem-solving', 'critical thinking'] },
  { id: 'creativity', bg: 'Креативно мислене', en: 'Creative thinking', categories: ['core', 'meta'], esco: 'think creatively',
    terms: ['creative thinking', 'creativity', 'creative problem'] },
  { id: 'adaptability', bg: 'Адаптивност и учене през целия живот', en: 'Adaptability & lifelong learning', categories: ['core'], esco: 'adapt to change',
    terms: ['adaptability', 'continuous learning', 'eager to learn', 'willingness to learn', 'growth mindset', 'curiosity'] },
  { id: 'customer-focus', bg: 'Обслужване на клиенти', en: 'Customer service', categories: ['core'], esco: 'customer service',
    terms: ['customer service', 'customer support', 'customer success', 'client relationship'] },
  { id: 'digital-marketing', bg: 'Дигитален маркетинг и продажби', en: 'Digital marketing & sales', categories: ['core'], esco: 'digital marketing techniques',
    terms: ['digital marketing', 'seo', 'performance marketing', 'social media marketing', 'b2b sales', 'sales'] },
  { id: 'foreign-languages', bg: 'Чужди езици', en: 'Foreign languages', categories: ['core'], esco: 'English',
    terms: ['fluent english', 'english', 'german', 'french', 'spanish', 'multilingual', 'bilingual'] },
  { id: 'finance', bg: 'Финанси и счетоводство', en: 'Finance & accounting', categories: ['core'], esco: 'financial analysis',
    terms: ['financial analysis', 'accounting', 'controlling', 'fintech', 'financial modelling', 'financial modeling'] },
  { id: 'teaching', bg: 'Обучение и менторство', en: 'Teaching & training', categories: ['core'], esco: 'teach',
    terms: ['teaching', 'trainer', 'e-learning', 'instructional design', 'curriculum'] },
];

// Links the existing careers (src/data/careers.ts) to tracked skills.
export const CAREER_SKILLS = {
  'ai-ethics': ['ai-governance', 'python', 'data-privacy', 'data-analysis', 'analytical-thinking'],
  'prompt-coach': ['generative-ai', 'machine-learning', 'python', 'software-engineering', 'communication'],
  'carbon-engineer': ['sustainability', 'renewable-energy', 'circular-economy', 'materials-science', 'data-analysis'],
  'bioprinting-spec': ['biotechnology', 'materials-science', 'bioinformatics', 'digital-health'],
  'space-architect': ['systems-engineering', 'xr-3d', 'materials-science', 'robotics', 'embedded-iot'],
  'meta-worldbuilder': ['xr-3d', 'ux-design', 'software-engineering', 'creativity'],
};

// World Economic Forum, Future of Jobs Report 2025 (published January 2025, horizon 2025–2030).
// Qualitative, expert-survey evidence. Shown next to the data, NOT used in the numeric score.
export const WEF_2025 = {
  source: 'World Economic Forum — Future of Jobs Report 2025',
  url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/digest/',
  period: '2025–2030 (проучване сред работодатели)',
  bySkill: {
    'machine-learning': 'AI и големи данни — №1 сред най-бързо растящите умения до 2030',
    'generative-ai': 'AI и големи данни — №1 сред най-бързо растящите умения до 2030',
    'data-analysis': 'AI и големи данни — №1 сред най-бързо растящите умения до 2030',
    cybersecurity: 'Мрежи и киберсигурност — №2 сред най-бързо растящите умения до 2030',
    sustainability: 'Грижа за околната среда — за първи път в топ 10 на най-бързо растящите умения',
    creativity: 'Креативното мислене е сред уменията с растящо значение до 2030',
    adaptability: 'Устойчивост, гъвкавост и любопитство/учене през целия живот — с растящо значение до 2030',
    'analytical-thinking': 'Аналитичното мислене е №1 ключово умение за работодателите през 2025',
    leadership: 'Лидерство и социално влияние — сред водещите ключови умения през 2025',
  },
};

// Data sources tracked by the daily job. Verified 2026-10-23 (see docs/DATA_SOURCES.md).
export const SOURCES = [
  { id: 'esco', name: 'ESCO (European Commission)', url: 'https://esco.ec.europa.eu/', license: 'EU reuse policy (Decision 2011/833/EU)',
    kind: 'taxonomy', update_frequency: 'версии 1–2 пъти годишно; проверка на всеки 30 дни за умение' },
  { id: 'eurostat_jvs', name: 'Eurostat — Job vacancy statistics (jvs_q_nace2)', url: 'https://ec.europa.eu/eurostat/databrowser/view/jvs_q_nace2/default/table',
    license: 'Eurostat copyright notice (свободна повторна употреба с посочване)', kind: 'statistics', update_frequency: 'тримесечно' },
  { id: 'eurostat_lfs', name: 'Eurostat — Employment by occupation ISCO-08 (lfsa_egai2d)', url: 'https://ec.europa.eu/eurostat/databrowser/view/lfsa_egai2d/default/table',
    license: 'Eurostat copyright notice (свободна повторна употреба с посочване)', kind: 'statistics', update_frequency: 'годишно' },
  { id: 'remotive', name: 'Remotive — Remote jobs API', url: 'https://remotive.com/', license: 'Remotive API terms (посочване и линк към Remotive; до 4 заявки на ден)',
    kind: 'job_ads', update_frequency: 'ежедневно (обявите са със забавяне 24 ч.)' },
  { id: 'arbeitnow', name: 'Arbeitnow — Job board API', url: 'https://www.arbeitnow.com/', license: 'Публично безплатно API (посочване на източника)',
    kind: 'job_ads', update_frequency: 'ежедневно' },
  { id: 'cedefop', name: 'Cedefop — Skills Forecast 2026', url: 'https://www.cedefop.europa.eu/en/datasets/dataset-skills-forecast', license: 'CC BY 4.0',
    kind: 'forecast', update_frequency: 'на всеки ~2 години (ръчен импорт)' },
  { id: 'wef', name: 'World Economic Forum — Future of Jobs Report 2025', url: WEF_2025.url, license: 'Цитиране на публикуван доклад',
    kind: 'reference', update_frequency: 'на всеки 2 години' },
];

// Learning entry points. These are search pages / free programmes, not measured offers.
export function learningLinks(skill) {
  const q = encodeURIComponent(skill.en);
  const links = [
    { label: 'Coursera', url: `https://www.coursera.org/search?query=${q}` },
    { label: 'edX', url: `https://www.edx.org/search?q=${q}` },
  ];
  if (skill.categories.includes('ai') || skill.id === 'data-privacy') {
    links.unshift({ label: 'Digital Skills & Jobs Platform (EU)', url: 'https://digital-skills-jobs.europa.eu/en/opportunities/training' });
  }
  if (['machine-learning', 'generative-ai', 'ai-governance'].includes(skill.id)) {
    links.unshift({ label: 'Elements of AI (безплатен курс, вкл. на български)', url: 'https://www.elementsofai.com/' });
  }
  return links;
}
