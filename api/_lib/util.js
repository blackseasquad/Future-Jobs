// Small, dependency-free helpers shared by the data pipeline (unit-tested in tests/).

export const TIMEZONE = 'Europe/Sofia';

/** Calendar date and hour in Europe/Sofia for a given instant (handles DST). */
export function sofiaClock(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour) % 24;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour };
}

/**
 * Vercel cron expressions are UTC. Two daily entries (03:00 and 04:00 UTC) cover 06:00 in Sofia
 * in both summer (UTC+3) and winter (UTC+2). An invocation before 06:00 Sofia time is skipped; the
 * first one at/after 06:00 runs, and the pipeline's once-per-day guard makes any later one a no-op
 * (or a catch-up if the 06:00 delivery was missed or failed).
 */
export function isDueInSofia(date = new Date(), targetHour = 6) {
  return sofiaClock(date).hour >= targetHour;
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Strip HTML tags/entities and collapse whitespace; lower-case for matching. */
export function normalizeText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a matcher for a set of terms. Terms match as whole words/phrases
 * (so "java" does not match "javascript", "ux" does not match "luxury").
 */
export function buildMatcher(terms) {
  const clean = [...new Set(terms.map((t) => t.toLowerCase().trim()).filter(Boolean))];
  if (!clean.length) return () => false;
  const pattern = clean.map(escapeRegex).join('|');
  const re = new RegExp(`(^|[^\\p{L}\\p{N}+#])(?:${pattern})(?=$|[^\\p{L}\\p{N}+#])`, 'u');
  return (text) => re.test(text);
}

/** Cleans an ESCO label into a usable job-ad term: drops "(computer programming)" etc. */
export function escoLabelToTerm(label) {
  const t = String(label || '').replace(/\(.*?\)/g, '').trim().toLowerCase();
  return t.length >= 4 && t.split(' ').length <= 4 ? t : null;
}

/** Stable key used to de-duplicate the same job posted on several boards. */
export function jobDedupKey(job) {
  const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return `${norm(job.company)}|${norm(job.title)}`;
}

/**
 * Decodes a Eurostat JSON-stat 2.0 response into flat rows
 * [{ <dim>: code, ..., value }]. Missing cells are skipped.
 */
export function decodeJsonStat(json) {
  if (!json || !Array.isArray(json.id) || !Array.isArray(json.size) || !json.dimension) {
    throw new Error('Invalid JSON-stat payload');
  }
  const ids = json.id;
  const sizes = json.size;
  const codesByDim = ids.map((d) => {
    const index = json.dimension[d]?.category?.index || {};
    const arr = [];
    for (const [code, pos] of Object.entries(index)) arr[pos] = code;
    return arr;
  });
  const labelsByDim = Object.fromEntries(ids.map((d) => [d, json.dimension[d]?.category?.label || {}]));
  const rows = [];
  for (const [flatStr, value] of Object.entries(json.value || {})) {
    if (value === null || value === undefined) continue;
    let flat = Number(flatStr);
    const row = {};
    for (let i = ids.length - 1; i >= 0; i--) {
      const pos = flat % sizes[i];
      flat = Math.floor(flat / sizes[i]);
      row[ids[i]] = codesByDim[i][pos];
    }
    row.value = Number(value);
    rows.push(row);
  }
  return { rows, labels: labelsByDim, updated: json.updated || null };
}

/** Percentile rank (0–100) of each value within the list; ties share the average rank. */
export function percentileRanks(entries) {
  const valid = entries.filter((e) => Number.isFinite(e.value));
  const n = valid.length;
  const out = new Map();
  if (n === 0) return out;
  if (n === 1) {
    out.set(valid[0].key, 50);
    return out;
  }
  const sorted = [...valid].sort((a, b) => a.value - b.value);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1].value === sorted[i].value) j++;
    const avgRank = (i + j) / 2;
    for (let k = i; k <= j; k++) out.set(sorted[k].key, Math.round((avgRank / (n - 1)) * 1000) / 10);
    i = j + 1;
  }
  return out;
}

export async function fetchJson(url, { timeoutMs = 20000, fetchImpl = fetch, headers = {} } = {}) {
  const res = await fetchImpl(url, {
    headers: { accept: 'application/json', 'user-agent': 'FutureJobs/1.0 (+https://github.com/blackseasquad/Future-Jobs)', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).host}${new URL(url).pathname}`);
  return res.json();
}

export function round(n, digits = 4) {
  if (!Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
