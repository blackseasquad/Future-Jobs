// Adapters for the external data sources. Each adapter only fetches + validates + normalizes;
// persistence happens in pipeline.js. All endpoints below were verified on 2026-10-23.

import { decodeJsonStat, fetchJson, normalizeText } from './util.js';

const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
const ESCO = 'https://ec.europa.eu/esco/api';

// ---------------------------------------------------------------------------------------------
// Job ads
// ---------------------------------------------------------------------------------------------

/** Remotive public API: one request returns all active listings (terms: max ~4 calls/day). */
export async function fetchRemotiveJobs({ fetchImpl } = {}) {
  const json = await fetchJson('https://remotive.com/api/remote-jobs', { fetchImpl, timeoutMs: 30000 });
  if (!Array.isArray(json?.jobs)) throw new Error('Remotive: unexpected response (no jobs array)');
  return json.jobs
    .filter((j) => j && j.id && j.title)
    .map((j) => ({
      source: 'remotive',
      id: `remotive:${j.id}`,
      title: String(j.title),
      company: String(j.company_name || ''),
      url: j.url,
      published: j.publication_date || null,
      text: normalizeText(`${j.title} ${(j.tags || []).join(' ')} ${j.category || ''} ${j.description || ''}`),
    }));
}

/** Arbeitnow public API (mostly Germany/EU). Paginated, ~100 ads per page. */
export async function fetchArbeitnowJobs({ fetchImpl, maxPages = 3 } = {}) {
  const jobs = [];
  let url = 'https://www.arbeitnow.com/api/job-board-api';
  for (let page = 0; page < maxPages && url; page++) {
    const json = await fetchJson(url, { fetchImpl, timeoutMs: 30000 });
    if (!Array.isArray(json?.data)) throw new Error('Arbeitnow: unexpected response (no data array)');
    for (const j of json.data) {
      if (!j?.slug || !j.title) continue;
      jobs.push({
        source: 'arbeitnow',
        id: `arbeitnow:${j.slug}`,
        title: String(j.title),
        company: String(j.company_name || ''),
        url: j.url,
        published: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
        text: normalizeText(`${j.title} ${(j.tags || []).join(' ')} ${(j.job_types || []).join(' ')} ${j.description || ''}`),
      });
    }
    url = json.links?.next || null;
  }
  return jobs;
}

// ---------------------------------------------------------------------------------------------
// Eurostat (JSON-stat 2.0, no key)
// ---------------------------------------------------------------------------------------------

export const JVS_SECTORS = {
  'B-S': 'Индустрия, строителство и услуги (общо)',
  J: 'Информация и комуникации (ИКТ)',
  M: 'Професионални, научни и технически дейности',
  Q: 'Здравеопазване и социална работа',
};

/** Job vacancy rate (%), quarterly, EU27 and Bulgaria. */
export async function fetchEurostatJobVacancies({ fetchImpl, geos = ['EU27_2020', 'BG'], since = '2019-Q1' } = {}) {
  const params = new URLSearchParams({ lang: 'EN', indic_em: 'JVR', s_adj: 'NSA', sizeclas: 'TOTAL', sinceTimePeriod: since });
  geos.forEach((g) => params.append('geo', g));
  Object.keys(JVS_SECTORS).forEach((n) => params.append('nace_r2', n));
  const json = await fetchJson(`${EUROSTAT}/jvs_q_nace2?${params}`, { fetchImpl, timeoutMs: 30000 });
  const { rows, updated } = decodeJsonStat(json);
  const out = rows
    .filter((r) => Number.isFinite(r.value) && r.value >= 0 && r.value < 100)
    .map((r) => ({
      dataset: 'jvs_q_nace2', series_key: `JVR|${r.nace_r2}`, geo: r.geo, period: r.time,
      value: r.value, unit: '%', label: JVS_SECTORS[r.nace_r2] || r.nace_r2,
    }));
  if (!out.length) throw new Error('Eurostat JVS: no observations returned');
  return { rows: out, updated };
}

/** Employment by occupation (ISCO-08 2-digit), thousands of persons, annual. */
export async function fetchEurostatEmploymentByOccupation({ fetchImpl, geos = ['EU27_2020', 'BG'], since = '2018' } = {}) {
  const params = new URLSearchParams({ lang: 'EN', sex: 'T', age: 'Y15-74', unit: 'THS_PER', sinceTimePeriod: since });
  geos.forEach((g) => params.append('geo', g));
  const json = await fetchJson(`${EUROSTAT}/lfsa_egai2d?${params}`, { fetchImpl, timeoutMs: 30000 });
  const { rows, labels, updated } = decodeJsonStat(json);
  const out = rows
    .filter((r) => /^OC\d\d$/.test(r.isco08) && Number.isFinite(r.value) && r.value >= 0)
    .map((r) => ({
      dataset: 'lfsa_egai2d', series_key: r.isco08, geo: r.geo, period: r.time,
      value: r.value, unit: 'THS_PER', label: labels.isco08?.[r.isco08] || r.isco08,
    }));
  if (!out.length) throw new Error('Eurostat LFS: no observations returned');
  return { rows: out, updated };
}

// ---------------------------------------------------------------------------------------------
// ESCO (no key)
// ---------------------------------------------------------------------------------------------

export async function escoFindSkill(query, { fetchImpl } = {}) {
  const params = new URLSearchParams({ text: query, type: 'skill', language: 'en', limit: '5', full: 'false' });
  const json = await fetchJson(`${ESCO}/search?${params}`, { fetchImpl });
  const results = json?._embedded?.results || [];
  if (!results.length) return null;
  const exact = results.find((r) => String(r.title).toLowerCase() === query.toLowerCase());
  const best = exact || results[0];
  return { uri: best.uri, title: best.title };
}

export async function escoSkillDetails(uri, { fetchImpl } = {}) {
  const params = new URLSearchParams({ uri, language: 'en' });
  const json = await fetchJson(`${ESCO}/resource/skill?${params}`, { fetchImpl });
  if (!json?.uri) throw new Error('ESCO: invalid skill resource');
  const links = json._links || {};
  const occ = (rel, relation) =>
    (links[rel] || []).filter((l) => l?.uri).map((l) => ({ uri: l.uri, label_en: l.title || l.uri, relation }));
  return {
    uri: json.uri,
    label_en: json.preferredLabel?.en || json.title,
    label_bg: json.preferredLabel?.bg || null,
    alt_en: json.alternativeLabel?.en || [],
    occupations: [...occ('isEssentialForOccupation', 'essential'), ...occ('isOptionalForOccupation', 'optional')],
  };
}

export async function escoOccupationDetails(uri, { fetchImpl } = {}) {
  const params = new URLSearchParams({ uri, language: 'en' });
  const json = await fetchJson(`${ESCO}/resource/occupation?${params}`, { fetchImpl });
  if (!json?.uri) throw new Error('ESCO: invalid occupation resource');
  const iscoLink = (json._links?.broaderIscoGroup || [])[0];
  const code = json.code || iscoLink?.code || null;
  const digits = String(code || iscoLink?.code || '').replace(/\D/g, '');
  return {
    uri: json.uri,
    label_en: json.preferredLabel?.en || json.title,
    label_bg: json.preferredLabel?.bg || null,
    isco_code: code,
    isco2: digits.length >= 2 ? digits.slice(0, 2) : null,
  };
}
