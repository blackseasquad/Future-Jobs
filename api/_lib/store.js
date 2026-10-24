// Persistence layer. The pipeline only talks to this interface, so the same code runs against
// Supabase in production and against an in-memory store in unit tests.

import { createClient } from '@supabase/supabase-js';

export function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
}

/** Server-side client with the service role key (bypasses RLS). Never exposed to the browser. */
export function createServiceClient() {
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Read-only client: service key if present, otherwise the public anon key (RLS: read-only). */
export function createReadClient() {
  const service = createServiceClient();
  if (service) return service;
  const url = supabaseUrl();
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function check({ error, data }, what) {
  if (error) throw new Error(`DB ${what}: ${error.message}`);
  return data;
}

async function selectAll(build, what, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const rows = check(await build().range(from, from + pageSize - 1), what);
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
}

async function upsertChunks(db, table, rows, onConflict, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    check(await db.from(table).upsert(rows.slice(i, i + size), { onConflict }), `upsert ${table}`);
  }
}

export function createSupabaseStore(db) {
  return {
    kind: 'supabase',
    async upsertSources(rows) { await upsertChunks(db, 'data_sources', rows, 'id'); },
    async updateSource(id, patch) { check(await db.from('data_sources').update(patch).eq('id', id), 'update data_sources'); },
    async getSources() { return check(await db.from('data_sources').select('*').order('id'), 'select data_sources'); },

    async upsertSkills(rows) { await upsertChunks(db, 'skills', rows, 'id'); },
    async getSkills() { return selectAll(() => db.from('skills').select('*').order('id'), 'select skills'); },
    async updateSkill(id, patch) { check(await db.from('skills').update(patch).eq('id', id), 'update skills'); },

    async upsertOccupations(rows) { if (rows.length) await upsertChunks(db, 'occupations', rows, 'uri'); },
    async getOccupationsToEnrich(limit) {
      return check(await db.from('occupations').select('uri').is('fetched_at', null).limit(limit), 'select occupations');
    },
    async upsertSkillOccupations(rows) { if (rows.length) await upsertChunks(db, 'skill_occupations', rows, 'skill_id,occupation_uri'); },
    async getSkillOccupations() {
      return selectAll(() => db.from('skill_occupations').select('skill_id, relation, occupations(isco2)').order('skill_id').order('occupation_uri'),
        'select skill_occupations')
        .then((rows) => rows.map((r) => ({ skill_id: r.skill_id, relation: r.relation, isco2: r.occupations?.isco2 ?? null })));
    },

    async upsertDemandSnapshots(rows) { await upsertChunks(db, 'skill_demand_snapshots', rows, 'source_id,skill_id,snapshot_date'); },
    async getDemandHistory(sourceId, sinceDate) {
      return selectAll(() => db.from('skill_demand_snapshots').select('skill_id, snapshot_date, share, ads_total, ads_matching')
        .eq('source_id', sourceId).gte('snapshot_date', sinceDate).order('snapshot_date').order('skill_id'), 'select demand');
    },
    async replaceCooccurrence(date, rows) {
      check(await db.from('skill_cooccurrence').delete().eq('snapshot_date', date), 'delete cooccurrence');
      if (rows.length) await upsertChunks(db, 'skill_cooccurrence', rows, 'snapshot_date,skill_id,other_skill_id');
    },
    async getCooccurrence(date) {
      return selectAll(() => db.from('skill_cooccurrence').select('*').eq('snapshot_date', date).order('skill_id').order('other_skill_id'), 'select cooccurrence');
    },
    async latestCooccurrenceDate() {
      const rows = check(await db.from('skill_cooccurrence').select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1), 'select cooccurrence date');
      return rows[0]?.snapshot_date ?? null;
    },

    async upsertStatSeries(rows) {
      const now = new Date().toISOString();
      await upsertChunks(db, 'stat_series', rows.map((r) => ({ ...r, updated_at: now })), 'dataset,series_key,geo,period');
    },
    async getStatSeries(dataset) {
      return selectAll(() => db.from('stat_series').select('series_key, geo, period, value, unit, label').eq('dataset', dataset)
        .order('series_key').order('geo').order('period'), 'select stat_series');
    },

    async upsertForecasts(rows) { await upsertChunks(db, 'occupation_forecasts', rows, 'source_id,edition,geo,isco2,start_year,end_year'); },
    async getForecasts() { return selectAll(() => db.from('occupation_forecasts').select('*').order('isco2'), 'select forecasts'); },

    async upsertScores(rows) { await upsertChunks(db, 'skill_scores', rows, 'skill_id,computed_date'); },
    async getLatestScores() {
      const d = check(await db.from('skill_scores').select('computed_date').order('computed_date', { ascending: false }).limit(1), 'select score date');
      if (!d.length) return [];
      return check(await db.from('skill_scores').select('*').eq('computed_date', d[0].computed_date), 'select scores');
    },

    async getRuns(limit = 20) {
      return check(await db.from('refresh_runs').select('*').order('started_at', { ascending: false }).limit(limit), 'select runs');
    },
    async startRun(row) {
      const data = check(await db.from('refresh_runs').insert(row).select('id').single(), 'insert run');
      return data.id;
    },
    async finishRun(id, patch) { check(await db.from('refresh_runs').update(patch).eq('id', id), 'update run'); },
  };
}
