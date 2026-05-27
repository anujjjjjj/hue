-- matches: a multiplayer match. The `created_by_run_id` distinguishes the
-- two UI entry points: null = "Play together" (creator hasn't played yet);
-- set = "Challenge after I played" (creator's run already exists and gets
-- attached via attachRunToMatch). Downstream screens don't care which.

create table matches (
  id text primary key,                   -- 6-char base32 (see src/lib/db/matches.ts)
  game_id text not null references games(id),
  seed text not null,
  created_by uuid not null references players(id),
  created_by_run_id uuid,                -- null for Play together; set for Challenge after
  status text not null default 'open',   -- 'open' | 'full' | 'expired'
  max_players int not null default 2,
  created_at timestamptz not null default now(),
  expires_at timestamptz                 -- set to now() + 30 days at creation
);

create index matches_status on matches (status, expires_at);

-- RLS: v1 permissive — anyone can read, insert, update. created_by trust
-- is by client discipline, not RLS (documented in BACKEND.md).
alter table matches enable row level security;

create policy "matches_select_all"
  on matches for select
  to anon, authenticated
  using (true);

create policy "matches_insert_all"
  on matches for insert
  to anon, authenticated
  with check (true);

create policy "matches_update_all"
  on matches for update
  to anon, authenticated
  using (true)
  with check (true);
