// Personalised skill recommendations built ONLY from stored data and the documented model.
// Every recommendation separates: facts (measured data), model (the app's own score) and,
// optionally, an AI-written explanation added later by ai.js.

import { CAREER_SKILLS, WEF_2025, learningLinks, SKILLS } from './catalog.js';
import { HORIZONS, horizonScore } from './scoring.js';

const CATEGORY_LABELS = { ai: 'AI & Tech', green: 'Зелена енергия', biomed: 'БиоМед', space: 'Космос & Роботи', meta: 'Метавселена' };
const pct = (x, d = 1) => `${(x * 100).toFixed(d).replace('.', ',')}%`;
const signed = (x, d = 1) => `${x > 0 ? '+' : ''}${x.toFixed(d).replace('.', ',')}`;

export function relevanceFor(skill, { knownSkills, favoriteCareerIds, quizCategory, relatedToKnown }) {
  const reasons = [];
  let r = 0;
  const careers = favoriteCareerIds.filter((c) => (CAREER_SKILLS[c] || []).includes(skill.id));
  if (careers.length) { r += 1; reasons.push({ type: 'favorites', careers }); }
  if (quizCategory && skill.categories?.includes(quizCategory)) { r += 0.7; reasons.push({ type: 'quiz', category: quizCategory, label: CATEGORY_LABELS[quizCategory] }); }
  const via = relatedToKnown.get(skill.id);
  if (via?.length) { r += 0.5; reasons.push({ type: 'complements', skills: via }); }
  if (skill.categories?.includes('core')) r += 0.3;
  if (!favoriteCareerIds.length && !quizCategory && !knownSkills.length) r = 0.5; // no profile: rank by market data
  return { relevance: Math.min(1, r), reasons };
}

function factLines(skill, row, sourcesById) {
  const f = row?.inputs || {};
  const facts = [];
  const forecasts = [];
  const jobSources = ['remotive', 'arbeitnow'].filter((id) => sourcesById[id]?.last_status === 'ok' || sourcesById[id]?.last_success_at);
  if (f.demand) {
    facts.push({ text: `Споменава се в ${f.demand.ads_matching} от ${f.demand.ads_total} анализирани обяви (${pct(f.demand.share)}).`,
      source: jobSources.map((id) => sourcesById[id]?.name || id).join(', ') || 'Обяви за работа', period: f.demand.date });
  }
  const ch = f.change90 || f.change30;
  if (ch) {
    facts.push({ text: `Делът на обявите с това умение се е променил с ${signed(ch.relative * 100)}% (${signed(ch.absolute_pp, 2)} п.п.).`,
      source: 'Исторически снимки на обявите', period: `${ch.from} → ${ch.to} (${ch.observations} наблюдения)` });
  }
  if (f.occupations && (f.occupations.essential + f.occupations.optional) > 0) {
    facts.push({ text: `ESCO го свързва с ${f.occupations.essential + f.occupations.optional} професии (основно умение в ${f.occupations.essential}).`,
      source: 'ESCO', period: 'текуща версия на класификацията' });
  }
  if (f.occupation_trend) {
    facts.push({ text: `Заетостта в свързаните професии в ЕС се е променяла средно с ${signed(f.occupation_trend.cagr_pct)}% годишно.`,
      source: 'Eurostat (lfsa_egai2d)', period: f.occupation_trend.period });
  }
  if (f.long_term) {
    forecasts.push({ text: `Прогнозиран среден годишен ръст на заетостта в свързаните професии: ${signed(f.long_term.annual_growth_pct, 2)}%.`,
      source: `Cedefop Skills Forecast ${f.long_term.edition || ''}`.trim(), period: f.long_term.period });
  }
  const wef = WEF_2025.bySkill[skill.id];
  if (wef) forecasts.push({ text: wef, source: WEF_2025.source, period: WEF_2025.period });
  return { facts, forecasts };
}

function limitationsFor(row, horizonKey) {
  const out = [];
  const f = row?.inputs || {};
  if (!f.demand) out.push('Няма достатъчно обяви за измерване на текущото търсене.');
  else if (f.demand.ads_matching < 10) out.push('Малък брой обяви споменават умението — оценката е несигурна.');
  if (!f.change90 && !f.change30) out.push('Все още няма достатъчно история (нужни са поне 30 дни ежедневни данни) за измерване на промяната.');
  if (!f.long_term) out.push('Няма импортирана дългосрочна прогноза (Cedefop) за свързаните професии.');
  if (horizonKey === 'short') out.push('Обявите са от Remotive (дистанционни позиции) и Arbeitnow (основно Германия) — не са представителни за целия пазар, вкл. България.');
  return out;
}

export function buildRecommendations({ skills, scores, sources, profile, limit = 3 }) {
  const knownSkills = (profile.knownSkills || []).filter((id) => typeof id === 'string');
  const favoriteCareerIds = (profile.favoriteCareerIds || []).filter((id) => typeof id === 'string');
  const quizCategory = typeof profile.quizCategory === 'string' ? profile.quizCategory : null;
  const scoreById = new Map(scores.map((s) => [s.skill_id, s]));
  const sourcesById = Object.fromEntries(sources.map((s) => [s.id, s]));
  const catalog = new Map(SKILLS.map((s) => [s.id, s]));

  const relatedToKnown = new Map();
  for (const k of knownSkills) {
    for (const rel of scoreById.get(k)?.inputs?.related || []) {
      if (!relatedToKnown.has(rel.id)) relatedToKnown.set(rel.id, []);
      relatedToKnown.get(rel.id).push(k);
    }
  }

  const candidates = skills.filter((s) => !knownSkills.includes(s.id)).map((s) => ({
    skill: s, row: scoreById.get(s.id), ...relevanceFor(s, { knownSkills, favoriteCareerIds, quizCategory, relatedToKnown }),
  }));

  const horizons = {};
  const used = new Set();
  for (const key of Object.keys(HORIZONS)) {
    const ranked = candidates
      .map((c) => ({ ...c, h: horizonScore(c.row, key) }))
      .filter((c) => c.h !== null && c.relevance > 0)
      .map((c) => ({ ...c, rank: 0.6 * c.h + 40 * c.relevance }))
      .sort((a, b) => b.rank - a.rank);
    const picked = [];
    for (const c of ranked) {
      if (picked.length >= limit) break;
      if (used.has(c.skill.id) && ranked.length > limit * 2) continue; // prefer variety across horizons
      picked.push(c);
    }
    picked.forEach((c) => used.add(c.skill.id));

    horizons[key] = {
      label: HORIZONS[key].label,
      available: picked.length > 0,
      reason: picked.length ? null
        : key === 'long' ? 'Няма импортирани дългосрочни прогнози (Cedefop) — не показваме числова оценка за този хоризонт.'
          : 'Няма достатъчно данни за този хоризонт.',
      items: picked.map((c) => {
        const { facts, forecasts } = factLines(c.skill, c.row, sourcesById);
        const next = (c.row?.inputs?.related || []).map((r) => r.id)
          .filter((id) => id !== c.skill.id && !knownSkills.includes(id)).slice(0, 3)
          .map((id) => ({ id, label_bg: catalog.get(id)?.bg || id }));
        return {
          skill_id: c.skill.id,
          label_bg: c.skill.label_bg,
          label_en: c.skill.label_en,
          esco_uri: c.skill.esco_uri || null,
          model: {
            horizon_score: Math.round(c.h),
            future_skills_score: c.row?.score ?? null,
            confidence: c.row?.confidence ?? 'insufficient',
            coverage: c.row?.coverage ?? 0,
            methodology: c.row?.methodology ?? null,
            computed_date: c.row?.computed_date ?? null,
          },
          relevance: c.reasons,
          facts,
          forecasts,
          next_skills: next,
          learning: learningLinks(catalog.get(c.skill.id) || { id: c.skill.id, en: c.skill.label_en, categories: c.skill.categories || [] }),
          limitations: limitationsFor(c.row, key),
        };
      }),
    };
  }
  return horizons;
}
