import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { MonoLabel } from '../ui/MonoLabel';
import { getMatch, type MatchRow } from '../../lib/db/matches';
import { shareUrlForMatch } from '../../lib/shareLink';

// Lobby is the screen shown immediately after a match exists for this device.
// It's the convergence point for both entry paths:
//   • Path A (Play together)        — created_by_run_id IS NULL  → "Start playing"
//   • Path B (Challenge after Free) — created_by_run_id IS SET   → "See results when they're done"
// We fetch the match once to determine which branch we're in; the user can't
// reach this phase without store.matchId being set.

export function Lobby() {
  const matchId = useGameStore((s) => s.matchId);
  const startMatchPlay = useGameStore((s) => s.startMatchPlay);
  const goToMatchResults = useGameStore((s) => s.goToMatchResults);
  const goToIntro = useGameStore((s) => s.goToIntro);

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    void getMatch(matchId).then((m) => {
      if (!cancelled) setMatch(m);
    });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (!matchId) return null;

  const url = shareUrlForMatch(matchId);
  // Until match loads we render the URL skeleton but keep CTAs disabled —
  // we don't yet know which path we're on. The fetch is fast (single row by
  // PK) so this is a flash.
  const isPathB = !!match?.createdByRunId;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can fail in non-secure contexts; fall back to a select-all
      // by focusing the readonly input below — the user can ⌘C from there.
      const input = document.getElementById(
        'match-link-input',
      ) as HTMLInputElement | null;
      input?.select();
    }
  }

  async function handleShare() {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({
          text: 'Play this Hue match with me',
          url,
        });
      } catch {
        // User dismissed — no-op.
      }
    } else {
      void handleCopy();
    }
  }

  function handlePrimary() {
    if (!match) return;
    if (isPathB) {
      // Creator's run already submitted (Path B). Jump to results, which
      // will show the waiting state until the opponent plays.
      goToMatchResults(matchId!);
    } else {
      // Path A: creator now plays the seed inside the match.
      startMatchPlay(matchId!, match.seed);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <MonoLabel className="text-dim" tracking={0.3}>
        Multiplayer match
      </MonoLabel>
      <h1 className="mt-6 max-w-[16ch] font-serif font-medium leading-[1.0] tracking-[-0.03em] text-[clamp(36px,7vw,68px)]">
        Share this link <em className="italic">with a friend</em>.
      </h1>

      <div className="mt-10 flex w-full max-w-[440px] flex-col gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-bg-2 px-3 py-3">
          <input
            id="match-link-input"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 truncate bg-transparent font-mono text-[12.5px] tracking-[0.02em] text-fg outline-none"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-full bg-fg px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-bg transition-opacity hover:opacity-90"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="flex justify-center">
          <Button variant="ghost" onClick={handleShare}>
            Share link
          </Button>
        </div>
      </div>

      <p className="mt-10 max-w-[44ch] font-sans text-[15px] leading-[1.55] text-dim">
        {isPathB
          ? "Your run's been sent. You'll see the comparison when they finish."
          : "You can start playing now. They'll join whenever they open the link. Both your scores will appear when you're both done."}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={handlePrimary} disabled={!match}>
          {isPathB ? 'See results when they’re done' : 'Start playing'}
        </Button>
        <Button variant="ghost" onClick={goToIntro}>
          Back
        </Button>
      </div>
    </div>
  );
}
