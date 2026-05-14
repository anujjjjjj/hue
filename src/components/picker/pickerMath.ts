import { hsbToRgb, type RGB } from '../../lib/color';

/**
 * Picker geometry math, kept pure and centralized so the picker's *visual*
 * representation and the HSB *value* it produces can never drift apart.
 * (The previous prototype shipped a bug where a CSS-gradient pad disagreed
 * with the HSB math — see pickerMath.test.ts for the regression guard.)
 */

// --- SB pad -----------------------------------------------------------------
// Normalized pad coords: x 0..1 left->right = Saturation 0..100;
// y 0..1 top->bottom = Brightness 100..0.

export function padCoordToSB(x: number, y: number): { s: number; b: number } {
  return { s: clamp01(x) * 100, b: (1 - clamp01(y)) * 100 };
}

export function sbToPadCoord(s: number, b: number): { x: number; y: number } {
  return { x: s / 100, y: 1 - b / 100 };
}

/** The exact RGB color shown at pad coord (x,y) for the given hue. */
export function padPixelRGB(h: number, x: number, y: number): RGB {
  const { s, b } = padCoordToSB(x, y);
  return hsbToRgb(h, s, b);
}

// --- Hue ring ---------------------------------------------------------------
// 0° hue at the top (12 o'clock), increasing clockwise.

/** Pointer offset from ring center (px) -> hue angle 0..360. */
export function pointToHue(px: number, py: number): number {
  const angle = (Math.atan2(py, px) * 180) / Math.PI + 90;
  return ((angle % 360) + 360) % 360;
}

/** Hue angle -> unit-circle position (x,y) with 0° at top, clockwise. */
export function hueToPoint(h: number): { x: number; y: number } {
  const rad = ((h - 90) * Math.PI) / 180;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
