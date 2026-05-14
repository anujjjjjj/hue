import { describe, it, expect } from 'vitest';
import { hsbToRgb } from '../../lib/color';
import {
  padCoordToSB,
  sbToPadCoord,
  padPixelRGB,
  pointToHue,
  hueToPoint,
} from './pickerMath';

describe('SB pad math', () => {
  it('round-trips SB <-> pad coords', () => {
    for (const s of [0, 25, 50, 75, 100]) {
      for (const b of [0, 25, 50, 75, 100]) {
        const { x, y } = sbToPadCoord(s, b);
        const back = padCoordToSB(x, y);
        expect(back.s).toBeCloseTo(s, 6);
        expect(back.b).toBeCloseTo(b, 6);
      }
    }
  });

  it('corners map correctly', () => {
    expect(padCoordToSB(0, 0)).toEqual({ s: 0, b: 100 }); // top-left
    expect(padCoordToSB(1, 1)).toEqual({ s: 100, b: 0 }); // bottom-right
  });

  // THE regression test: the color the pad *shows* at a coordinate must be
  // the exact color produced by feeding that coordinate's HSB to the same
  // hsbToRgb function used for scoring.
  it('pad pixel color == scored color for the same coordinate', () => {
    for (const h of [0, 47, 120, 211, 300, 359]) {
      for (const x of [0, 0.33, 0.5, 0.78, 1]) {
        for (const y of [0, 0.25, 0.6, 1]) {
          const { s, b } = padCoordToSB(x, y);
          expect(padPixelRGB(h, x, y)).toEqual(hsbToRgb(h, s, b));
        }
      }
    }
  });
});

describe('hue ring math', () => {
  it('0° hue is at the top (12 o\'clock)', () => {
    expect(pointToHue(0, -1)).toBeCloseTo(0, 6);
  });

  it('increases clockwise: 90° is at 3 o\'clock', () => {
    expect(pointToHue(1, 0)).toBeCloseTo(90, 6);
  });

  it('180° is at the bottom', () => {
    expect(pointToHue(0, 1)).toBeCloseTo(180, 6);
  });

  it('270° is at 9 o\'clock', () => {
    expect(pointToHue(-1, 0)).toBeCloseTo(270, 6);
  });

  it('round-trips hue <-> point', () => {
    for (const h of [0, 30, 90, 175, 270, 330]) {
      const { x, y } = hueToPoint(h);
      expect(pointToHue(x, y)).toBeCloseTo(h, 4);
    }
  });
});
