import { useState } from 'react';
import { Button } from '../ui/Button';
import { ShareModal } from './ShareModal';
import type { MatchRunRow } from '../../lib/db/matches';
import type { HSB } from '../../lib/color';
import { renderMatchShareCard } from '../../lib/shareCard';
import { buildMatchShareCaption, shareUrlForMatch } from '../../lib/shareLink';
import { track } from '../../lib/analytics';
import { useGameStore } from '../../store/gameStore';

interface RoundPair {
  index: number;
  target: HSB;
  myGuess: HSB | null;
  oppGuess: HSB | null;
  myScore: number;
  oppScore: number;
}

// Renders the multiplayer share card on click and routes to the system
// share sheet (mobile) or the fallback modal (desktop). The card and modal
// reuse the existing share rendering pipeline — only the layout function
// differs.
export function MatchShareButton({
  myName,
  oppName,
  myRun,
  oppRun,
  pairs,
}: {
  myName: string;
  oppName: string;
  myRun: MatchRunRow;
  oppRun: MatchRunRow;
  pairs: RoundPair[];
}) {
  const matchId = useGameStore((s) => s.matchId);
  const [busy, setBusy] = useState(false);
  const [modalState, setModalState] = useState<{
    blob: Blob;
    url: string;
    caption: string;
  } | null>(null);

  const diff = myRun.totalScore - oppRun.totalScore;
  const outcome: 'won' | 'lost' | 'tied' =
    Math.abs(diff) < 0.05 ? 'tied' : diff > 0 ? 'won' : 'lost';

  async function handleClick() {
    if (busy || !matchId || pairs.length === 0) return;
    setBusy(true);
    track('match_share_clicked');
    try {
      const blob = await renderMatchShareCard({
        myName,
        oppName,
        myTotal: myRun.totalScore,
        oppTotal: oppRun.totalScore,
        rounds: pairs.map((p) => ({
          myGuess: p.myGuess,
          oppGuess: p.oppGuess,
          target: p.target,
          myScore: p.myScore,
          oppScore: p.oppScore,
        })),
      });
      if (!blob) {
        setBusy(false);
        return;
      }
      const url = shareUrlForMatch(matchId);
      const caption = buildMatchShareCaption(
        outcome,
        oppName,
        myRun.totalScore,
        oppRun.totalScore,
      );
      const file = new File([blob], `hue-match-${matchId}.png`, {
        type: 'image/png',
      });
      const canWebShare =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });
      if (canWebShare) {
        try {
          await navigator.share({ files: [file], text: caption, url });
          track('share_method', { method: 'webshare' });
        } catch (err) {
          // AbortError = user dismissed the sheet.
          if (!(err instanceof Error) || err.name !== 'AbortError') {
            setModalState({ blob, url, caption });
          }
        }
      } else {
        setModalState({ blob, url, caption });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={handleClick} disabled={busy}>
        {busy ? 'Preparing…' : 'Share result'}
      </Button>
      {modalState && (
        <ShareModal
          blob={modalState.blob}
          url={modalState.url}
          caption={modalState.caption}
          onClose={() => setModalState(null)}
        />
      )}
    </>
  );
}
