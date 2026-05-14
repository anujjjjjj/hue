import type { ShrinkStyle } from '../store/gameStore';

/** Default deformation parameters for the idle (un-shrinking) blob. */
export const BLOB_DEFAULTS = {
  amount: 0.15,
  freq: 2.0,
  clearcoat: 0.9,
  roughness: 0.15,
} as const;

/** Scale the blob collapses toward during the collapse animation. */
export const COLLAPSE_SCALE = 0.02;

/**
 * Non-linear shrink curve — gentle at first, accelerating toward the end.
 * progress 0..1 -> eased 0..1.
 */
export function easeShrink(progress: number): number {
  return progress ** 3 * 0.55 + progress * 0.45;
}

/** Blob scale for a given eased shrink value: 1.0 -> ~0.32. */
export function shrinkScale(eased: number): number {
  return 1.0 - eased * 0.68;
}

export interface SurfaceParams {
  amount: number;
  freq: number;
  clearcoat: number;
  roughness: number;
}

/**
 * Surface behaviour for a given shrink style at a given eased progress.
 * eased=0 always returns the idle defaults.
 */
export function surfaceParams(
  style: ShrinkStyle,
  eased: number,
): SurfaceParams {
  switch (style) {
    case 'scale':
      return { ...BLOB_DEFAULTS };
    case 'densify':
      return {
        amount: 0.15 * (1 - eased * 0.35),
        freq: 2.0 + eased * 4.5,
        clearcoat: 0.9 + eased * 0.1,
        roughness: 0.15 * (1 - eased * 0.6),
      };
    case 'calm':
      return {
        amount: 0.15 * (1 - eased * 0.92),
        freq: 2.0 - eased * 0.8,
        clearcoat: BLOB_DEFAULTS.clearcoat,
        roughness: BLOB_DEFAULTS.roughness,
      };
  }
}
