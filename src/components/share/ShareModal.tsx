import { useEffect, useMemo, useState } from 'react';
import { Logo } from '../ui/Logo';
import { MonoLabel } from '../ui/MonoLabel';
import { track } from '../../lib/analytics';

interface ShareModalProps {
  blob: Blob;
  url: string;
  caption: string;
  onClose: () => void;
}

type Status = 'idle' | 'ok' | 'err';

export function ShareModal({ blob, url, caption, onClose }: ShareModalProps) {
  const previewUrl = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const [copyImg, setCopyImg] = useState<Status>('idle');
  const [copyLink, setCopyLink] = useState<Status>('idle');

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopyImage = async () => {
    try {
      if (
        typeof ClipboardItem === 'undefined' ||
        !navigator.clipboard?.write
      ) {
        setCopyImg('err');
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopyImg('ok');
      track('share_method', { method: 'copyimage' });
    } catch {
      setCopyImg('err');
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = 'hue.png';
    a.click();
    track('share_method', { method: 'download' });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${caption}\n${url}`);
      setCopyLink('ok');
      track('share_method', { method: 'copylink' });
    } catch {
      setCopyLink('err');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[560px] rounded-xl border border-line-2 bg-bg-2 p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <Logo />
          <button
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-dim transition-colors hover:text-fg"
          >
            Close
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-line">
          <img
            src={previewUrl}
            alt="Your run, formatted for sharing"
            className="block h-auto w-full"
          />
        </div>

        <MonoLabel className="mt-5 block text-dimmer" tracking={0.22}>
          {caption}
        </MonoLabel>

        <div className="mt-5 flex flex-wrap gap-2">
          <ActionPill onClick={handleCopyImage} status={copyImg}>
            {copyImg === 'ok'
              ? 'Copied'
              : copyImg === 'err'
                ? 'Copy failed'
                : 'Copy image'}
          </ActionPill>
          <ActionPill onClick={handleDownload} status="idle">
            Download
          </ActionPill>
          <ActionPill onClick={handleCopyLink} status={copyLink}>
            {copyLink === 'ok'
              ? 'Link copied'
              : copyLink === 'err'
                ? 'Copy failed'
                : 'Copy link'}
          </ActionPill>
        </div>
      </div>
    </div>
  );
}

function ActionPill({
  onClick,
  children,
  status,
}: {
  onClick: () => void;
  children: React.ReactNode;
  status: Status;
}) {
  const styles =
    status === 'ok'
      ? 'border-line-2 text-fg'
      : status === 'err'
        ? 'border-line-2 text-danger'
        : 'border-line text-dim hover:border-line-2 hover:text-fg';
  return (
    <button
      onClick={onClick}
      className={`rounded-full border bg-transparent px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors duration-200 ${styles}`}
    >
      {children}
    </button>
  );
}
