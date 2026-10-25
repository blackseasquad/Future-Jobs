// In-memory store with the same interface as createSupabaseStore (tests and dry runs).

/** In-memory implementation with the same behaviour (used by tests and dry runs). */
export function createMemoryStore() {
  const t = {
    data_sources: new Map(), skills: new Map(), occupations: new Map(), skill_occupations: new Map(),
    demand: new Map(), cooc: new Map(), stats: new Map(), forecasts: new Map(), scores: new Map(), runs: [],
  };
  const merge = (map, key, row) => map.set(key, { ...(map.get(key) || {}), ...row });
  let runId = 0;
  return {
    kind: 'memory',
    _tables: t,
    async upsertSources(rows) { rows.forEach((r) => merge(t.data_sources, r.id, r)); },
    async updateSource(id, patch) { if (t.data_sources.has(id)) merge(t.data_sources, id, patch); },
    async getSources() { return [...t.data_sources.values()]; },
    async upsertSkills(rows) { rows.forEach((r) => merge(t.skills, r.id, { esco_alt_labels: [], ...t.skills.get(r.id), ...r })); },
    async getSkills() { return [...t.skills.values()]; },
    async updateSkill(id, patch) { merge(t.skills, id, patch); },
    async upsertOccupations(rows) { rows.forEach((r) => merge(t.occupations, r.uri, r)); },
    async getOccupationsToEnrich(limit) { return [...t.occupations.values()].filter((o) => !o.fetched_at).slice(0, limit); },
    async replaceSkillOccupations(skillId, rows) {
      for (const k of [...t.skill_occupations.keys()]) if (k.startsWith(`${skillId}|`)) t.skill_occupations.delete(k);
      rows.forEach((r) => t.skill_occupations.set(`${r.skill_id}|${r.occupation_uri}`, r));
    },
    async upsertSkillOccupations(rows) { rows.forEach((r) => t.skill_occupations.set(`${r.skill_id}|${r.occupation_uri}`, r)); },
    async getSkillOccupations() {
      return [...t.skill_occupations.values()].map((r) => ({ skill_id: r.skill_id, relation: r.relation, isco2: t.occupations.get(r.occupation_uri)?.isco2 ?? null }));
    },
    async upsertDemandSnapshots(rows) { rows.forEach((r) => t.demand.set(`${r.source_id}|${r.skill_id}|${r.snapshot_date}`, r)); },
    async getDemandHistory(sourceId, since) {
      return [...t.demand.values()].filter((r) => r.source_id === sourceId && r.snapshot_date >= since);
    },
    async replaceCooccurrence(date, rows) {
      for (const k of [...t.cooc.keys()]) if (k.startsWith(`${date}|`)) t.cooc.delete(k);
      rows.forEach((r) => t.cooc.set(`${r.snapshot_date}|${r.skill_id}|${r.other_skill_id}`, r));
    },
    async getCooccurrence(date) { return [...t.cooc.values()].filter((r) => r.snapshot_date === date); },
    async latestCooccurrenceDate() { return [...t.cooc.values()].map((r) => r.snapshot_date).sort().pop() ?? null; },
    async upsertStatSeries(rows) { rows.forEach((r) => t.stats.set(`${r.dataset}|${r.series_key}|${r.geo}|${r.period}`, r)); },
    async getStatSeries(dataset) { return [...t.stats.values()].filter((r) => r.dataset === dataset); },
    async upsertForecasts(rows) { rows.forEach((r) => t.forecasts.set(`${r.source_id}|${r.edition}|${r.geo}|${r.isco2}|${r.start_year}|${r.end_year}`, r)); },
    async getForecasts() { return [...t.forecasts.values()]; },
    async upsertScores(rows) { rows.forEach((r) => t.scores.set(`${r.skill_id}|${r.computed_date}`, r)); },
    async getLatestScores() {
      const last = [...t.scores.values()].map((r) => r.computed_date).sort().pop();
      return [...t.scores.values()].filter((r) => r.computed_date === last);
    },
    async getRuns(limit = 20) { return [...t.runs].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, limit); },
    async startRun(row) { const id = ++runId; t.runs.push({ id, started_at: new Date().toISOString(), source_results: {}, ...row }); return id; },
    async finishRun(id, patch) { Object.assign(t.runs.find((r) => r.id === id), patch); },
  };
}
