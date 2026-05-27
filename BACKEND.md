# BACKEND.md

How Hue's backend is wired and what its limits are. Read before changing the
schema, the RLS policies, or anything in `src/lib/db/`.

## Project

- **Provider:** Supabase (Postgres + Realtime-ready + Auth-ready, none of which
  besides Postgres are used in v1).
- **Project name:** `hue`
- **Project ref:** `wkahbwthqsydkmvnhbre`
- **Region:** `ap-south-1` (Mumbai)
- **URL:** `https://wkahbwthqsydkmvnhbre.supabase.co`
- **Dashboard:** <https://supabase.com/dashboard/project/wkahbwthqsydkmvnhbre>

## Credentials

The app uses the **publishable** (anon) key, only. There is no service-role
key in the client — there is no server.

- Local dev: `.env.local` at repo root (gitignored via the `*.local` rule).
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Deploy env (Vercel/Cloudflare/etc.): the same two vars on the project's
  environment-variables page. Keep them in sync with `.env.local`.

The anon key is safe to ship to the client; it's gated by RLS. If you ever
need to rotate it, do it in the Supabase dashboard under Settings → API and
update both `.env.local` and the deploy environment.

## Schema (studio-shaped)

Four tables in `public`:

- `games` — the studio registry. One row per game. Hue is `'hue'`.
- `players` — anonymous device identities. UUID generated client-side, kept
  in localStorage under `hue:playerId`.
- `matches` — multiplayer matches. Game-agnostic via `game_id`. Short
  human-shareable id (6-char base32).
- `runs` — every completed run, any game, any mode. The fact table for
  leaderboards (Spec 06) and the match comparison screen.

Schema is **game-agnostic**. Adding a new game means inserting one row in
`games` and passing a different `gameId` to `src/lib/db/runs.ts` and
`src/lib/db/matches.ts`. Neither of those files contains the string `hue` —
that's the acid test, don't break it.

Migrations live as numbered `.sql` files in `supabase/migrations/`.

## RLS policies (v1)

RLS is on for all four tables. The v1 policies are deliberately permissive
because there are no real accounts and no real adversary:

- `games`: anyone can `SELECT`. No `INSERT/UPDATE/DELETE` from `anon`.
- `players`: anyone can `SELECT`, `INSERT`, `UPDATE`. Anyone can change anyone
  else's nickname — fine for a friendly game, documented limitation.
- `matches`: anyone can `SELECT`, `INSERT`, `UPDATE`. `created_by` is enforced
  by client discipline, not RLS.
- `runs`: anyone can `INSERT` and `SELECT`. The only permitted `UPDATE` is to
  set `match_id` on an existing run (so "Challenge after I played" can attach
  a finished Free Play run to the new match). No `DELETE`.

## v1 trust model — honest limitations

There is **no anti-cheat**. A motivated person can:

- Submit a `runs` row with whatever score they want.
- Update someone else's `nickname` on the `players` row.
- Create a `matches` row claiming to be created by someone else's
  `player_id`.

This is fine for a friendly-game v1. If/when Spec 06 (leaderboards) ships
and the data shows real abuse, we'll revisit by either tightening RLS,
adding signed score envelopes from an edge function, or introducing real
accounts.

Runs are **append-only** except for the narrow `match_id` update — that's
the only mutation v1 needs and the only one allowed.

## Background-writes contract

The existing Daily and Free Play UX is **the source of truth** for the
player. Backend writes (`submitRun`) are best-effort:

- If the network is down or Supabase errors, the local UX must not block
  or surface an error. Log to console and move on.
- For Daily: the local `localStorage` daily state stays authoritative —
  the row just doesn't make the leaderboard for that player on that day.
- For Free Play: failure means the player can't use "Challenge a friend"
  (because there's no `runId` to attach). That's an acceptable degradation.

## Match IDs

6 characters from a 31-char base32 alphabet that excludes the ambiguous
`0 / O / 1 / I / L`:

```
23456789ABCDEFGHJKMNPQRSTUVWXYZ
```

~900M combinations. Collisions are vanishingly unlikely but the insert
uses retry-on-conflict (capped at 3) just in case.

Normalization: incoming `?m=` params are uppercased before lookup. Mixed
case typed into a share field is fine.

## Expiry

Matches get `expires_at = now() + 30 days` at creation. There is **no**
scheduled cleanup job in v1 — `getMatch` simply treats anything past
`expires_at` (or `status = 'expired'`) as expired. A cleanup function
can come later when scale demands it.

## What is NOT built (and why)

- **No URL-encoded `?vs=` Versus.** The earlier Spec 04 idea is obsolete.
  All multiplayer goes through real `matches` rows.
- **No real accounts.** Schema is account-ready (players is a real table
  with a UUID PK); login screens are not in v1.
- **No live head-to-head.** Realtime channels are unused. Spec 07 adds
  this on top of the same `matches` table.
- **No anti-cheat, no leaderboards UI, no friend lists, no edge functions.**
  All deferred.
