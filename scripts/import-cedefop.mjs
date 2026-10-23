#!/usr/bin/env node
// Imports Cedefop Skills Forecast occupation growth into Supabase (table occupation_forecasts).
//
// Usage:
//   node scripts/import-cedefop.mjs <file.csv> --edition 2026 [--geo EU27_2020] [--start 2023] [--end 2035] [--dry-run]
// Env: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (never commit these).
// Re-running with the same file is safe: rows are upserted on (source, edition, geo, isco2, start, end).

import { readFileSync } from 'node:fs';
import { parseCedefopCsv } from '../api/_lib/cedefop.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = args.includes('--dry-run');
const edition = opt('edition');

if (!file || !edition) {
  console.error('Usage: node scripts/import-cedefop.mjs <file.csv> --edition 2026 [--geo EU27_2020] [--start 2023] [--end 2035] [--dry-run]');
  process.exit(1);
}

const { rows, errors } = parseCedefopCsv(readFileSync(file, 'utf8'), {
  geo: opt('geo'), start_year: opt('start') && Number(opt('start')), end_year: opt('end') && Number(opt('end')),
});
errors.slice(0, 20).forEach((e) => console.warn('skip:', e));
console.log(`Parsed ${rows.length} rows (${errors.length} skipped).`);
if (!rows.length) process.exit(1);
if (dryRun) {
  console.table(rows.slice(0, 15));
  process.exit(0);
}

const { createServiceClient, createSupabaseStore } = await import('../api/_lib/store.js');
const db = createServiceClient();
if (!db) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const store = createSupabaseStore(db);
const { sourceRows } = await import('../api/_lib/pipeline.js');
await store.upsertSources(sourceRows());
await store.upsertForecasts(rows.map((r) => ({ ...r, source_id: 'cedefop', edition: String(edition) })));
const periods = [...new Set(rows.map((r) => `${r.start_year}–${r.end_year}`))].join(', ');
await store.updateSource('cedefop', {
  last_status: 'ok', last_success_at: new Date().toISOString(), last_attempt_at: new Date().toISOString(),
  last_error: null, records_last_run: rows.length, data_period: `${periods} (издание ${edition})`,
});
console.log(`Imported ${rows.length} forecast rows. They are used from the next daily refresh (or run a manual refresh).`);
