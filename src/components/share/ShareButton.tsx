import { useState } from 'react';
import { Button } from '../ui/Button';
import { useGameStore } from '../../store/gameStore';
import { renderShareCard } from '../../lib/shareCard';
import {
  buildShareCaption,
  shareUrlForDaily,
  shareUrlForFreePlay,
} from '../../lib/shareLink';
import { track } from '../../lib/analytics';
import { ShareModal } from './ShareModal';

export function ShareButton() {
  const mode = useGameStore((s) => s.mode);
  const dailyDate = useGameStore((s) => s.dailyDate);
  const results = useGameStore((s) => s.run.results);
  const totalScore = useGameStore((s) => s.run.totalScore);

  const [busy, setBusy] = useState(false);
  const [modalState, setModalState] = useState<{
    blob: Blob;
    url: string;
    caption: string;
  } | null>(null);

  const shareMode: 'daily' | 'free' = mode === 'daily' ? 'daily' : 'free';
  const url =
    shareMode === 'daily' && dailyDate
      ? shareUrlForDaily(dailyDate)
      : shareUrlForFreePlay();
  const caption = buildShareCaption(shareMode, totalScore);

  const handleClick = async () => {
    if (busy || results.length === 0) return;
    setBusy(true);
    track('share_clicked', {
      mode: shareMode,
      score: Number(totalScore.toFixed(2)),
    });

    try {
      const blob = await renderShareCard({
        mode: shareMode,
        date: dailyDate ?? undefined,
        results,
        totalScore,
      });
      if (!blob) {
        setBusy(false);
        return;
      }

      const file = new File([blob], shareFilename(shareMode, dailyDate), {
        type: 'image/png',
      });
      const canWebShare =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canWebShare) {
        try {
          await navigator.share({
            files: [file],
            text: caption,
            url,
          });
          track('share_method', { method: 'webshare' });
        } catch (err) {
          // AbortError is the user dismissing the sheet — not a failure.
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
  };

  return (
    <>
      <Button variant="ghost" onClick={handleClick} disabled={busy}>
        {busy ? 'Preparing…' : 'Share'}
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

function shareFilename(mode: 'daily' | 'free', date: string | null): string {
  if (mode === 'daily' && date) return `hue-daily-${date}.png`;
  return 'hue-run.png';
}
