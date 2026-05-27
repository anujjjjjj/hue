import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';
import { hsbToHex, type HSB } from '../../lib/color';
import { MAX_RUN_SCORE, RUN_LENGTH } from '../../lib/run';
import {
  createMatch,
  getMatch,
  getMatchRuns,
  updateMatchStatus,
  type MatchRow,
  type MatchRunRow,
} from '../../lib/db/matches';
import { fetchPlayerNickname, getPlayerId } from '../../lib/db/player';
import { shareUrlForMatch } from '../../lib/shareLink';
import { track } from '../../lib/analytics';
import { generateRun } from '../../lib/rng';
import { MatchShareButton } from '../share/MatchShareButton';

// MatchResults — the climax screen for multiplayer. Two states sharing one
// data fetch:
//   A. Waiting   — our run is in (or just submitted), opponent's isn't yet
//   B. Complete  — both runs available, full comparison + verdict
//
// We poll getMatchRuns with the §8.3 backoff. When the second run arrives
// we cross-fade (600ms) into the Complete view.

// Polling cadence (spec §8.3).
const POLL_FAST_MS = 3000;          // every 3s …
const POLL_FAST_COUNT = 30;         //   for the first 30 polls (~90s)
const POLL_MID_MS = 6000;           // then every 6s …
const POLL_SWITCH_TO_SLOW_MS = 5 * 60 * 1000; //   until 5min total
const POLL_SLOW_MS = 15000;         // then every 15s

const FADE_MS = 600;

export function MatchResults() {
  const matchId = useGameStore((s) => s.matchId);
  const localRun = useGameStore((s) => s.run);
  const goToIntro = useGameStore((s) => s.goToIntro);

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [runs, setRuns] = useState<MatchRunRow[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [opponentName, setOpponentName] = useState<string>('');

  // Crossfade State A → State B exactly once, when the opponent's run
  // arrives. We hold a delayed "complete view" trigger so the fade reads
  // as a deliberate beat rather than a snap.
  const [showComplete, setShowComplete] = useState(false);
  const everCompleteRef = useRef(false);

  // Once-only analytics fire on first full view.
  const completeViewedRef = useRef(false);

  // Initial match fetch (once).
  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    void getMatch(matchId).then((m) => {
      if (cancelled) return;
      setMatch(m);
    });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Poll runs with backoff. The interval is recomputed each cycle from the
  // elapsed wall-clock and a poll-count, so there's no array of timers to
  // unwind on unmount — just one setTimeout we cancel.
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!matchId) return;
    if (startRef.current === null) startRef.current = Date.now();
    let pollCount = 0;
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      if (cancelled || !matchId) return;
      try {
        const next = await getMatchRuns(matchId);
        if (cancelled) return;
        setRuns(next);
        setOffline(false);
        // Stop polling once both runs are in — the screen becomes static.
        if (next.length >= 2) {
          // First time we see "full": flip the match status (best-effort).
          if (match && match.status === 'open') {
            void updateMatchStatus(matchId, 'full');
          }
          return;
        }
      } catch {
        setOffline(true);
      }
      pollCount += 1;
      const elapsed = Date.now() - (startRef.current ?? Date.now());
      const interval =
        pollCount < POLL_FAST_COUNT
          ? POLL_FAST_MS
          : elapsed < POLL_SWITCH_TO_SLOW_MS
            ? POLL_MID_MS
            : POLL_SLOW_MS;
      timer = window.setTimeout(tick, interval);
    };

    // Kick off immediately so State A has data on first paint, not after 3s.
    void tick();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [matchId, match]);

  // Decide which player is "me" and which is "the opponent". The opponent
  // is "any run that isn't mine", not "any run with a different player_id"
  // — the latter falls apart when two contexts share localStorage (same
  // browser / same-device testing), where both runs carry the same
  // player_id and a strict playerId !== myId filter returns null forever.
  const myId = getPlayerId();
  const myRun = runs?.find((r) => r.playerId === myId) ?? null;
  const oppRun = runs?.find((r) => r !== myRun) ?? null;
  const bothIn = !!myRun && !!oppRun;

  // Pre-load opponent nickname as soon as we have one.
  useEffect(() => {
    if (!oppRun) return;
    let cancelled = false;
    void fetchPlayerNickname(oppRun.playerId).then((n) => {
      if (!cancelled) setOpponentName(n);
    });
    return () => {
      cancelled = true;
    };
  }, [oppRun]);

  // Cross-fade trigger.
  useEffect(() => {
    if (bothIn && !everCompleteRef.current) {
      everCompleteRef.current = true;
      // A short beat so the State A pulsing dot doesn't yank into the grid.
      const t = window.setTimeout(() => setShowComplete(true), 120);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [bothIn]);

  // Fire the once-only "complete viewed" analytics event.
  useEffect(() => {
    if (!showComplete || !myRun || !oppRun || completeViewedRef.current) return;
    completeViewedRef.current = true;
    const diff = myRun.totalScore - oppRun.totalScore;
    const result =
      Math.abs(diff) < 0.05 ? 'tied' : diff > 0 ? 'won' : 'lost';
    track('match_complete_viewed', {
      game_id: 'hue',
      result,
      score_diff: Number(diff.toFixed(2)),
    });
  }, [showComplete, myRun, oppRun]);

  if (!matchId) return null;

  const myScore = myRun ? myRun.totalScore : localRun.totalScore;
  // Until the opponent is identified, the spec asks for "your opponent".
  const oppName = opponentName || 'your opponent';
  const myName = 'You';

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-y-auto px-6 py-10 sm:py-14">
      <div
        className="absolute inset-0 transition-opacity ease-out"
        style={{
          opacity: showComplete ? 0 : 1,
          transitionDuration: `${FADE_MS}ms`,
          pointerEvents: showComplete ? 'none' : 'auto',
        }}
      >
        <WaitingState
          opponentName={oppName}
          myScore={myScore}
          offline={offline}
          matchId={matchId}
          finishedCount={runs?.length ?? (myRun ? 1 : 0)}
          totalPlayers={match?.maxPlayers ?? 2}
          onLeave={goToIntro}
        />
      </div>
      <div
        className="absolute inset-0 transition-opacity ease-out"
        style={{
          opacity: showComplete ? 1 : 0,
          transitionDuration: `${FADE_MS}ms`,
          pointerEvents: showComplete ? 'auto' : 'none',
        }}
      >
        {bothIn && (
          <CompleteState
            matchId={matchId}
            myName={myName}
            oppName={oppName}
            myRun={myRun!}
            oppRun={oppRun!}
          />
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* State A — Waiting                                                       */
/* ----------------------------------------------------------------------- */

function WaitingState({
  opponentName,
  myScore,
  offline,
  matchId,
  finishedCount,
  totalPlayers,
  onLeave,
}: {
  opponentName: string;
  myScore: number;
  offline: boolean;
  matchId: string;
  finishedCount: number;
  totalPlayers: number;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = shareUrlForMatch(matchId);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <MonoLabel className="text-dim" tracking={0.3}>
        Match in progress
      </MonoLabel>
      <h1 className="mt-6 max-w-[18ch] font-serif font-medium leading-[1.0] tracking-[-0.03em] text-[clamp(36px,7vw,68px)]">
        Waiting for <em className="italic text-dim">{opponentName}</em>…
      </h1>

      <div className="mt-8 flex items-baseline gap-2">
        <MonoLabel className="text-dimmer" tracking={0.22}>
          Your score
        </MonoLabel>
        <span className="font-serif text-[28px] italic tracking-[-0.02em] text-dim">
          {myScore.toFixed(1)} / {MAX_RUN_SCORE}
        </span>
      </div>

      <div className="mt-10 flex items-center gap-3">
        <PulsingDot />
        <MonoLabel className="text-dim" tracking={0.28}>
          {finishedCount} of {totalPlayers} finished
        </MonoLabel>
      </div>

      <p className="mt-6 max-w-[44ch] font-sans text-[15px] leading-[1.55] text-dim">
        This page will update when they finish. You can leave and come back
        via the same link.
      </p>

      {offline && (
        <MonoLabel className="mt-4 text-warn" tracking={0.3}>
          · Offline · retrying ·
        </MonoLabel>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button variant="ghost" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy link again'}
        </Button>
        <Button variant="ghost" onClick={onLeave}>
          Play something else
        </Button>
      </div>
    </div>
  );
}

function PulsingDot({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-2.5 w-2.5 ${className}`}
    >
      <span className="absolute inset-0 rounded-full bg-fg opacity-50 [animation:pulseDot_2s_ease-in-out_infinite]" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-fg" />
      <style>{`
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50%      { transform: scale(2.6); opacity: 0; }
        }
      `}</style>
    </span>
  );
}

/* ----------------------------------------------------------------------- */
/* State B — Complete                                                      */
/* ----------------------------------------------------------------------- */

interface RoundPair {
  index: number;
  target: HSB;
  myGuess: HSB | null;
  oppGuess: HSB | null;
  myScore: number;
  oppScore: number;
}

function buildRoundPairs(
  myRun: MatchRunRow,
  oppRun: MatchRunRow,
  matchSeed: string,
): RoundPair[] {
  // Targets are derivable from the match seed — the same generateRun call
  // both players ran. Determinism is the whole point of the seed.
  return generateRun(matchSeed).map((target, i) => ({
    index: i,
    target,
    myGuess: extractGuess(myRun.gameData, i),
    oppGuess: extractGuess(oppRun.gameData, i),
    myScore: Number(myRun.roundScores[i] ?? 0),
    oppScore: Number(oppRun.roundScores[i] ?? 0),
  }));
}

function extractGuess(gameData: unknown, i: number): HSB | null {
  if (!gameData || typeof gameData !== 'object') return null;
  const g = (gameData as { guesses?: unknown }).guesses;
  if (!Array.isArray(g)) return null;
  const item = g[i];
  if (
    !item ||
    typeof item !== 'object' ||
    typeof (item as HSB).h !== 'number'
  )
    return null;
  return item as HSB;
}

function CompleteState({
  matchId,
  myName,
  oppName,
  myRun,
  oppRun,
}: {
  matchId: string;
  myName: string;
  oppName: string;
  myRun: MatchRunRow;
  oppRun: MatchRunRow;
}) {
  const goToIntro = useGameStore((s) => s.goToIntro);
  const goToLobby = useGameStore((s) => s.goToLobby);
  const [creatingRematch, setCreatingRematch] = useState(false);

  const [match, setMatch] = useState<MatchRow | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getMatch(matchId).then((m) => {
      if (!cancelled) setMatch(m);
    });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const pairs = useMemo(() => {
    if (!match) return [];
    return buildRoundPairs(myRun, oppRun, match.seed);
  }, [match, myRun, oppRun]);

  const diff = myRun.totalScore - oppRun.totalScore;
  const isTie = Math.abs(diff) < 0.05;
  const verdict = isTie ? 'TIE' : diff > 0 ? 'YOU WIN' : 'YOU LOST';

  async function handleNewMatch() {
    if (creatingRematch) return;
    track('match_new_match_clicked');
    setCreatingRematch(true);
    // Fresh RNG roll — never reuse the just-played seed; that defeats the
    // memory game. The opponent is NOT auto-invited (spec §8.3): the link
    // must be re-shared from the lobby.
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const seed = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      '',
    );
    const fresh = await createMatch({
      gameId: 'hue',
      seed,
      createdByRunId: null,
    });
    setCreatingRematch(false);
    if (!fresh) return;
    track('match_created', { entry: 'play_together', game_id: 'hue' });
    goToLobby(fresh.id);
  }

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto px-6 py-10 sm:py-14">
      <MonoLabel className="text-dim" tracking={0.3}>
        Match complete
      </MonoLabel>

      <div className="mt-8 grid w-full max-w-[640px] grid-cols-2 gap-x-3 sm:gap-x-6">
        <ColumnHeader name={myName} score={myRun.totalScore} />
        <ColumnHeader name={oppName} score={oppRun.totalScore} />
      </div>

      <div className="mt-2 w-full max-w-[640px]">
        {pairs.length === RUN_LENGTH ? (
          pairs.map((p) => <PairRow key={p.index} pair={p} />)
        ) : (
          // Defensive: should never render with !pairs.length since `match`
          // resolves quickly, but a one-frame fallback beats a layout shift.
          <div className="h-24" />
        )}
      </div>

      <div className="mt-10 text-center">
        <h2 className="font-serif font-medium leading-none tracking-[-0.03em] text-[clamp(42px,8vw,80px)]">
          {verdict}
        </h2>
        <MonoLabel className="mt-3 inline-block text-dim" tracking={0.3}>
          {isTie
            ? `Tied · ${myRun.totalScore.toFixed(1)} · ${oppRun.totalScore.toFixed(1)}`
            : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`}
        </MonoLabel>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={handleNewMatch} disabled={creatingRematch}>
          {creatingRematch ? 'Creating…' : 'New match'}
        </Button>
        <Button variant="ghost" onClick={goToIntro}>
          Play again
        </Button>
        <MatchShareSlot
          myName={myName}
          oppName={oppName}
          myRun={myRun}
          oppRun={oppRun}
          pairs={pairs}
        />
      </div>
    </div>
  );
}

function ColumnHeader({ name, score }: { name: string; score: number }) {
  return (
    <div className="flex flex-col items-center border-b border-line py-3">
      <MonoLabel className="text-dim" tracking={0.22}>
        {name}
      </MonoLabel>
      <span className="mt-1 font-serif text-[36px] leading-none tracking-[-0.02em] text-fg">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function PairRow({ pair }: { pair: RoundPair }) {
  const meWon = pair.myScore > pair.oppScore + 0.0001;
  const oppWon = pair.oppScore > pair.myScore + 0.0001;
  const tied = !meWon && !oppWon;
  return (
    <div className="grid grid-cols-2 gap-x-3 sm:gap-x-6">
      <SideCell
        index={pair.index}
        guess={pair.myGuess}
        target={pair.target}
        score={pair.myScore}
        won={meWon}
        tied={tied}
      />
      <SideCell
        index={pair.index}
        guess={pair.oppGuess}
        target={pair.target}
        score={pair.oppScore}
        won={oppWon}
        tied={tied}
      />
    </div>
  );
}

function SideCell({
  index,
  guess,
  target,
  score,
  won,
  tied,
}: {
  index: number;
  guess: HSB | null;
  target: HSB;
  score: number;
  won: boolean;
  tied: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-line py-3 sm:gap-3">
      <span className="w-5 shrink-0 font-mono text-[10.5px] tabular-nums tracking-[0.18em] text-dimmer">
        {String(index + 1).padStart(2, '0')}
      </span>
      <Swatch hsb={guess} label="guess" />
      <Swatch hsb={target} label="target" />
      <span className="ml-auto font-serif text-[20px] tabular-nums text-fg">
        {score.toFixed(1)}
      </span>
      <span className="w-3 shrink-0 text-center font-mono text-[12px] text-dimmer">
        {won ? (
          <span aria-label="won round" className="text-citron">
            ●
          </span>
        ) : tied ? (
          <span aria-label="tied round">=</span>
        ) : (
          ''
        )}
      </span>
    </div>
  );
}

function Swatch({ hsb, label }: { hsb: HSB | null; label: string }) {
  if (!hsb) {
    return (
      <div
        aria-label={`${label} missing`}
        className="h-9 w-9 rounded-md border border-dashed border-line-2 sm:h-10 sm:w-10"
      />
    );
  }
  return (
    <div
      aria-label={label}
      className="h-9 w-9 rounded-md border border-line-2 sm:h-10 sm:w-10"
      style={{ backgroundColor: hsbToHex(hsb.h, hsb.s, hsb.b) }}
    />
  );
}

/* ----------------------------------------------------------------------- */
/* Share slot — defers the actual modal to the multiplayer share card.     */
/* ----------------------------------------------------------------------- */

function MatchShareSlot(props: {
  myName: string;
  oppName: string;
  myRun: MatchRunRow;
  oppRun: MatchRunRow;
  pairs: RoundPair[];
}) {
  return <MatchShareButton {...props} />;
}
