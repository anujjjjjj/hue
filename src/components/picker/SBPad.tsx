import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { padCoordToSB, padPixelRGB, sbToPadCoord } from './pickerMath';
import { useDrag } from './useDrag';

interface SBPadProps {
  hue: number;
  s: number;
  b: number;
  onChange: (s: number, b: number) => void;
  width?: number;
  height?: number;
}

// Offscreen render resolution. The pad colors are computed exactly via
// padPixelRGB (the same hsbToRgb the scorer uses) on a coarse grid and
// bilinearly interpolated up — never eyeballed with CSS gradients.
const GRID = 96;

/** Saturation/Brightness pad. Canvas-rendered so the visual is the math. */
export function SBPad({
  hue,
  s,
  b,
  onChange,
  width = 200,
  height = 200,
}: SBPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Re-render the pad whenever the hue changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(GRID, GRID);
    for (let yy = 0; yy < GRID; yy++) {
      for (let xx = 0; xx < GRID; xx++) {
        const [r, g, bl] = padPixelRGB(
          hue,
          xx / (GRID - 1),
          yy / (GRID - 1),
        );
        const i = (yy * GRID + xx) * 4;
        img.data[i] = Math.round(r * 255);
        img.data[i + 1] = Math.round(g * 255);
        img.data[i + 2] = Math.round(bl * 255);
        img.data[i + 3] = 255;
      }
    }
    // Paint the coarse grid, then let the browser scale it up smoothly.
    const tmp = document.createElement('canvas');
    tmp.width = GRID;
    tmp.height = GRID;
    tmp.getContext('2d')!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  }, [hue]);

  const move = useCallback(
    (e: PointerEvent | ReactPointerEvent, el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const sb = padCoordToSB(x, y);
      onChange(sb.s, sb.b);
    },
    [onChange],
  );
  const drag = useDrag(move);

  const thumb = sbToPadCoord(s, b);

  return (
    <div
      {...drag}
      className="relative cursor-crosshair select-none overflow-hidden rounded-md border border-line"
      style={{ width, height, ...drag.style }}
      role="slider"
      aria-label="Saturation and brightness"
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block h-full w-full"
      />
      <div
        className="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-fg shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
        style={{
          left: `${thumb.x * 100}%`,
          top: `${thumb.y * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
}
