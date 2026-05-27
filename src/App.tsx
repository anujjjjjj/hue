import { useEffect, useRef, useState } from 'react';
import { Nav } from './components/ui/Nav';
import { Intro } from './components/phases/Intro';
import { Memorize } from './components/phases/Memorize';
import { Recall } from './components/phases/Recall';
import { Results } from './components/phases/Results';
import { Summary } from './components/phases/Summary';
import { Lobby } from './components/phases/Lobby';
import { Incoming } from './components/phases/Incoming';
import { MatchResults } from './components/phases/MatchResults';
import { MatchUnavailable } from './components/phases/MatchUnavailable';
import { useGameStore, type Phase } from './store/gameStore';
import { parseDeepLink, clearDeepLink } from './lib/deepLink';
import { pruneOldDailies } from './lib/dailyStorage';
import { track } from './lib/analytics';
import { ensurePlayer, getPlayerId } from './lib/db/player';
import { getMatch, getMatchRuns, isMatchExpired } from './lib/db/matches';

const CROSSFADE_MS = 560;
// Results → Summary marks the shift from "a round" to "the whole run".
// A beat longer than the standard crossfade, but still understated.
const SUMMARY_CROSSFADE_MS = 720;

/**
 * Resolve a `?m=` deep link to a phase. Five branches per spec §8.2:
 *   1. match not found            → matchUnavailable('not-found')
 *   2. match expired              → matchUnavailable('expired')
 *   3. open, not played by us yet → incoming   (creator: lobby)
 *   4. open, already played by us → matchResults
 *   5. full / both played         → matchResults
 *
 * Best-effort throughout — a backend failure should land somewhere sane
 * rather than blow up the boot effect.
 */
async function resolveMatchLink(matchId: string): Promise<void> {
  const store = useGameStore.getState();
  const match = await getMatch(matchId);
  if (!match) {
    track('match_link_opened', {
      game_id: 'hue',
      was_creator: false,
      result: 'not_found',
    });
    store.goToMatchUnavailable('not-found');
    return;
  }
  if (isMatchExpired(match)) {
    track('match_link_opened', {
      game_id: 'hue',
      was_creator: false,
      result: 'expired',
    });
    store.goToMatchUnavailable('expired');
    return;
  }
  // Have we (this device) already played this match? A run with our
  // player_id and match_id = this match is the signal. The creator's
  // attached Free Play run counts.
  const runs = await getMatchRuns(matchId);
  const myId = getPlayerId();
  const myRun = runs.find((r) => r.playerId === myId);
  const wasCreator = match.createdBy === myId;
  track('match_link_opened', { game_id: 'hue', was_creator: wasCreator });
  if (myRun || runs.length >= match.maxPlayers) {
    store.goToMatchResults(matchId);
    return;
  }
  if (wasCreator) {
    // Creator opens their own link on a second device, or returns before
    // playing. They're not "incoming" — they belong in the lobby.
    store.goToLobby(matchId);
    return;
  }
  store.goToIncoming(matchId);
}

function renderPhase(phase: Phase) {
  switch (phase) {
    case 'intro':
      return <Intro />;
    case 'memorize':
      return <Memorize />;
    case 'recall':
      return <Recall />;
    case 'results':
      return <Results />;
    case 'summary':
      return <Summary />;
    case 'lobby':
      return <Lobby />;
    case 'incoming':
      return <Incoming />;
    case 'matchResults':
      return <MatchResults />;
    case 'matchUnavailable':
      return <MatchUnavailable />;
  }
}

export default function App() {
  const phase = useGameStore((s) => s.phase);

  // One-shot: deep link routing + stale Daily cleanup. Runs on mount only —
  // the deep link is cleared from the URL after handling so back / reload
  // doesn't re-fire it. pruneOldDailies is cheap; runs every load.
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    pruneOldDailies();
    // Best-effort: register/refresh this device's row in `players`. Failure
    // is silent — the game still runs entirely client-side.
    void ensurePlayer();

    if (typeof window === 'undefined') return;
    const link = parseDeepLink(window.location.search);
    if (link.kind === 'daily-today') {
      track('deeplink_opened', { date: link.date });
      // startDaily triggers the daily-watcher effect below, which fires
      // daily_started — don't double-fire here.
      useGameStore.getState().startDaily(link.date);
      clearDeepLink();
    } else if (link.kind === 'daily-past') {
      track('deeplink_opened', { date: link.date });
      useGameStore.getState().showPastDailyMessage(link.date);
      clearDeepLink();
    } else if (link.kind === 'match') {
      // Five-branch join flow (spec §8.2). Resolved async; until it's done
      // the user sees the intro for a beat, which is preferable to flashing
      // an unstyled phase. Clear the ?m= immediately so back/reload doesn't
      // re-fire — the store carries the matchId forward.
      const matchId = link.matchId;
      clearDeepLink();
      void resolveMatchLink(matchId);
    }
  }, []);

  // daily_started for the in-app path (intro → Daily). The deep-link path
  // fires it above and short-circuits to avoid double-firing.
  const lastTrackedDailyRef = useRef<string | null>(null);
  const mode = useGameStore((s) => s.mode);
  const dailyDate = useGameStore((s) => s.dailyDate);
  const dailyRevisit = useGameStore((s) => s.dailyRevisit);
  useEffect(() => {
    if (
      mode === 'daily' &&
      dailyDate &&
      !dailyRevisit &&
      lastTrackedDailyRef.current !== dailyDate &&
      (phase === 'memorize' || phase === 'recall')
    ) {
      lastTrackedDailyRef.current = dailyDate;
      track('daily_started', { date: dailyDate });
    }
    if (mode !== 'daily') lastTrackedDailyRef.current = null;
  }, [mode, dailyDate, dailyRevisit, phase]);

  // Two-layer opacity crossfade between phases. Nothing slides or bounces.
  const [current, setCurrent] = useState<Phase>(phase);
  const [previous, setPrevious] = useState<Phase | null>(null);
  const fadeKey = useRef(0);

  const transitionMs =
    current === 'results' && phase === 'summary'
      ? SUMMARY_CROSSFADE_MS
      : CROSSFADE_MS;

  useEffect(() => {
    if (phase === current) return;
    setPrevious(current);
    setCurrent(phase);
    fadeKey.current += 1;
    const t = setTimeout(() => setPrevious(null), transitionMs);
    return () => clearTimeout(t);
  }, [phase, current, transitionMs]);

  return (
    <div className="flex h-full flex-col">
      <Nav />
      <main className="relative flex-1">
        {previous && (
          <div
            key={`prev-${fadeKey.current}`}
            className="absolute inset-0"
            style={{
              animation: `phaseOut ${transitionMs}ms ease forwards`,
            }}
          >
            {renderPhase(previous)}
          </div>
        )}
        <div
          key={`cur-${fadeKey.current}`}
          className="absolute inset-0"
          style={{
            animation: previous
              ? `phaseIn ${transitionMs}ms ease forwards`
              : undefined,
          }}
        >
          {renderPhase(current)}
        </div>
      </main>

      <style>{`
        @keyframes phaseIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes phaseOut { from { opacity: 1 } to { opacity: 0 } }
      `}</style>
    </div>
  );
}
