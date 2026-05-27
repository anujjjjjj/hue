-- runs: every completed run, for any game, any mode. The fact table.
-- `mode` is the run's origin: 'daily' | 'free' | 'match'. A 'free' run can
-- later have its match_id set (Challenge-after flow); its mode stays 'free'
-- because that's accurate to its origin. The question "did this run
-- participate in a match" is answered by `match_id IS NOT NULL`.

create table runs (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id),
  player_id uuid not null references players(id),
  mode text not null,                    -- 'daily' | 'free' | 'match'
  seed text not null,
  date_key text,                         -- 'YYYY-MM-DD' (UTC) for Daily; null otherwise
  match_id text references matches(id),  -- non-null for runs participating in a match
  round_scores jsonb not null,           -- [7.8, 9.1, 4.2, 6.4, 8.0]
  total_score numeric not null,          -- 35.5
  game_data jsonb,                       -- flexible per game (Hue: { guesses: HSB[] })
  created_at timestamptz not null default now()
);

create index runs_game_date on runs (game_id, date_key) where date_key is not null;
create index runs_player on runs (player_id, created_at desc);
create index runs_match on runs (match_id) where match_id is not null;

-- RLS: anyone can read or insert; updates only via the narrow trigger below
-- (which enforces "only match_id changed"); deletes forbidden entirely.
alter table runs enable row level security;

create policy "runs_select_all"
  on runs for select
  to anon, authenticated
  using (true);

create policy "runs_insert_all"
  on runs for insert
  to anon, authenticated
  with check (true);

create policy "runs_update_match_id_only"
  on runs for update
  to anon, authenticated
  using (true)
  with check (true);

-- Enforce append-only-ness: the only field an update may change is match_id.
-- (RLS in Postgres can't compare OLD vs NEW directly, so we use a trigger.)
create or replace function runs_only_match_id_update()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.game_id is distinct from old.game_id
     or new.player_id is distinct from old.player_id
     or new.mode is distinct from old.mode
     or new.seed is distinct from old.seed
     or new.date_key is distinct from old.date_key
     or new.round_scores is distinct from old.round_scores
     or new.total_score is distinct from old.total_score
     or new.game_data is distinct from old.game_data
     or new.created_at is distinct from old.created_at then
    raise exception 'runs: only match_id may be updated (v1 trust model)';
  end if;
  return new;
end;
$$;

create trigger runs_only_match_id_update_trg
  before update on runs
  for each row
  execute function runs_only_match_id_update();
