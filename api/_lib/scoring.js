// Future Skills Score — the app's own composite model (documented in docs/METHODOLOGY.md).
//
// Every component is first measured in its own unit, then converted to a percentile rank
// (0–100) among the tracked skills that HAVE that measurement. Only ranks are combined, so
// percentages, counts and growth rates are never added together directly.
// Missing components are left out and the remaining weights are re-normalised; if less than
// MIN_COVERAGE of the total weight is available, no score is produced.

import { percentileRanks, round, addDays } from './util.js';

export const METHODOLOGY_VERSION = 'fss-1.0';

export const WEIGHTS = {
  demand: 0.25,          // share of current job ads mentioning the skill
  momentum: 0.15,        // change in that share over 90 days (30 days as fallback)
  longTerm: 0.25,        // Cedefop employment forecast for the skill's occupations (to 2035)
  occupationTrend: 0.10, // Eurostat: employment change of those occupations over the last 5 years
  breadth: 0.15,         // ESCO: number of occupations that need the skill
  connectivity: 0.10,    // how many other tracked skills appear in the same job ads
};

export const MIN_COVERAGE = 0.5;
export const MIN_ADS_FOR_DEMAND = 50;        // minimum combined ads in a snapshot
export const MIN_MATCHES_FOR_CONNECTIVITY = 5;
export const MIN_OBSERVATIONS_FOR_CHANGE = { 30: 4, 90: 8 };

/** Relative change of demand share between today and ~N days ago (±25% window tolerance). */
export function demandChange(history, today, days) {
  const points = history.filter((h) => h.ads_total >= MIN_ADS_FOR_DEMAND).sort((a, b) => a.date.localeCompare(b.date));
  const current = points.find((p) => p.date === today);
  if (!current) return null;
  const target = addDays(today, -days);
  const tolerance = Math.max(2, Math.round(days * 0.25));
  const windowStart = addDays(target, -tolerance);
  const windowEnd = addDays(target, tolerance);
  const base = points.filter((p) => p.date >= windowStart && p.date <= windowEnd)
    .sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(target)) - Math.abs(Date.parse(b.date) - Date.parse(target)))[0];
  const observations = points.filter((p) => p.date >= windowStart && p.date <= today).length;
  if (!base || observations < MIN_OBSERVATIONS_FOR_CHANGE[days] || base.share <= 0) return null;
  return {
    relative: round((current.share - base.share) / base.share, 4),
    absolute_pp: round((current.share - base.share) * 100, 3),
    from: base.date, to: today, observations,
  };
}

function weightedMean(pairs) {
  let sw = 0;
  let s = 0;
  for (const { value, weight } of pairs) {
    if (!Number.isFinite(value) || !(weight > 0)) continue;
    s += value * weight;
    sw += weight;
  }
  return sw > 0 ? s / sw : null;
}

/**
 * @param {object} input
 * @param {string} input.today                ISO date of the computation
 * @param {Array}  input.skills               [{id}]
 * @param {Map}    input.demandHistory        skillId -> [{date, share, ads_total, ads_matching}] (jobs_combined)
 * @param {Map}    input.cooccurrence         skillId -> Map(otherId -> count) for today
 * @param {Map}    input.skillOccupations     skillId -> [{isco2, relation}]
 * @param {Map}    input.occupationCounts     skillId -> {essential, optional}
 * @param {Map}    input.forecastGrowth       isco2 -> {annual_growth_pct, start_year, end_year, edition, geo}
 * @param {Map}    input.employmentTrend      isco2 -> {cagr_pct, from, to, geo}
 */
export function computeScores(input) {
  const { today, skills } = input;
  // Demand is anchored on the newest valid job-ad snapshot (normally today; an older date
  // when today's job-ad sources failed, so the last valid data is kept and shown as such).
  const demandDate = input.demandDate || today;
  const raw = new Map();

  for (const skill of skills) {
    const history = input.demandHistory.get(skill.id) || [];
    const latest = history.find((h) => h.date === demandDate && h.ads_total >= MIN_ADS_FOR_DEMAND) || null;
    const ch90 = demandChange(history, demandDate, 90);
    const ch30 = demandChange(history, demandDate, 30);

    const occ = input.skillOccupations.get(skill.id) || [];
    const weightFor = (rel) => (rel === 'essential' ? 1 : 0.5);
    const iscoWeights = new Map();
    for (const o of occ) if (o.isco2) iscoWeights.set(o.isco2, (iscoWeights.get(o.isco2) || 0) + weightFor(o.relation));

    const lt = weightedMean([...iscoWeights].map(([isco2, w]) => ({ value: input.forecastGrowth.get(isco2)?.annual_growth_pct, weight: w })));
    const ot = weightedMean([...iscoWeights].map(([isco2, w]) => ({ value: input.employmentTrend.get(isco2)?.cagr_pct, weight: w })));
    const counts = input.occupationCounts.get(skill.id);
    const breadth = counts ? counts.essential + 0.5 * counts.optional : null;

    let connectivity = null;
    if (latest && latest.ads_matching >= MIN_MATCHES_FOR_CONNECTIVITY) {
      const co = input.cooccurrence.get(skill.id);
      const total = co ? [...co.values()].reduce((a, b) => a + b, 0) : 0;
      connectivity = total / latest.ads_matching;
    }

    const topRelated = [...(input.cooccurrence.get(skill.id) || new Map())]
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({ id, count }));

    const forecastMeta = [...iscoWeights.keys()].map((k) => input.forecastGrowth.get(k)).find(Boolean) || null;
    const trendMeta = [...iscoWeights.keys()].map((k) => input.employmentTrend.get(k)).find(Boolean) || null;

    raw.set(skill.id, {
      demand: latest ? latest.share : null,
      momentum: ch90 ? ch90.relative : ch30 ? ch30.relative : null,
      longTerm: lt,
      occupationTrend: ot,
      breadth: breadth && breadth > 0 ? Math.log1p(breadth) : breadth === 0 ? 0 : null,
      connectivity,
      _facts: {
        demand: latest ? { share: round(latest.share, 5), ads_matching: latest.ads_matching, ads_total: latest.ads_total, date: demandDate } : null,
        change30: ch30,
        change90: ch90,
        long_term: lt === null ? null : { annual_growth_pct: round(lt, 3), period: forecastMeta ? `${forecastMeta.start_year}–${forecastMeta.end_year}` : null,
          edition: forecastMeta?.edition || null, geo: forecastMeta?.geo || null, isco2: [...iscoWeights.keys()] },
        occupation_trend: ot === null ? null : { cagr_pct: round(ot, 3), period: trendMeta ? `${trendMeta.from}–${trendMeta.to}` : null, geo: trendMeta?.geo || null },
        occupations: counts || { essential: 0, optional: 0 },
        connectivity: connectivity === null ? null : round(connectivity, 3),
        related: topRelated,
      },
    });
  }

  const ranks = {};
  for (const comp of Object.keys(WEIGHTS)) {
    ranks[comp] = percentileRanks([...raw].map(([key, v]) => ({ key, value: v[comp] })));
  }

  const results = [];
  for (const skill of skills) {
    const r = raw.get(skill.id);
    const components = {};
    let wSum = 0;
    let acc = 0;
    for (const [comp, w] of Object.entries(WEIGHTS)) {
      const pct = ranks[comp].get(skill.id);
      components[comp] = { raw: r[comp] === null ? null : round(r[comp], 5), percentile: pct ?? null, weight: w };
      if (pct !== undefined) {
        wSum += w;
        acc += w * pct;
      }
    }
    const coverage = round(wSum, 3);
    const score = coverage >= MIN_COVERAGE ? Math.round(acc / wSum) : null;
    const matches = r._facts.demand?.ads_matching ?? 0;
    let confidence = 'insufficient';
    if (score !== null) {
      if (coverage >= 0.85 && matches >= 30) confidence = 'high';
      else if (coverage >= 0.6 && matches >= 10) confidence = 'medium';
      else confidence = 'low';
    }
    results.push({ skill_id: skill.id, computed_date: today, score, coverage, confidence, components, inputs: r._facts, methodology: METHODOLOGY_VERSION });
  }
  return results;
}

/** Score for a recommendation horizon (uses the same percentiles, different emphasis). */
export const HORIZONS = {
  short: { label: '6–12 месеца', weights: { demand: 0.6, momentum: 0.4 }, required: ['demand'] },
  medium: { label: '2–5 години', weights: { breadth: 0.3, connectivity: 0.25, occupationTrend: 0.25, demand: 0.2 }, required: ['breadth'] },
  long: { label: '5–10 години', weights: { longTerm: 0.6, breadth: 0.2, occupationTrend: 0.2 }, required: ['longTerm'] },
};

export function horizonScore(scoreRow, horizonKey) {
  const h = HORIZONS[horizonKey];
  if (!scoreRow) return null;
  for (const req of h.required) if (scoreRow.components?.[req]?.percentile == null) return null;
  let w = 0;
  let acc = 0;
  for (const [comp, weight] of Object.entries(h.weights)) {
    const p = scoreRow.components?.[comp]?.percentile;
    if (p == null) continue;
    w += weight;
    acc += weight * p;
  }
  return w >= 0.5 ? acc / w : null;
}
