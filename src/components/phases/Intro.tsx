import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';

export function Intro() {
  const begin = useGameStore((s) => s.begin);

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
      <div className="mt-12">
        <Button onClick={begin}>Begin</Button>
      </div>
    </div>
  );
}
