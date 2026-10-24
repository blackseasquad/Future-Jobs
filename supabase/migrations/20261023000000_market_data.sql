-- Future Jobs: live labour-market data (additive migration).
-- Safe to run more than once. Does not touch public.user_favorites or any existing data.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run   (or `supabase db push`).
--
-- Access model:
--   * every table has RLS enabled;
--   * anon/authenticated roles may only SELECT aggregated, non-personal data;
--   * only the service role (used by the Vercel cron function) can write — it bypasses RLS.

-- 1. Data sources and their health -------------------------------------------------------
create table if not exists public.data_sources (
  id               text primary key,
  name             text not null,
  url              text not null,
  license          text,
  kind             text not null,           -- 'job_ads' | 'statistics' | 'taxonomy' | 'forecast' | 'reference'
  update_frequency text,
  enabled          boolean not null default true,
  last_attempt_at  timestamptz,
  last_success_at  timestamptz,
  last_status      text,                    -- 'ok' | 'error' | 'skipped' | 'not_configured'
  last_error       text,
  data_period      text,                    -- e.g. '2025-Q4' or '2026-10-23'
  source_updated_at timestamptz,            -- when the publisher last updated the dataset
  records_last_run integer
);

-- 2. Skills (catalog + ESCO enrichment) ----------------------------------------------------
create table if not exists public.skills (
  id              text primary key,
  label_bg        text not null,
  label_en        text not null,
  categories      text[] not null default '{}',
  search_terms    text[] not null default '{}',
  esco_uri        text,
  esco_label_en   text,
  esco_label_bg   text,
  esco_alt_labels text[] not null default '{}',
  esco_checked_at timestamptz,
  updated_at      timestamptz not null default now()
);

create table if not exists public.occupations (
  uri        text primary key,                 -- ESCO occupation URI
  label_en   text not null,
  label_bg   text,
  isco_code  text,                             -- ESCO code, e.g. '2511.1'
  isco2      text,                             -- ISCO-08 2-digit group, e.g. '25'
  fetched_at timestamptz
);

create table if not exists public.skill_occupations (
  skill_id       text not null references public.skills(id) on delete cascade,
  occupation_uri text not null references public.occupations(uri) on delete cascade,
  relation       text not null check (relation in ('essential', 'optional')),
  primary key (skill_id, occupation_uri)
);

-- 3. Daily job-ad demand per skill (history) ------------------------------------------------
create table if not exists public.skill_demand_snapshots (
  source_id     text not null,                 -- 'remotive' | 'arbeitnow' | 'jobs_combined'
  skill_id      text not null references public.skills(id) on delete cascade,
  snapshot_date date not null,
  ads_total     integer not null check (ads_total >= 0),
  ads_matching  integer not null check (ads_matching >= 0),
  share         numeric not null,              -- ads_matching / ads_total
  created_at    timestamptz not null default now(),
  primary key (source_id, skill_id, snapshot_date)
);
create index if not exists skill_demand_snapshots_date_idx on public.skill_demand_snapshots (snapshot_date);

create table if not exists public.skill_cooccurrence (
  snapshot_date  date not null,
  skill_id       text not null references public.skills(id) on delete cascade,
  other_skill_id text not null references public.skills(id) on delete cascade,
  ads_count      integer not null,
  primary key (snapshot_date, skill_id, other_skill_id)
);

-- 4. Official statistics (Eurostat) ---------------------------------------------------------
create table if not exists public.stat_series (
  dataset    text not null,                    -- e.g. 'jvs_q_nace2'
  series_key text not null,                    -- e.g. 'JVR|B-S' or 'OC25'
  geo        text not null,
  period     text not null,                    -- '2025-Q4' or '2025'
  value      numeric not null,
  unit       text,
  label      text,
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (dataset, series_key, geo, period)
);

-- 5. Long-term occupation forecasts (Cedefop, imported) -------------------------------------
create table if not exists public.occupation_forecasts (
  source_id         text not null default 'cedefop',
  edition           text not null,             -- e.g. '2026'
  geo               text not null,             -- 'EU27_2020', 'BG', ...
  isco2             text not null,
  occupation_label  text,
  start_year        integer not null,
  end_year          integer not null,
  annual_growth_pct numeric not null,
  imported_at       timestamptz not null default now(),
  primary key (source_id, edition, geo, isco2, start_year, end_year)
);

-- 6. Computed skill scores (history) --------------------------------------------------------
create table if not exists public.skill_scores (
  skill_id      text not null references public.skills(id) on delete cascade,
  computed_date date not null,
  score         numeric,                       -- null = not enough data
  coverage      numeric not null,
  confidence    text not null,                 -- 'high' | 'medium' | 'low' | 'insufficient'
  components    jsonb not null,
  inputs        jsonb not null,
  methodology   text not null,
  created_at    timestamptz not null default now(),
  primary key (skill_id, computed_date)
);

-- 7. Refresh runs (audit log + idempotency) ---------------------------------------------------
create table if not exists public.refresh_runs (
  id             bigint generated always as identity primary key,
  run_key        text not null,                -- Europe/Sofia calendar date, e.g. '2026-10-24'
  trigger        text not null,                -- 'cron' | 'manual' | 'test'
  status         text not null,                -- 'running' | 'success' | 'partial' | 'failed'
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  source_results jsonb not null default '{}'::jsonb,
  error          text
);
create index if not exists refresh_runs_started_idx on public.refresh_runs (started_at desc);

-- Row level security: public read of aggregated data, no client writes. -------------------------
do $$
declare t text;
begin
  foreach t in array array['data_sources','skills','occupations','skill_occupations',
                           'skill_demand_snapshots','skill_cooccurrence','stat_series',
                           'occupation_forecasts','skill_scores','refresh_runs']
  loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                   and policyname = 'Public read') then
      execute format('create policy "Public read" on public.%I for select to anon, authenticated using (true)', t);
    end if;
  end loop;
end $$;
