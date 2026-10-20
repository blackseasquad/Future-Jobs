-- Run in Supabase: SQL Editor -> New query -> Run

create table if not exists public.user_favorites (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  career_id  text not null,
  created_at timestamptz not null default now(),
  unique (user_id, career_id)
);

create index if not exists user_favorites_user_id_idx
  on public.user_favorites (user_id);

alter table public.user_favorites enable row level security;

create policy "Users can read own favorites"
  on public.user_favorites for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own favorites"
  on public.user_favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on public.user_favorites for delete
  to authenticated
  using (auth.uid() = user_id);
