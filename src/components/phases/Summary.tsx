import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';
import { hsbToHex, type HSB } from '../../lib/color';
import { MAX_RUN_SCORE, verdictFor } from '../../lib/run';
import { useGameStore, type RunRoundEntry } from '../../store/gameStore';

const TOTAL_COUNT_UP_MS = 1400;
const ROW_STAGGER_MS = 80;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const pad = (n: number) => n.toString().padStart(2, '0');

export function Summary() {
  const run = useGameStore((s) => s.run);
  const playAgain = useGameStore((s) => s.playAgain);

  const [shownTotal, setShownTotal] = useState(0);
  const startRef = useRef<number | null>(null);

  // Total count-up is the bigger moment than a single-round count-up — give
  // it ~1.4s of weight. Same ease-out cubic shape as Results, just longer.
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

      <div className="mt-10 w-full max-w-[440px]">
        {run.results.map((entry, i) => (
          <Row key={entry.index} entry={entry} stagger={i} />
        ))}
      </div>

      <div className="mt-10 flex items-center gap-3">
        <Button onClick={playAgain}>Play again</Button>
        {/* Share button slots here — Build Spec 03 */}
      </div>

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
