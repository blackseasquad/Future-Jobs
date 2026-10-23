// Builds the public, read-only snapshot shown in the UI (no personal data).

import { JVS_SECTORS } from './sources.js';
import { WEF_2025 } from './catalog.js';
import { METHODOLOGY_VERSION, WEIGHTS } from './scoring.js';
import { addDays, sofiaClock } from './util.js';

export const STALE_AFTER_HOURS = 36;

export async function buildSnapshot(store, now = new Date()) {
  const [sources, runs, skills, scores, jvs] = await Promise.all([
    store.getSources(), store.getRuns(15), store.getSkills(), store.getLatestScores(), store.getStatSeries('jvs_q_nace2'),
  ]);
  const today = sofiaClock(now).date;
  const history = await store.getDemandHistory('jobs_combined', addDays(today, -120));

  const lastSuccess = runs.find((r) => r.status === 'success' || r.status === 'partial') || null;
  const lastSuccessAt = lastSuccess?.finished_at || null;
  const ageHours = lastSuccessAt ? (now.getTime() - Date.parse(lastSuccessAt)) / 3600000 : null;

  const historyBySkill = new Map();
  for (const r of history) {
    if (!historyBySkill.has(r.skill_id)) historyBySkill.set(r.skill_id, []);
    historyBySkill.get(r.skill_id).push({ date: r.snapshot_date, share: Number(r.share), ads_total: r.ads_total });
  }
  const scoreById = new Map(scores.map((s) => [s.skill_id, s]));

  const series = new Map();
  for (const r of jvs) {
    const key = `${r.series_key}|${r.geo}`;
    if (!series.has(key)) series.set(key, { key: r.series_key, geo: r.geo, label: JVS_SECTORS[r.series_key.split('|')[1]] || r.label, unit: r.unit, points: [] });
    series.get(key).points.push({ period: r.period, value: Number(r.value) });
  }
  for (const s of series.values()) s.points.sort((a, b) => a.period.localeCompare(b.period));

  return {
    configured: true,
    generatedAt: now.toISOString(),
    methodology: { version: METHODOLOGY_VERSION, weights: WEIGHTS, doc: 'https://github.com/blackseasquad/Future-Jobs/blob/main/docs/METHODOLOGY.md' },
    freshness: {
      lastSuccessfulRunAt: lastSuccessAt,
      lastRunStatus: runs[0]?.status || null,
      stale: ageHours === null ? true : ageHours > STALE_AFTER_HOURS,
      staleAfterHours: STALE_AFTER_HOURS,
    },
    sources: sources.map((s) => ({
      id: s.id, name: s.name, url: s.url, license: s.license, kind: s.kind, update_frequency: s.update_frequency,
      last_status: s.last_status || (s.kind === 'forecast' || s.kind === 'reference' ? 'manual' : null),
      last_success_at: s.last_success_at, last_attempt_at: s.last_attempt_at, last_error: s.last_error,
      data_period: s.data_period, source_updated_at: s.source_updated_at, records_last_run: s.records_last_run,
    })),
    runs: runs.map((r) => ({
      id: r.id, run_key: r.run_key, trigger: r.trigger, status: r.status, started_at: r.started_at, finished_at: r.finished_at,
      sources: Object.fromEntries(Object.entries(r.source_results || {}).map(([k, v]) => [k, v?.status || null])),
    })),
    skills: skills.map((s) => {
      const sc = scoreById.get(s.id) || null;
      return {
        id: s.id, label_bg: s.label_bg, label_en: s.label_en, categories: s.categories,
        esco: s.esco_uri ? { uri: s.esco_uri, label_bg: s.esco_label_bg, label_en: s.esco_label_en, synonyms: (s.esco_alt_labels || []).slice(0, 6) } : null,
        score: sc ? { value: sc.score, confidence: sc.confidence, coverage: Number(sc.coverage), components: sc.components, inputs: sc.inputs, computed_date: sc.computed_date } : null,
        wef: WEF_2025.bySkill[s.id] || null,
        history: (historyBySkill.get(s.id) || []).sort((a, b) => a.date.localeCompare(b.date)),
      };
    }),
    vacancies: { dataset: 'jvs_q_nace2', source: 'Eurostat', series: [...series.values()] },
    wef: { source: WEF_2025.source, url: WEF_2025.url, period: WEF_2025.period },
  };
}
