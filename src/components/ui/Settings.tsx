import { useState } from 'react';
import { useGameStore, type ShrinkStyle } from '../../store/gameStore';
import { MonoLabel } from './MonoLabel';

const SHRINK_STYLES: Array<{ key: ShrinkStyle; note: string }> = [
  { key: 'scale', note: 'Pure contraction' },
  { key: 'densify', note: 'Ripples tighten' },
  { key: 'calm', note: 'Surface settles' },
];

export function Settings() {
  const [open, setOpen] = useState(false);
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-dim transition-colors hover:text-fg"
      >
        <GearIcon />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-50 mt-3 w-64 rounded-lg border border-line-2 bg-bg-2 p-6">
            <MonoLabel className="text-dimmer">Shrink style</MonoLabel>
            <div className="mt-3 flex flex-col gap-1">
              {SHRINK_STYLES.map(({ key, note }) => {
                const active = settings.shrinkStyle === key;
                return (
                  <button
                    key={key}
                    onClick={() => updateSettings({ shrinkStyle: key })}
                    className={`flex items-baseline justify-between rounded-md px-3 py-2 text-left transition-colors ${
                      active ? 'bg-bg-3' : 'hover:bg-bg-3/50'
                    }`}
                  >
                    <span
                      className={`font-sans text-[14px] capitalize ${
                        active ? 'text-fg' : 'text-dim'
                      }`}
                    >
                      {key}
                    </span>
                    <span className="font-sans text-[11px] text-dimmer">
                      {note}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-baseline justify-between">
              <MonoLabel className="text-dimmer">Duration</MonoLabel>
              <span className="font-mono text-[13px] tabular-nums text-fg">
                {settings.shrinkDuration.toFixed(0)}s
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={12}
              step={1}
              value={settings.shrinkDuration}
              onChange={(e) =>
                updateSettings({ shrinkDuration: Number(e.target.value) })
              }
              className="mt-3 w-full accent-citron"
            />
          </div>
        </>
      )}
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5L3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
