// "Кариерна прогноза": turns the test answers into a personal forecast built from stored real data.
//  - occupation groups (ISCO-08) that fit the answers, ranked by fit + real trend/forecast;
//  - future careers from the catalogue as inspiration (editorial);
//  - skills to develop in 3 horizons (same model as "Моят план за умения");
//  - a study plan paced by the time the person has.
// No number in the report is produced by this file — they come from Eurostat, Cedefop and the job ads.

import { CAREER_SKILLS, SKILLS } from './catalog.js';
import { QUESTIONS, QUIZ_VERSION, option } from './quiz-data.js';
import { buildRecommendations } from './recommend.js';
import { percentileRanks } from './util.js';

const CAREERS = [
  { id: 'ai-ethics', title: 'Инженер по Етика на AI', category: 'ai' },
  { id: 'prompt-coach', title: 'Архитект на Подкани & AI Агенти', category: 'ai' },
  { id: 'carbon-engineer', title: 'Инженер по Улавяне на Въглерод', category: 'green' },
  { id: 'bioprinting-spec', title: 'Биопринтиращ Инженер за Органи', category: 'biomed' },
  { id: 'space-architect', title: 'Космически Архитект & Планировчик', category: 'space' },
  { id: 'meta-worldbuilder', title: 'Архитект на Виртуални Светове', category: 'meta' },
];
const CATEGORY_LABELS = { ai: 'AI & Tech', green: 'Зелена енергия', biomed: 'БиоМед', space: 'Космос & Роботи', meta: 'Метавселена', core: 'Универсални умения' };

/** Which skills / categories / ISCO groups the answers point to, and why. */
export function profileFromAnswers(answers) {
  const answerSkills = new Map();
  const addSkill = (id, why) => { if (!answerSkills.has(id)) answerSkills.set(id, []); answerSkills.get(id).push(why); };
  const categories = new Map();
  const isco = new Map();
  for (const oid of answers.interests) {
    const o = option('interests', oid);
    o.categories.forEach((c) => categories.set(c, (categories.get(c) || 0) + 1));
    o.isco.forEach((c, i) => isco.set(c, (isco.get(c) || 0) + (i === 0 ? 1 : 0.6)));
    o.skills.forEach((s) => addSkill(s, o.label));
  }
  for (const qid of ['style', 'ai']) {
    const o = option(qid, answers[qid]);
    (o.skills || []).forEach((s) => addSkill(s, o.label));
  }
  const topCategory = [...categories].filter(([c]) => c !== 'core').sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { answerSkills, categories, isco, topCategory };
}

function trendFor(group, region) {
  const geo = region === 'BG' ? 'BG' : 'EU27_2020';
  return group.eurostat?.[geo]?.cagr_pct ?? group.eurostat?.EU27_2020?.cagr_pct ?? null;
}
function forecastFor(group, region) {
  const pref = region === 'BG' ? 'BG' : 'EU27_2020';
  return group.cedefop.find((f) => f.geo === pref) ?? group.cedefop[0] ?? null;
}

/** Occupation groups that fit the answers, with their real data. */
export function matchGroups(occupationGroups, profile, answers, known) {
  const groups = Object.values(occupationGroups || {});
  const region = answers.region;
  const trendPct = percentileRanks(groups.map((g) => ({ key: g.isco2, value: trendFor(g, region) })));
  const forecastPct = percentileRanks(groups.map((g) => ({ key: g.isco2, value: forecastFor(g, region)?.annual_growth_pct ?? null })));
  const wanted = new Set(profile.answerSkills.keys());
  const scored = groups.map((g) => {
    const interest = profile.isco.get(g.isco2) || 0;
    const skills = g.skills || [];
    const skillFit = skills.filter((s) => wanted.has(s)).length;
    const knownFit = skills.filter((s) => known.includes(s)).length;
    const fit = interest * 2 + skillFit * 0.6 + knownFit * 0.4;
    const t = trendPct.get(g.isco2);
    const f = forecastPct.get(g.isco2);
    const weights = answers.priority === 'growth' ? [0.3, 0.7] : answers.priority === 'stability' ? [0.7, 0.3] : [0.5, 0.5];
    const dataParts = [[t, weights[0]], [f, weights[1]]].filter(([v]) => v !== undefined);
    const dataScore = dataParts.length ? dataParts.reduce((a, [v, w]) => a + v * w, 0) / dataParts.reduce((a, [, w]) => a + w, 0) : null;
    return { g, fit, dataScore, skillsMatched: skills.filter((s) => wanted.has(s) || known.includes(s)) };
  }).filter((x) => x.fit > 0 && x.dataScore !== null);
  const maxFit = Math.max(1, ...scored.map((x) => x.fit));
  return scored
    .map((x) => ({ ...x, rank: 0.6 * (x.fit / maxFit) * 100 + 0.4 * x.dataScore }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3)
    .map(({ g, fit, dataScore, skillsMatched }) => ({
      isco2: g.isco2,
      label_bg: g.label_bg,
      fit: Math.round((fit / maxFit) * 100),
      data_percentile: Math.round(dataScore),
      eurostat: g.eurostat,
      cedefop: g.cedefop,
      skills_matched: skillsMatched,
    }));
}

export function matchCareers(profile, known) {
  const wanted = new Set(profile.answerSkills.keys());
  return CAREERS.map((c) => {
    const skills = CAREER_SKILLS[c.id] || [];
    const score = (profile.categories.get(c.category) || 0) * 2 + skills.filter((s) => wanted.has(s)).length + skills.filter((s) => known.includes(s)).length * 0.5;
    return { ...c, score, skills };
  }).filter((c) => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 2)
    .map(({ id, title, category, skills }) => ({ id, title, category, category_label: CATEGORY_LABELS[category], skills }));
}

export function studyPlan(answers, horizons) {
  const hours = option('time', answers.time)?.hours ?? 5;
  const monthsPerSkill = hours <= 2 ? 6 : hours <= 5 ? 3 : 2;
  const first = horizons.short?.items?.[0]?.label_bg || null;
  const stageTips = {
    school: 'Използвайте свободните избираеми часове, онлайн курсове и олимпиади/състезания, за да опитате областта рано.',
    student: 'Комбинирайте курсовете със стаж или проект в портфолио — работодателите търсят доказан опит.',
    change: 'Започнете с умение, което вече се търси в обявите, и изградете малък проект, преди да смените работата.',
    grow: 'Изберете умение, което допълва сегашната ви роля, и го приложете веднага в текущите задачи.',
  };
  return {
    hours_per_week: hours,
    months_per_skill: monthsPerSkill,
    text: `При около ${hours} ч. седмично реалистичният ритъм е по едно ново умение на всеки ${monthsPerSkill} месеца${first ? ` — започнете с „${first}“` : ''}.`,
    tip: stageTips[answers.stage],
    note: 'Ориентировъчна препоръка на FUTURE-JOBS, не измерени данни.',
  };
}

/**
 * @param {object} p
 * @param {object} p.answers           validated answers (quiz-data.validateAnswers)
 * @param {object} p.snapshot          { occupationGroups, skills: rows from store.getSkills(), scores, sources }
 */
export function buildForecast({ answers, snapshot, now = new Date() }) {
  const known = answers.known || [];
  const profile = profileFromAnswers(answers);
  const horizons = buildRecommendations({
    skills: snapshot.skills, scores: snapshot.scores, sources: snapshot.sources,
    profile: { knownSkills: known, favoriteCareerIds: [], quizCategory: profile.topCategory, answerSkills: profile.answerSkills },
  });
  const groups = matchGroups(snapshot.occupationGroups, profile, answers, known);
  const careers = matchCareers(profile, known);
  const labelOf = new Map(SKILLS.map((s) => [s.id, s.bg]));
  const summary = QUESTIONS.filter((q) => q.type !== 'skills').map((q) => ({
    question: q.title,
    answer: (Array.isArray(answers[q.id]) ? answers[q.id] : [answers[q.id]]).map((oid) => option(q.id, oid)?.label).join(', '),
  }));
  summary.push({ question: 'Умения, които вече имате', answer: known.map((k) => labelOf.get(k) || k).join(', ') || '—' });

  const dataDate = snapshot.scores[0]?.computed_date || null;
  return {
    version: QUIZ_VERSION,
    created_at: now.toISOString(),
    data_date: dataDate,
    region: answers.region,
    top_category: profile.topCategory,
    top_category_label: profile.topCategory ? CATEGORY_LABELS[profile.topCategory] : null,
    summary,
    groups,
    careers,
    horizons,
    plan: studyPlan(answers, horizons),
    limitations: [
      'Прогнозата комбинира вашите отговори с реални статистики и прогнози; тя е ориентир, а не гаранция за работа.',
      'Групите професии са по класификацията ISCO-08 (Eurostat, Cedefop). Бъдещите професии от каталога са редакционни примери.',
      'Търсенето на умения е измерено в обяви от Remotive и Arbeitnow, които не са представителни за целия пазар.',
    ],
  };
}
