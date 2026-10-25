// Questions of the "Кариерна прогноза" test. Shared by the browser (src/components/ForecastQuiz.tsx)
// and the server (api/_lib/forecast.js), which computes the result from stored real data.
//
// Each option links answers to the app's tracked skills (api/_lib/catalog.js), to the catalogue
// categories (ai | green | biomed | space | meta | core) and to ISCO-08 2-digit occupation groups.
// These links are editorial; the numbers in the result come only from the data sources.

export const QUIZ_VERSION = 'forecast-1';

export const QUESTIONS = [
  {
    id: 'interests',
    type: 'multi',
    max: 3,
    title: 'Кои области ви привличат най-много?',
    hint: 'Изберете до 3.',
    options: [
      { id: 'tech', label: 'Технологии, AI и данни', icon: 'fa-microchip', categories: ['ai'], isco: ['25', '35'], skills: ['python', 'data-analysis', 'generative-ai'] },
      { id: 'green', label: 'Енергия, климат и природа', icon: 'fa-leaf', categories: ['green'], isco: ['21', '31', '74'], skills: ['renewable-energy', 'sustainability'] },
      { id: 'health', label: 'Здраве, медицина и биология', icon: 'fa-heart-pulse', categories: ['biomed'], isco: ['22', '32', '21'], skills: ['biotechnology', 'digital-health'] },
      { id: 'engineering', label: 'Инженерство, роботи и космос', icon: 'fa-gears', categories: ['space'], isco: ['21', '31', '72'], skills: ['robotics', 'systems-engineering', 'embedded-iot'] },
      { id: 'design', label: 'Дизайн, изкуство и виртуални светове', icon: 'fa-palette', categories: ['meta'], isco: ['21', '26'], skills: ['ux-design', 'xr-3d', 'creativity'] },
      { id: 'business', label: 'Бизнес, финанси и предприемачество', icon: 'fa-briefcase', categories: ['core'], isco: ['24', '12', '33'], skills: ['finance', 'project-management', 'digital-marketing'] },
      { id: 'people', label: 'Хора, обучение и социална сфера', icon: 'fa-people-group', categories: ['core'], isco: ['23', '26', '34'], skills: ['teaching', 'communication'] },
      { id: 'crafts', label: 'Производство, техника и занаяти', icon: 'fa-screwdriver-wrench', categories: ['space', 'green'], isco: ['72', '74', '71'], skills: ['robotics', 'embedded-iot'] },
    ],
  },
  {
    id: 'style',
    type: 'single',
    title: 'Какво ви носи най-голямо удовлетворение в работата?',
    options: [
      { id: 'analyse', label: 'Да анализирам и да намирам логиката в сложни проблеми', skills: ['analytical-thinking', 'data-analysis'] },
      { id: 'create', label: 'Да създавам нови неща — продукти, дизайн, идеи', skills: ['creativity', 'ux-design'] },
      { id: 'help', label: 'Да помагам, обучавам и работя с хора', skills: ['communication', 'customer-focus', 'teaching'] },
      { id: 'lead', label: 'Да организирам, водя екип и постигам цели', skills: ['project-management', 'leadership'] },
      { id: 'build', label: 'Да строя и поправям реални системи и машини', skills: ['systems-engineering', 'robotics'] },
    ],
  },
  {
    id: 'known',
    type: 'skills',
    title: 'Кои от тези умения вече притежавате?',
    hint: 'Отбележете всички, които владеете поне на базово ниво. Може и нито едно.',
  },
  {
    id: 'stage',
    type: 'single',
    title: 'Къде се намирате в момента?',
    options: [
      { id: 'school', label: 'Ученик съм' },
      { id: 'student', label: 'Студент съм' },
      { id: 'change', label: 'Работя и искам да сменя посоката' },
      { id: 'grow', label: 'Работя и искам да се развивам в своята сфера' },
    ],
  },
  {
    id: 'time',
    type: 'single',
    title: 'Колко време седмично можете да отделите за учене?',
    options: [
      { id: 'low', label: 'До 3 часа', hours: 2 },
      { id: 'mid', label: '3–7 часа', hours: 5 },
      { id: 'high', label: 'Над 7 часа', hours: 9 },
    ],
  },
  {
    id: 'priority',
    type: 'single',
    title: 'Кое е най-важно за вас при избора на професия?',
    options: [
      { id: 'demand', label: 'Да намеря работа бързо — търсенето днес' },
      { id: 'growth', label: 'Дългосрочен растеж до 2035' },
      { id: 'stability', label: 'Стабилност и сигурност' },
      { id: 'meaning', label: 'Смисъл и полза за хората и планетата' },
    ],
  },
  {
    id: 'region',
    type: 'single',
    title: 'Къде искате да работите?',
    options: [
      { id: 'BG', label: 'В България' },
      { id: 'EU', label: 'Навсякъде в Европа' },
      { id: 'remote', label: 'Дистанционно, за международни компании' },
    ],
  },
  {
    id: 'ai',
    type: 'single',
    title: 'Как виждате изкуствения интелект в бъдещата си работа?',
    options: [
      { id: 'build', label: 'Искам да създавам AI системи', skills: ['machine-learning', 'generative-ai', 'python'] },
      { id: 'use', label: 'Искам да го използвам като инструмент', skills: ['generative-ai', 'data-analysis'] },
      { id: 'govern', label: 'Искам да следя AI да е безопасен и справедлив', skills: ['ai-governance', 'data-privacy'] },
      { id: 'human', label: 'Предпочитам работа, в която човекът е в центъра', skills: ['communication', 'adaptability'] },
    ],
  },
];

/** Validates answers from the browser; returns { answers } or { error }. */
export function validateAnswers(raw, knownSkillIds) {
  if (!raw || typeof raw !== 'object') return { error: 'Липсват отговори.' };
  const out = {};
  for (const q of QUESTIONS) {
    const v = raw[q.id];
    if (q.type === 'single') {
      if (!q.options.some((o) => o.id === v)) return { error: `Невалиден отговор на въпроса „${q.title}“.` };
      out[q.id] = v;
    } else if (q.type === 'multi') {
      const arr = Array.isArray(v) ? [...new Set(v)].filter((x) => q.options.some((o) => o.id === x)) : [];
      if (!arr.length || arr.length > q.max) return { error: `Изберете от 1 до ${q.max} отговора на „${q.title}“.` };
      out[q.id] = arr;
    } else if (q.type === 'skills') {
      out[q.id] = Array.isArray(v) ? [...new Set(v)].filter((x) => knownSkillIds.has(x)).slice(0, 40) : [];
    }
  }
  return { answers: out };
}

export const option = (qid, oid) => QUESTIONS.find((q) => q.id === qid)?.options?.find((o) => o.id === oid) || null;
