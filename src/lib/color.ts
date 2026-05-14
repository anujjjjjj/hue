// Color math — the single source of truth for turning a color value into
// something renderable and for perceptual scoring.

export interface HSB {
  h: number; // 0..360
  s: number; // 0..100
  b: number; // 0..100
}

export type RGB = [number, number, number]; // each 0..1
export type Lab = [number, number, number];

/**
 * HSB (a.k.a. HSV) -> RGB. h in [0,360], s & b in [0,100].
 * Returns RGB components in [0,1]. Everything renderable derives from this.
 */
export function hsbToRgb(h: number, s: number, b: number): RGB {
  const sat = s / 100;
  const val = b / 100;
  const c = val * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let bl = 0;
  if (hp >= 0 && hp < 1) [r, g, bl] = [c, x, 0];
  else if (hp < 2) [r, g, bl] = [x, c, 0];
  else if (hp < 3) [r, g, bl] = [0, c, x];
  else if (hp < 4) [r, g, bl] = [0, x, c];
  else if (hp < 5) [r, g, bl] = [x, 0, c];
  else [r, g, bl] = [c, 0, x];
  const m = val - c;
  return [r + m, g + m, bl + m];
}

/** Convenience: HSB -> "#rrggbb" hex string. */
export function hsbToHex(h: number, s: number, b: number): string {
  const [r, g, bl] = hsbToRgb(h, s, b);
  const to = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(bl)}`;
}

/** sRGB component [0,1] -> linear light. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB [0,1] -> CIE XYZ (D65, scaled so Y of white = 100). */
export function rgbToXyz([r, g, b]: RGB): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) * 100;
  const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) * 100;
  const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) * 100;
  return [x, y, z];
}

// D65 reference white.
const Xn = 95.047;
const Yn = 100.0;
const Zn = 108.883;

/** CIE XYZ -> CIE Lab. */
export function xyzToLab([x, y, z]: [number, number, number]): Lab {
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27) * t / 116 + 16 / 116;
  const fx = f(x / Xn);
  const fy = f(y / Yn);
  const fz = f(z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Full pipeline: HSB -> Lab. */
export function hsbToLab(h: number, s: number, b: number): Lab {
  return xyzToLab(rgbToXyz(hsbToRgb(h, s, b)));
}

const deg2rad = (d: number) => (d * Math.PI) / 180;
const rad2deg = (r: number) => (r * 180) / Math.PI;

/**
 * CIEDE2000 color difference between two Lab colors.
 * Implemented from Sharma, Wu & Dalal (2005).
 */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const hp = (ap: number, bp: number) => {
    if (ap === 0 && bp === 0) return 0;
    let h = rad2deg(Math.atan2(bp, ap));
    if (h < 0) h += 360;
    return h;
  };
  const h1p = hp(a1p, b1);
  const h2p = hp(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hbarp = (h1p + h2p + 360) / 2;
  } else {
    hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(deg2rad(hbarp - 30)) +
    0.24 * Math.cos(deg2rad(2 * hbarp)) +
    0.32 * Math.cos(deg2rad(3 * hbarp + 6)) -
    0.2 * Math.cos(deg2rad(4 * hbarp - 63));

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const Sl =
    1 +
    (0.015 * Math.pow(Lbarp - 50, 2)) /
      Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(deg2rad(2 * dTheta)) * Rc;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  return Math.sqrt(
    Math.pow(dLp / (kL * Sl), 2) +
      Math.pow(dCp / (kC * Sc), 2) +
      Math.pow(dHp / (kH * Sh), 2) +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)),
  );
}
