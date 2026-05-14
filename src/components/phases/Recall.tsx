import { Blob } from '../blob/Blob';
import { ColorPicker } from '../picker/ColorPicker';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';
import { useGameStore } from '../../store/gameStore';

/**
 * Recall is untimed in v1. The phase is structured so a recall timer could
 * be added later (a shrink-style countdown, or a plain readout) without
 * restructuring the layout.
 */
export function Recall() {
  const guess = useGameStore((s) => s.guess);
  const setGuess = useGameStore((s) => s.setGuess);
  const lockGuess = useGameStore((s) => s.lockGuess);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <MonoLabel className="text-dim">Recreate it</MonoLabel>

      <div style={{ width: 'min(48vh, 52vw)', height: 'min(48vh, 52vw)' }}>
        <Blob color={guess} className="h-full w-full" />
      </div>

      <ColorPicker value={guess} onChange={setGuess} />

      <Button onClick={lockGuess}>Lock it in</Button>
    </div>
  );
}
