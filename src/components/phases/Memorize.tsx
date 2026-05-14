import { useEffect, useRef, useState } from 'react';
import { Blob } from '../blob/Blob';
import { MonoLabel } from '../ui/MonoLabel';
import { advanceToRecall, useGameStore } from '../../store/gameStore';

export function Memorize() {
  const target = useGameStore((s) => s.target);
  const { shrinkStyle, shrinkDuration } = useGameStore((s) => s.settings);

  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);

  // Drive the shrink: progress 0..1 over `shrinkDuration` seconds.
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
      const p = Math.min(1, elapsed / shrinkDuration);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shrinkDuration]);

  if (!target) return null;

  const remaining = Math.max(0, shrinkDuration * (1 - progress));
  const urgent = remaining <= 2;

  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      <div className="absolute top-8 left-1/2 -translate-x-1/2">
        <MonoLabel className="text-dim">Memorize</MonoLabel>
      </div>

      <div style={{ width: 'min(74vw, 74vh)', height: 'min(74vw, 74vh)' }}>
        <Blob
          color={target}
          shrink={{ progress, style: shrinkStyle }}
          onCollapseComplete={advanceToRecall}
          className="h-full w-full"
        />
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
        <span
          className={`font-mono text-[13px] tabular-nums tracking-[0.15em] transition-colors duration-300 ${
            urgent ? 'text-danger' : 'text-dim'
          }`}
        >
          {remaining.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
