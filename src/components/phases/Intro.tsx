import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';
import { formatDailyDate, todayUTC } from '../../lib/daily';
import { loadDaily, type DailyStored } from '../../lib/dailyStorage';
import { MAX_RUN_SCORE } from '../../lib/run';
import { track } from '../../lib/analytics';

export function Intro() {
  const startDaily = useGameStore((s) => s.startDaily);
  const startFreePlay = useGameStore((s) => s.startFreePlay);
  const pastDailyDate = useGameStore((s) => s.pastDailyDate);
  const clearPastDailyMessage = useGameStore((s) => s.clearPastDailyMessage);

  const today = useMemo(() => todayUTC(), []);
  const [daily, setDaily] = useState<DailyStored | null>(() => loadDaily(today));

  // Re-check storage whenever this screen mounts — e.g. someone hit "Play
  // free" after a completed Daily and bounces back here later.
  useEffect(() => {
    setDaily(loadDaily(today));
  }, [today]);

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
      </div>
    </div>
  );
}

function ModeCard({
  title,
  subtitle,
  state,
  onClick,
  highlight,
}: {
  title: string;
  subtitle: string;
  state: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-lg border bg-bg-2 px-5 py-4 text-left transition-all duration-200 hover:-translate-y-px hover:border-line-2 hover:bg-bg-3 hover:shadow-lift ${
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
