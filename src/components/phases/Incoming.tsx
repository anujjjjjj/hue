import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';
import { getMatch, type MatchRow } from '../../lib/db/matches';
import { fetchPlayerNickname, getNickname } from '../../lib/db/player';
import { NicknamePrompt } from '../ui/NicknamePrompt';

// "Incoming match" landing screen. Reached only via the join flow when the
// recipient has not yet played this match (and is not the creator). They
// see who's challenging them and a single decisive CTA to play.

export function Incoming() {
  const matchId = useGameStore((s) => s.matchId);
  const startMatchPlay = useGameStore((s) => s.startMatchPlay);
  const goToIntro = useGameStore((s) => s.goToIntro);

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [opponent, setOpponent] = useState<string>('');
  const haveMyName = getNickname().trim().length > 0;

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    void (async () => {
      const m = await getMatch(matchId);
      if (cancelled) return;
      setMatch(m);
      if (m) {
        const nick = await fetchPlayerNickname(m.createdBy);
        if (!cancelled) setOpponent(nick);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (!matchId) return null;

  const opponentName = opponent || 'Anonymous';

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <MonoLabel className="text-dim" tracking={0.3}>
        Incoming multiplayer match
      </MonoLabel>
      <h1 className="mt-6 max-w-[16ch] font-serif font-medium leading-[1.0] tracking-[-0.03em] text-[clamp(36px,7vw,68px)]">
        <span className="text-fg">{opponentName}</span>{' '}
        <em className="italic text-dim">is challenging you</em>.
      </h1>
      <p className="mt-6 max-w-[44ch] font-sans text-[15px] leading-[1.55] text-dim">
        You'll both play the same five colors. Five rounds. No timer.
      </p>

      {haveMyName ? (
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => match && startMatchPlay(matchId, match.seed)}
            disabled={!match}
          >
            Play now
          </Button>
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center">
          <NicknamePrompt
            ctaLabel="Play now"
            onSubmit={() => {
              if (match) startMatchPlay(matchId, match.seed);
            }}
          />
        </div>
      )}

      <button
        onClick={goToIntro}
        className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-dimmer transition-colors hover:text-dim"
      >
        Or play your own
      </button>
    </div>
  );
}
