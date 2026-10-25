-- Future Jobs: saved "Кариерна прогноза" reports and e-mail send log (additive, safe to re-run).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Privacy:
--   * a report holds the test answers and the computed result — no name, no e-mail address;
--   * it is opened with a random, unguessable token (link "Отвори прогнозата"), or by the signed-in owner;
--   * e-mail addresses are NOT stored: only a salted SHA-256 hash, to limit how often one address gets mail;
--   * reports expire after 2 years.
-- RLS is enabled with no public policies: only the server (service role) reads and writes these tables,
-- except that signed-in users may read their own reports.

create table if not exists public.quiz_reports (
  token      text primary key,
  user_id    uuid references auth.users(id) on delete set null,
  version    text not null,
  answers    jsonb not null,
  report     jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 years')
);
create index if not exists quiz_reports_user_idx on public.quiz_reports (user_id, created_at desc);

create table if not exists public.email_log (
  id           bigint generated always as identity primary key,
  report_token text not null references public.quiz_reports(token) on delete cascade,
  email_hash   text not null,
  sent_at      timestamptz not null default now(),
  status       text not null
);
create index if not exists email_log_hash_idx on public.email_log (email_hash, sent_at desc);
create index if not exists email_log_sent_idx on public.email_log (sent_at desc);

alter table public.quiz_reports enable row level security;
alter table public.email_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quiz_reports' and policyname = 'Owner reads own reports') then
    create policy "Owner reads own reports" on public.quiz_reports for select to authenticated using (auth.uid() = user_id);
  end if;
end $$;
