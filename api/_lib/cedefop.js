// Parser for Cedefop Skills Forecast CSV files (CC BY 4.0).
// Cedefop has no public API: the data is either requested via the dataset form or exported
// with "Export as CSV" in the online tool (https://www.cedefop.europa.eu/en/tools/skills-forecast).
// Column names differ between exports, so columns are detected by name; see docs/DATA_SOURCES.md.

export const ISCO2_LABELS = {
  '01': 'Commissioned armed forces officers', '02': 'Non-commissioned armed forces officers', '03': 'Armed forces occupations, other ranks',
  11: 'Chief executives, senior officials and legislators', 12: 'Administrative and commercial managers',
  13: 'Production and specialised services managers', 14: 'Hospitality, retail and other services managers',
  21: 'Science and engineering professionals', 22: 'Health professionals', 23: 'Teaching professionals',
  24: 'Business and administration professionals', 25: 'Information and communications technology professionals',
  26: 'Legal, social and cultural professionals', 31: 'Science and engineering associate professionals',
  32: 'Health associate professionals', 33: 'Business and administration associate professionals',
  34: 'Legal, social, cultural and related associate professionals', 35: 'Information and communications technicians',
  41: 'General and keyboard clerks', 42: 'Customer services clerks', 43: 'Numerical and material recording clerks',
  44: 'Other clerical support workers', 51: 'Personal service workers', 52: 'Sales workers', 53: 'Personal care workers',
  54: 'Protective services workers', 61: 'Market-oriented skilled agricultural workers',
  62: 'Market-oriented skilled forestry, fishery and hunting workers', 63: 'Subsistence farmers, fishers, hunters and gatherers',
  71: 'Building and related trades workers, excluding electricians', 72: 'Metal, machinery and related trades workers',
  73: 'Handicraft and printing workers', 74: 'Electrical and electronic trades workers',
  75: 'Food processing, wood working, garment and other craft and related trades workers',
  81: 'Stationary plant and machine operators', 82: 'Assemblers', 83: 'Drivers and mobile plant operators',
  91: 'Cleaners and helpers', 92: 'Agricultural, forestry and fishery labourers',
  93: 'Labourers in mining, construction, manufacturing and transport', 94: 'Food preparation assistants',
  95: 'Street and related sales and service workers', 96: 'Refuse workers and other elementary workers',
};

const COUNTRY_TO_GEO = { 'eu-27': 'EU27_2020', eu27: 'EU27_2020', 'eu-27+': 'EU27_2020', eu: 'EU27_2020', bulgaria: 'BG', bg: 'BG' };

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text).replace(/^﻿/, '');
  const delimiter = (s.split('\n')[0].match(/;/g) || []).length > (s.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const labelIndex = new Map(Object.entries(ISCO2_LABELS).map(([code, label]) => [norm(label), String(code).padStart(2, '0')]));

function findCol(headers, patterns) {
  const h = headers.map(norm);
  for (const p of patterns) {
    const i = h.findIndex((x) => p.test(x));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Returns { rows, errors }. Each row: { geo, isco2, occupation_label, start_year, end_year, annual_growth_pct }.
 * defaults: { geo, start_year, end_year } for exports that only carry them in the filter, not in columns.
 */
export function parseCedefopCsv(text, defaults = {}) {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: ['CSV has no data rows'] };
  const headers = table[0];
  const col = {
    geo: findCol(headers, [/^geo$/, /country/, /region/]),
    isco: findCol(headers, [/^isco2$/, /isco/, /^code$/]),
    occ: findCol(headers, [/occupation/]),
    start: findCol(headers, [/^start year$/, /start/, /^from$/]),
    end: findCol(headers, [/^end year$/, /end/, /^to$/]),
    growth: findCol(headers, [/annual growth/, /growth/, /^value$/, /change/]),
  };
  const errors = [];
  if (col.growth < 0) errors.push('No growth column found (expected e.g. "annual_growth_pct" or "Employment growth (%)")');
  if (col.isco < 0 && col.occ < 0) errors.push('No occupation column found');
  if (errors.length) return { rows: [], errors };

  const rows = [];
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    let isco2 = col.isco >= 0 ? String(r[col.isco] || '').replace(/\D/g, '').slice(0, 2) : '';
    const label = col.occ >= 0 ? String(r[col.occ] || '').trim() : ISCO2_LABELS[Number(isco2)] || '';
    if (!isco2 && label) isco2 = labelIndex.get(norm(label.replace(/^\d+\s*[-–.]?\s*/, ''))) || (label.match(/^(\d{2})\b/) || [])[1] || '';
    const rawGeo = col.geo >= 0 ? String(r[col.geo] || '').trim() : defaults.geo || '';
    const geo = COUNTRY_TO_GEO[rawGeo.toLowerCase()] || rawGeo.toUpperCase();
    const start = Number(col.start >= 0 ? r[col.start] : defaults.start_year);
    const end = Number(col.end >= 0 ? r[col.end] : defaults.end_year);
    const growth = Number(String(r[col.growth] ?? '').replace('%', '').replace(',', '.').trim());
    if (!/^\d{2}$/.test(isco2)) return errors.push(`line ${line}: unknown occupation "${label}"`);
    if (!geo) return errors.push(`line ${line}: missing country/geo`);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return errors.push(`line ${line}: invalid period ${start}-${end}`);
    if (!Number.isFinite(growth) || Math.abs(growth) > 25) return errors.push(`line ${line}: invalid annual growth "${r[col.growth]}"`);
    rows.push({ geo, isco2, occupation_label: label || ISCO2_LABELS[Number(isco2)] || null, start_year: start, end_year: end, annual_growth_pct: growth });
  });
  return { rows, errors };
}
