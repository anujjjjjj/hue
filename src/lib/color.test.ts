import { describe, it, expect } from 'vitest';
import { hsbToRgb, ciede2000, type Lab } from './color';

describe('hsbToRgb', () => {
  const close = (a: number[], b: number[]) => {
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));
  };

  it('pure red', () => close(hsbToRgb(0, 100, 100), [1, 0, 0]));
  it('pure green', () => close(hsbToRgb(120, 100, 100), [0, 1, 0]));
  it('pure blue', () => close(hsbToRgb(240, 100, 100), [0, 0, 1]));
  it('white', () => close(hsbToRgb(0, 0, 100), [1, 1, 1]));
  it('black', () => close(hsbToRgb(0, 0, 0), [0, 0, 0]));
  it('mid grey', () => close(hsbToRgb(0, 0, 50), [0.5, 0.5, 0.5]));
  it('cyan', () => close(hsbToRgb(180, 100, 100), [0, 1, 1]));
  it('yellow', () => close(hsbToRgb(60, 100, 100), [1, 1, 0]));
  it('wraps hue 360 to 0', () => close(hsbToRgb(360, 100, 100), [1, 0, 0]));
  it('half-saturated red', () => close(hsbToRgb(0, 50, 100), [1, 0.5, 0.5]));
});

describe('ciede2000', () => {
  // Reference pairs from Sharma, Wu & Dalal (2005) test data.
  const cases: Array<{ a: Lab; b: Lab; e: number }> = [
    { a: [50, 2.6772, -79.7751], b: [50, 0, -82.7485], e: 2.0425 },
    { a: [50, 3.1571, -77.2803], b: [50, 0, -82.7485], e: 2.8615 },
    { a: [50, -1.3802, -84.2814], b: [50, 0, -82.7485], e: 1.0 },
    { a: [50, 2.5, 0], b: [50, 0, -2.5], e: 4.3065 },
    { a: [50, 2.5, 0], b: [73, 25, -18], e: 27.1492 },
    { a: [50, 2.5, 0], b: [50, 3.1736, 0.5854], e: 1.0 },
    { a: [50, 0, 0], b: [50, -1, 2], e: 2.3669 },
    { a: [60.2574, -34.0099, 36.2677], b: [60.4626, -34.1751, 39.4387], e: 1.2644 },
  ];

  cases.forEach(({ a, b, e }, i) => {
    it(`reference pair ${i + 1} -> ${e}`, () => {
      expect(ciede2000(a, b)).toBeCloseTo(e, 4);
    });
  });

  it('is zero for identical colors', () => {
    expect(ciede2000([50, 10, -20], [50, 10, -20])).toBeCloseTo(0, 6);
  });

  it('is symmetric', () => {
    const a: Lab = [40, 12, -8];
    const b: Lab = [55, -3, 22];
    expect(ciede2000(a, b)).toBeCloseTo(ciede2000(b, a), 6);
  });
});
