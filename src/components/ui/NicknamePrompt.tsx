import { useState } from 'react';
import { Button } from './Button';
import { MonoLabel } from './MonoLabel';
import { getNickname, setNickname } from '../../lib/db/player';

const MAX_LEN = 20;

// Minimal inline nickname capture. Used at the two multiplayer entry
// points (Intro → Create match, Incoming → Play now) so the opponent
// has something to address you by. Pre-fills the stored name when
// editing; required (trimmed) on first use.
export function NicknamePrompt({
  ctaLabel,
  onSubmit,
  onCancel,
  busy,
}: {
  ctaLabel: string;
  onSubmit: (nickname: string) => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const [value, setValue] = useState<string>(() => getNickname());
  const trimmed = value.trim().slice(0, MAX_LEN);
  const canSubmit = trimmed.length >= 1 && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    await setNickname(trimmed);
    onSubmit(trimmed);
  }

  return (
    <div className="flex w-full max-w-[360px] flex-col gap-3">
      <MonoLabel className="text-dimmer" tracking={0.28}>
        Your name · so your opponent knows who they're playing
      </MonoLabel>
      <input
        autoFocus
        type="text"
        value={value}
        maxLength={MAX_LEN}
        placeholder="e.g. Sam"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSubmit();
        }}
        className="rounded-md border border-line bg-bg-2 px-3 py-2.5 font-sans text-[15px] text-fg outline-none transition-colors placeholder:text-dimmer focus:border-line-2"
      />
      <div className="flex items-center justify-center gap-3">
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {busy ? 'Creating…' : ctaLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
