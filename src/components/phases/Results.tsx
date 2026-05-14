import { useEffect, useRef, useState } from 'react';
import { Blob } from '../blob/Blob';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';
import { useGameStore } from '../../store/gameStore';

const COUNT_UP_MS = 1100;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function Results() {
  const guess = useGameStore((s) => s.guess);
  const target = useGameStore((s) => s.target);
  const result = useGameStore((s) => s.result);
  const playAgain = useGameStore((s) => s.playAgain);

  const [shown, setShown] = useState(0);
  const startRef = useRef<number | null>(null);

  // The count-up is the reward moment — give it weight.
  useEffect(() => {
    if (!result) return;
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / COUNT_UP_MS);
      setShown(result.score * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result]);

  if (!result || !target) return null;

  const deltas: Array<[string, string]> = [
    ['ΔH', `${result.dH >= 0 ? '+' : ''}${result.dH.toFixed(1)}°`],
    ['ΔS', `${result.dS >= 0 ? '+' : ''}${result.dS.toFixed(1)}%`],
    ['ΔB', `${result.dB >= 0 ? '+' : ''}${result.dB.toFixed(1)}%`],
    ['ΔE', result.deltaE.toFixed(2)],
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-9 px-6 py-12">
      <div className="flex items-start gap-8 sm:gap-14">
        <BlobCard label="Your guess" color={guess} />
        <BlobCard label="Target" color={target} />
      </div>

      <div className="flex flex-col items-center">
        <MonoLabel className="text-dimmer" tracking={0.2}>
          Perceptual distance · CIEDE2000
        </MonoLabel>
        <div className="mt-3 flex items-baseline">
          <span className="font-serif font-medium leading-none tracking-[-0.03em] text-[clamp(60px,13vw,132px)]">
            {shown.toFixed(1)}
          </span>
          <span className="ml-1 font-serif text-[clamp(20px,3vw,32px)] italic text-dim">
            /10
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-7 gap-y-3">
        {deltas.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-2">
            <MonoLabel className="text-dimmer">{k}</MonoLabel>
            <span className="font-mono text-[14px] tabular-nums text-fg">
              {v}
            </span>
          </div>
        ))}
      </div>

      <Button onClick={playAgain}>Play again</Button>
    </div>
  );
}

function BlobCard({
  label,
  color,
}: {
  label: string;
  color: { h: number; s: number; b: number };
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        style={{ width: 'min(34vw, 30vh)', height: 'min(34vw, 30vh)' }}
      >
        <Blob color={color} className="h-full w-full" />
      </div>
      <MonoLabel className="text-dim">{label}</MonoLabel>
    </div>
  );
}
