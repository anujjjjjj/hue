-- games: studio registry. One row per game. Adding a new game = one row here
-- (and passing the new id through `gameId` parameters in src/lib/db).

create table games (
  id text primary key,                   -- 'hue', later 'pitch', etc.
  name text not null,                    -- 'Hue'
  rounds_per_run int not null,           -- Hue: 5
  max_round_score numeric not null,      -- Hue: 10
  max_total_score numeric not null,      -- Hue: 50
  created_at timestamptz not null default now()
);

insert into games (id, name, rounds_per_run, max_round_score, max_total_score)
values ('hue', 'Hue', 5, 10, 50);

-- RLS: anyone can read; no writes from anon. (We seed games via migrations.)
alter table games enable row level security;

create policy "games_select_all"
  on games for select
  to anon, authenticated
  using (true);
