import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';
import { formatDailyDate, todayUTC } from '../../lib/daily';
import { loadDaily, type DailyStored } from '../../lib/dailyStorage';
import { MAX_RUN_SCORE } from '../../lib/run';
import { track } from '../../lib/analytics';
import { createMatch } from '../../lib/db/matches';
import { hasBackend } from '../../lib/db/client';
import { getNickname } from '../../lib/db/player';
import { NicknamePrompt } from '../ui/NicknamePrompt';

export function Intro() {
  const startDaily = useGameStore((s) => s.startDaily);
  const startFreePlay = useGameStore((s) => s.startFreePlay);
  const goToLobby = useGameStore((s) => s.goToLobby);
  const pastDailyDate = useGameStore((s) => s.pastDailyDate);
  const clearPastDailyMessage = useGameStore((s) => s.clearPastDailyMessage);

  const today = useMemo(() => todayUTC(), []);
  const [daily, setDaily] = useState<DailyStored | null>(() => loadDaily(today));
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  // When the user clicks "Create match" without a saved nickname we flip
  // to a focused naming step rather than crashing through with "Anonymous".
  const [namingForMatch, setNamingForMatch] = useState(false);

  // Re-check storage whenever this screen mounts — e.g. someone hit "Play
  // free" after a completed Daily and bounces back here later.
  useEffect(() => {
    setDaily(loadDaily(today));
  }, [today]);

  // "Play together" entry point. Generates a fresh seed (same shape as
  // Free Play; never the Daily seed — see spec §7), creates the match row,
  // routes to the Lobby. Debounced via creatingMatch so a double-tap can't
  // produce two matches.
  // Triggered by the Multiplayer card. We require a nickname before
  // creating — otherwise the opponent's Incoming screen just says
  // "Anonymous is challenging you", which defeats the point.
  function handleMultiplayerClick() {
    if (creatingMatch) return;
    if (!getNickname().trim()) {
      setMatchError(null);
      setNamingForMatch(true);
      return;
    }
    void createMatchAndGo();
  }

  async function createMatchAndGo() {
    if (creatingMatch) return;
    setCreatingMatch(true);
    setMatchError(null);
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const seed = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      '',
    );
    const match = await createMatch({
      gameId: 'hue',
      seed,
      createdByRunId: null,
    });
    setCreatingMatch(false);
    if (!match) {
      setMatchError(
        "Couldn't create the match. Check your connection and try again.",
      );
      return;
    }
    setNamingForMatch(false);
    track('match_created', { entry: 'play_together', game_id: 'hue' });
    goToLobby(match.id);
  }

  if (pastDailyDate) {
    return (
      <PastDailyClosed
        date={pastDailyDate}
        onPlayToday={() => {
          clearPastDailyMessage();
          startDaily(today);
        }}
        onPlayFree={() => {
          clearPastDailyMessage();
          startFreePlay();
        }}
      />
    );
  }

  const completed = !!daily?.completed;

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <MonoLabel className="text-dim">A game of color memory</MonoLabel>
      <h1 className="mt-6 max-w-[12ch] font-serif font-medium leading-[0.95] tracking-[-0.04em] text-[clamp(44px,9vw,104px)]">
        Watch it <em className="italic">shrink</em>.
      </h1>
      <p className="mt-6 max-w-[40ch] font-sans text-[16px] leading-[1.55] text-dim">
        A color appears, then collapses. Recreate it from memory. You'll be
        scored on how close you came — perceptually, not numerically.
      </p>

      <div className="mt-12 flex w-full max-w-[440px] flex-col gap-3">
        <ModeCard
          title="Today's Daily"
          subtitle={`${formatDailyDate(today)} · ONE RUN PER DAY`}
          state={
            completed && daily
              ? `COMPLETED · ${daily.totalScore.toFixed(1)}/${MAX_RUN_SCORE}`
              : 'PLAY'
          }
          highlight
          onClick={() => {
            if (completed) track('daily_revisit', { date: today });
            startDaily(today);
          }}
        />
        <ModeCard
          title="Free play"
          subtitle="5 RANDOM COLORS"
          state="PLAY"
          onClick={startFreePlay}
        />
        <ModeCard
          title="Multiplayer"
          subtitle="PLAY HEAD-TO-HEAD"
          state={creatingMatch ? 'CREATING…' : 'CREATE MATCH'}
          onClick={handleMultiplayerClick}
          disabled={creatingMatch || !hasBackend()}
        />
      </div>

      {namingForMatch && (
        <div className="mt-8 flex flex-col items-center">
          <NicknamePrompt
            ctaLabel="Create match"
            busy={creatingMatch}
            onSubmit={() => void createMatchAndGo()}
            onCancel={() => setNamingForMatch(false)}
          />
        </div>
      )}

      {matchError && (
        <p className="mt-6 max-w-[40ch] font-mono text-[11px] uppercase tracking-[0.22em] text-dim">
          {matchError}
        </p>
      )}
    </div>
  );
}

function ModeCard({
  title,
  subtitle,
  state,
  onClick,
  highlight,
  disabled,
}: {
  title: string;
  subtitle: string;
  state: string;
  onClick: () => void;
  highlight?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group flex w-full items-center justify-between rounded-lg border bg-bg-2 px-5 py-4 text-left transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:border-line-2 enabled:hover:bg-bg-3 enabled:hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-50 ${
        highlight ? 'border-line-2' : 'border-line'
      }`}
    >
      <div className="flex flex-col gap-1">
        <span className="font-serif text-[22px] font-medium leading-none tracking-[-0.02em]">
          {title}
        </span>
        <MonoLabel className="text-dimmer" tracking={0.22}>
          {subtitle}
        </MonoLabel>
      </div>
      <MonoLabel className="text-dim" tracking={0.22}>
        {state}
      </MonoLabel>
    </button>
  );
}

function PastDailyClosed({
  date,
  onPlayToday,
  onPlayFree,
}: {
  date: string;
  onPlayToday: () => void;
  onPlayFree: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <MonoLabel className="text-dim">{formatDailyDate(date)} · CLOSED</MonoLabel>
      <h1 className="mt-6 max-w-[14ch] font-serif font-medium leading-[1.0] tracking-[-0.03em] text-[clamp(36px,7vw,72px)]">
        That Daily has <em className="italic">closed</em>.
      </h1>
      <p className="mt-6 max-w-[40ch] font-sans text-[16px] leading-[1.55] text-dim">
        Each day's colors are only playable on the day. You can start today's
        Daily, or jump into a free run.
      </p>
      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onPlayToday}>Play today's Daily</Button>
        <Button variant="ghost" onClick={onPlayFree}>
          Free play
        </Button>
      </div>
    </div>
  );
}
