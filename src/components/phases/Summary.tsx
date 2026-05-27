import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';
import { hsbToHex, type HSB } from '../../lib/color';
import { MAX_RUN_SCORE, verdictFor } from '../../lib/run';
import { useGameStore, type RunRoundEntry } from '../../store/gameStore';
import {
  formatDailyDate,
  msUntilNextUTCMidnight,
  todayUTC,
} from '../../lib/daily';
import { ShareButton } from '../share/ShareButton';
import { track } from '../../lib/analytics';
import { createMatch } from '../../lib/db/matches';
import { attachRunToMatch } from '../../lib/db/runs';
import { hasBackend } from '../../lib/db/client';
import { getNickname } from '../../lib/db/player';
import { NicknamePrompt } from '../ui/NicknamePrompt';

const TOTAL_COUNT_UP_MS = 1400;
const ROW_STAGGER_MS = 80;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const pad = (n: number) => n.toString().padStart(2, '0');

export function Summary() {
  const run = useGameStore((s) => s.run);
  const mode = useGameStore((s) => s.mode);
  const dailyDate = useGameStore((s) => s.dailyDate);
  const dailyRevisit = useGameStore((s) => s.dailyRevisit);
  const freeRunId = useGameStore((s) => s.freeRunId);
  const playAgain = useGameStore((s) => s.playAgain);
  const startDaily = useGameStore((s) => s.startDaily);
  const goToLobby = useGameStore((s) => s.goToLobby);

  const [challenging, setChallenging] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  // Same JIT-naming gate as Intro's Create match: don't ship Anonymous
  // matches into a friend's inbox.
  const [namingForChallenge, setNamingForChallenge] = useState(false);

  const [shownTotal, setShownTotal] = useState(0);
  const startRef = useRef<number | null>(null);

  // One-shot daily_completed event. Only fires for a Daily that ended this
  // session — not when the user revisits a previously-completed Daily.
  const firedCompleteRef = useRef(false);
  useEffect(() => {
    if (
      mode === 'daily' &&
      dailyDate &&
      !dailyRevisit &&
      !firedCompleteRef.current
    ) {
      firedCompleteRef.current = true;
      track('daily_completed', {
        date: dailyDate,
        score: Number(run.totalScore.toFixed(2)),
      });
    }
  }, [mode, dailyDate, dailyRevisit, run.totalScore]);

  // Total count-up — 1.4s ease-out cubic. Same shape as Results, longer.
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / TOTAL_COUNT_UP_MS);
      setShownTotal(run.totalScore * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run.totalScore]);

  if (run.results.length === 0) return null;

  const isDaily = mode === 'daily' && !!dailyDate;
  const isTodaysDaily = isDaily && dailyDate === todayUTC();
  // Path B: only Free Play runs can spawn a challenge (spec §7).
  // The button is disabled until submitRun resolves with a runId — without
  // it we can't attachRunToMatch.
  const canChallenge =
    mode === 'free' && hasBackend() && !!freeRunId;

  function handleChallengeClick() {
    if (challenging || !canChallenge) return;
    if (!getNickname().trim()) {
      setChallengeError(null);
      setNamingForChallenge(true);
      return;
    }
    void handleChallenge();
  }

  async function handleChallenge() {
    if (challenging || !canChallenge || !freeRunId) return;
    setChallenging(true);
    setChallengeError(null);
    // Spawn a match whose seed is THIS run's seed, so the joiner plays the
    // same five colors. The creator's run is attached retroactively.
    const match = await createMatch({
      gameId: 'hue',
      seed: run.seed,
      createdByRunId: freeRunId,
    });
    if (!match) {
      setChallenging(false);
      setChallengeError(
        "Couldn't create the match. Check your connection and try again.",
      );
      return;
    }
    const attached = await attachRunToMatch(freeRunId, match.id);
    setChallenging(false);
    if (!attached) {
      // Match exists but the run isn't paired with it — degraded but not
      // fatal. The opponent will see no creator run in the comparison.
      // Surface this honestly rather than pretending it worked.
      setChallengeError(
        "Match created, but your run didn't attach. The link still works; tap again to retry.",
      );
      return;
    }
    track('match_created', { entry: 'challenge_after', game_id: 'hue' });
    // The attached Free Play run is now a match participant — the creator's
    // submission is "in" by virtue of attach, so log it under the same event
    // we'd fire for an in-match run submission.
    track('match_run_submitted', { game_id: 'hue', is_creator: true });
    setNamingForChallenge(false);
    goToLobby(match.id);
  }

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-6 py-10 sm:py-14">
      <MonoLabel className="text-dim" tracking={0.3}>
        Run complete
      </MonoLabel>

      <div className="mt-4 flex items-baseline">
        <span className="font-serif font-medium leading-none tracking-[-0.03em] text-[clamp(60px,13vw,132px)]">
          {shownTotal.toFixed(1)}
        </span>
        <span className="ml-1 font-serif text-[clamp(20px,3vw,32px)] italic text-dim">
          /{MAX_RUN_SCORE}
        </span>
      </div>

      {isDaily && dailyDate && (
        <MonoLabel className="mt-3 text-dimmer" tracking={0.22}>
          Today's Daily · {formatDailyDate(dailyDate)}
        </MonoLabel>
      )}

      <div className="mt-10 w-full max-w-[440px]">
        {run.results.map((entry, i) => (
          <Row key={entry.index} entry={entry} stagger={i} />
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {isDaily ? (
          <ShareButton />
        ) : (
          <>
            <Button onClick={playAgain}>Play again</Button>
            <Button
              variant="ghost"
              onClick={handleChallengeClick}
              disabled={!canChallenge || challenging}
            >
              {challenging ? 'Creating…' : 'Challenge a friend'}
            </Button>
            <ShareButton />
          </>
        )}
      </div>

      {namingForChallenge && (
        <div className="mt-6 flex flex-col items-center">
          <NicknamePrompt
            ctaLabel="Send challenge"
            busy={challenging}
            onSubmit={() => void handleChallenge()}
            onCancel={() => setNamingForChallenge(false)}
          />
        </div>
      )}

      {challengeError && (
        <p className="mt-4 max-w-[40ch] text-center font-mono text-[11px] uppercase tracking-[0.22em] text-dim">
          {challengeError}
        </p>
      )}

      {isTodaysDaily && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <NextDailyCountdown />
          <button
            onClick={playAgain}
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-dimmer transition-colors hover:text-dim"
          >
            Or play free
          </button>
        </div>
      )}

      {isDaily && !isTodaysDaily && (
        <div className="mt-6">
          <Button variant="ghost" onClick={() => startDaily()}>
            Play today's Daily
          </Button>
        </div>
      )}

      <style>{`
        @keyframes summaryRowIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Row({ entry, stagger }: { entry: RunRoundEntry; stagger: number }) {
  const verdict = verdictFor(entry.score);
  return (
    <div
      className="flex items-center gap-4 border-b border-line py-4 last:border-b-0"
      style={{
        animation: `summaryRowIn 480ms ${stagger * ROW_STAGGER_MS}ms ease-out both`,
      }}
    >
      <span className="w-6 shrink-0 font-mono text-[12px] tabular-nums tracking-[0.18em] text-dimmer">
        {pad(entry.index + 1)}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Swatch hsb={entry.guess} label="Your guess" />
        <Swatch hsb={entry.target} label="Target" />
      </div>
      <span className="ml-auto font-serif text-[22px] tabular-nums text-fg">
        {entry.score.toFixed(1)}
      </span>
      <span className="w-[56px] shrink-0 text-right font-mono text-[10.5px] uppercase tracking-[0.2em] text-dim">
        {verdict}
      </span>
    </div>
  );
}

function Swatch({ hsb, label }: { hsb: HSB; label: string }) {
  return (
    <div
      aria-label={label}
      className="h-11 w-11 rounded-md border border-line-2 sm:h-12 sm:w-12"
      style={{ backgroundColor: hsbToHex(hsb.h, hsb.s, hsb.b) }}
    />
  );
}

function NextDailyCountdown() {
  const [ms, setMs] = useState(() => msUntilNextUTCMidnight());

  useEffect(() => {
    const id = setInterval(() => setMs(msUntilNextUTCMidnight()), 60_000);
    return () => clearInterval(id);
  }, []);

  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const countdown =
    hours > 0 ? `${hours}h ${pad(minutes)}m` : `${minutes}m`;

  return (
    <MonoLabel className="text-dim" tracking={0.22}>
      Tomorrow's colors at 00:00 UTC · {countdown}
    </MonoLabel>
  );
}
