-- MathPath: the learning event log and profile.
-- Paste this whole file into Supabase → SQL Editor → New query → Run (once).
--
-- Security model: row-level security (RLS) restricts every row to its owner (auth.uid()).
-- The anon key shipped with the app can only act as a signed-in user on that user's own rows.

-- ---------- events: append-only learning history ----------
create table if not exists public.events (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ts          timestamptz not null,                 -- when it happened (device clock)
  type        text not null check (type in ('attempt', 'interpretation', 'placement', 'baseline')),
  skill_id    text,
  data        jsonb not null,                       -- the full event (src/storage/events.ts)
  inserted_at timestamptz not null default clock_timestamp()  -- server time: the sync watermark
);

create index if not exists events_user_inserted on public.events (user_id, inserted_at, id);
create index if not exists events_user_skill on public.events (user_id, skill_id, ts);

alter table public.events enable row level security;

drop policy if exists "events: read own" on public.events;
create policy "events: read own" on public.events
  for select using (auth.uid() = user_id);

drop policy if exists "events: insert own" on public.events;
create policy "events: insert own" on public.events
  for insert with check (auth.uid() = user_id);
-- No update/delete policies: events are immutable.

-- ---------- profiles: small last-writer-wins state (settings, onboarding) ----------
create table if not exists public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- analysis view: one row per attempt (for weak-spot analysis) ----------
create or replace view public.attempt_log
with (security_invoker = true) as
select
  e.user_id,
  e.ts,
  e.skill_id,
  (e.data ->> 'level')::int          as level,
  (e.data ->> 'correct')::boolean    as correct,
  e.data ->> 'help'                  as help,
  (e.data ->> 'hintsUsed')::int      as hints_used,
  e.data ->> 'misconception'         as misconception,
  e.data -> 'missedSteps'            as missed_steps,
  e.data ->> 'input'                 as input,
  e.data ->> 'problemId'             as problem_id,
  coalesce((e.data ->> 'retentionCheck')::boolean, false) as retention_check
from public.events e
where e.type = 'attempt';
