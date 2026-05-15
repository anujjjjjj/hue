import { useEffect, useRef, useState } from 'react';
import { Nav } from './components/ui/Nav';
import { Intro } from './components/phases/Intro';
import { Memorize } from './components/phases/Memorize';
import { Recall } from './components/phases/Recall';
import { Results } from './components/phases/Results';
import { Summary } from './components/phases/Summary';
import { useGameStore, type Phase } from './store/gameStore';

const CROSSFADE_MS = 560;
// Results → Summary marks the shift from "a round" to "the whole run".
// A beat longer than the standard crossfade, but still understated.
const SUMMARY_CROSSFADE_MS = 720;

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
  }
}

export default function App() {
  const phase = useGameStore((s) => s.phase);

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
