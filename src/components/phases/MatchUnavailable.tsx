import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';

// Friendly fallback when a ?m= link points to nothing (or to an expired
// match). Two messages, one component — they differ only in the headline
// and the helper line below the CTAs.

export function MatchUnavailable() {
  const reason = useGameStore((s) => s.matchUnavailableReason);
  const startDaily = useGameStore((s) => s.startDaily);
  const startFreePlay = useGameStore((s) => s.startFreePlay);
  const goToIntro = useGameStore((s) => s.goToIntro);

  const expired = reason === 'expired';

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <MonoLabel className="text-dim" tracking={0.3}>
        {expired ? 'Match closed' : 'Link not found'}
      </MonoLabel>
      <h1 className="mt-6 max-w-[18ch] font-serif font-medium leading-[1.05] tracking-[-0.03em] text-[clamp(34px,6.5vw,64px)]">
        {expired ? (
          <>
            This match has <em className="italic">closed</em>.
          </>
        ) : (
          <>
            This match link <em className="italic">doesn't seem to work</em>.
          </>
        )}
      </h1>
      <p className="mt-6 max-w-[44ch] font-sans text-[15px] leading-[1.55] text-dim">
        {expired
          ? 'Matches expire after 30 days. Play one of your own?'
          : 'It may have been mistyped, or the match was never created.'}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {expired ? (
          <>
            <Button onClick={() => startDaily()}>Today's Daily</Button>
            <Button variant="ghost" onClick={startFreePlay}>
              Free play
            </Button>
          </>
        ) : (
          <Button onClick={goToIntro}>Back to start</Button>
        )}
      </div>
    </div>
  );
}
