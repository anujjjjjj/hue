import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { hueToPoint, pointToHue } from './pickerMath';
import { useDrag } from './useDrag';
import { MonoLabel } from '../ui/MonoLabel';

interface HueRingProps {
  hue: number;
  onChange: (hue: number) => void;
  size?: number;
}

/** Circular hue control. 0° at top, increasing clockwise. */
export function HueRing({ hue, onChange, size = 200 }: HueRingProps) {
  const ref = useRef<HTMLDivElement>(null);

  const move = useCallback(
    (e: PointerEvent | ReactPointerEvent, el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      onChange(pointToHue(e.clientX - cx, e.clientY - cy));
    },
    [onChange],
  );
  const drag = useDrag(move);

  const thumbR = size / 2 - size * 0.115; // sit on the ring band
  const p = hueToPoint(hue);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={ref}
        {...drag}
        className="relative cursor-pointer select-none"
        style={{ width: size, height: size, ...drag.style }}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hue)}
      >
        {/* The ring: full hue wheel, masked to a band. */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, hsl(0,100%,55%), hsl(60,100%,55%), hsl(120,100%,55%), hsl(180,100%,55%), hsl(240,100%,55%), hsl(300,100%,55%), hsl(360,100%,55%))',
            // 0° hue at top: conic-gradient starts at 12 o'clock by default.
            WebkitMask:
              'radial-gradient(circle, transparent 52%, #000 54%)',
            mask: 'radial-gradient(circle, transparent 52%, #000 54%)',
          }}
        />
        {/* Inner disc with the Hue label. */}
        <div
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-bg-2 border border-line"
          style={{ width: size * 0.5, height: size * 0.5 }}
        >
          <MonoLabel className="text-dim" tracking={0.2}>
            Hue
          </MonoLabel>
        </div>
        {/* Thumb. */}
        <div
          className="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-fg bg-bg shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{
            left: `calc(50% + ${p.x * thumbR}px)`,
            top: `calc(50% + ${p.y * thumbR}px)`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
}
