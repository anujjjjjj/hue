-- players: anonymous device identities. Client generates a UUID on first load,
-- stores it in localStorage under `hue:playerId`, and upserts here.
-- Schema is account-ready (real auth can attach to this same id later); v1
-- has no login.

create table players (
  id uuid primary key,
  nickname text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- RLS: v1 is intentionally permissive — anyone can read, insert, or update
-- any row. Player ids and nicknames are public by design, and v1 has no
-- anti-cheat model (documented in BACKEND.md).
alter table players enable row level security;

create policy "players_select_all"
  on players for select
  to anon, authenticated
  using (true);

create policy "players_insert_all"
  on players for insert
  to anon, authenticated
  with check (true);

create policy "players_update_all"
  on players for update
  to anon, authenticated
  using (true)
  with check (true);
