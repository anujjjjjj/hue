import { useEffect, useRef, useState } from 'react';
import { Nav } from './components/ui/Nav';
import { Intro } from './components/phases/Intro';
import { Memorize } from './components/phases/Memorize';
import { Recall } from './components/phases/Recall';
import { Results } from './components/phases/Results';
import { Summary } from './components/phases/Summary';
import { useGameStore, type Phase } from './store/gameStore';
import { parseDeepLink, clearDeepLink } from './lib/deepLink';
import { pruneOldDailies } from './lib/dailyStorage';
import { track } from './lib/analytics';

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

  // One-shot: deep link routing + stale Daily cleanup. Runs on mount only —
  // the deep link is cleared from the URL after handling so back / reload
  // doesn't re-fire it. pruneOldDailies is cheap; runs every load.
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    pruneOldDailies();

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
