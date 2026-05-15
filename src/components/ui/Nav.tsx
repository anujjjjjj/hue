import { Logo } from './Logo';
import { MonoLabel } from './MonoLabel';
import { Settings } from './Settings';
import { useGameStore } from '../../store/gameStore';
import { RUN_LENGTH } from '../../lib/run';

const ROUND_PHASES = new Set(['memorize', 'recall', 'results']);

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function Nav() {
  const phase = useGameStore((s) => s.phase);
  const run = useGameStore((s) => s.run);
  const showIndicator = run.active && ROUND_PHASES.has(phase);

  return (
    <nav className="flex items-center justify-between px-6 py-5 sm:px-8">
      <Logo />
      {showIndicator ? (
        <MonoLabel className="text-dim" tracking={0.25}>
          Round {pad(run.roundIndex + 1)} · of {pad(RUN_LENGTH)}
        </MonoLabel>
      ) : (
        <span />
      )}
      <Settings />
    </nav>
  );
}
