// Share card renderer. Given a finished run, produces a 1200×630 PNG Blob
// in the editorial design language: near-black ground, Fraunces + JetBrains
// Mono, dim metadata. The colors are the hero — five vertical pair-blocks
// (guess stacked over target, paint-chip style) carry the visual weight.
//
// All fonts must be loaded before rendering — a fallback typeface ruins the
// card. We await document.fonts.ready and prime the specific weights used.

import { hsbToHex, type HSB } from './color';
import { formatDailyDate } from './daily';
import { MAX_RUN_SCORE } from './run';
import type { RunRoundEntry } from '../store/gameStore';

export type ShareMode = 'daily' | 'free';

export interface ShareCardInput {
  mode: ShareMode;
  /** UTC date string for Daily; ignored for free play. */
  date?: string;
  results: RunRoundEntry[];
  totalScore: number;
  /** Domain shown bottom-right; defaults to the production host. */
  domain?: string;
}

// Logical canvas size — Open Graph 1.91:1.
const W = 1200;
const H = 630;
const SCALE = 2; // 2× internal resolution; downscaled on display.

const COLORS = {
  bg: '#0a0a0a',
  fg: '#f5f5f0',
  dim: '#9a9a92',
  dimmer: '#555555',
  hairline: '#1f1f1f',
  border: 'rgba(255,255,255,0.04)',
} as const;

const FONT_SERIF = 'Fraunces';
const FONT_MONO = '"JetBrains Mono"';

async function ensureFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`500 110px ${FONT_SERIF}`),
      document.fonts.load(`italic 500 40px ${FONT_SERIF}`),
      document.fonts.load(`500 44px ${FONT_SERIF}`),
      document.fonts.load(`500 22px ${FONT_SERIF}`),
      document.fonts.load(`500 11px ${FONT_MONO}`),
      document.fonts.load(`500 12px ${FONT_MONO}`),
      document.fonts.load(`500 13px ${FONT_MONO}`),
    ]);
    await document.fonts.ready;
  } catch {
    // Render with fallback if font loading throws.
  }
}

/** Render the share card. Returns a PNG Blob (or null in non-browser envs). */
export async function renderShareCard(
  input: ShareCardInput,
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  await ensureFontsReady();

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(SCALE, SCALE);
  drawCard(ctx, input);

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  { mode, date, results, totalScore, domain = 'hue.gg' }: ShareCardInput,
) {
  // Ground.
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Top-down radial wash, matching the live app body.
  const wash = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.7);
  wash.addColorStop(0, 'rgba(255,255,255,0.05)');
  wash.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  drawHeader(ctx, mode, date);
  drawPairBlocks(ctx, results);
  drawFooter(ctx, totalScore, domain);
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  mode: ShareMode,
  date: string | undefined,
) {
  // Left: hue. wordmark in Fraunces 500 with a dim period.
  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 44px ${FONT_SERIF}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.fg;
  const wordX = 64;
  const wordY = 80;
  ctx.fillText('hue', wordX, wordY);
  const wordW = ctx.measureText('hue').width;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('.', wordX + wordW + 1, wordY);

  // Right: mono meta — DAILY · MAY 16, with a quiet sub-line below.
  const rightX = W - 64;
  const line1 =
    mode === 'daily' && date
      ? `DAILY · ${formatDailyDate(date)}`
      : 'FREE PLAY';
  ctx.font = `500 13px ${FONT_MONO}`;
  ctx.fillStyle = COLORS.dim;
  ctx.textBaseline = 'top';
  drawSpacedTextRight(ctx, line1, rightX, 56, 2.6);

  ctx.fillStyle = COLORS.dimmer;
  ctx.font = `500 11px ${FONT_MONO}`;
  drawSpacedTextRight(ctx, 'A GAME OF COLOR MEMORY', rightX, 80, 2.4);
}

function drawPairBlocks(
  ctx: CanvasRenderingContext2D,
  results: RunRoundEntry[],
) {
  // Five tall paint-chip pair-blocks. Guess sits on top of target, with a
  // hairline-thin black gap between them — reads as a deliberate split,
  // not two unrelated squares. Score sits below in serif tabular.
  const count = results.length;
  const blockW = 140;
  const halfH = 142;
  const splitGap = 4; // bg shows through; reads as a hairline divider
  const blockH = halfH * 2 + splitGap;
  const blockGap = 28;
  const totalW = blockW * count + blockGap * (count - 1);
  const startX = (W - totalW) / 2;
  const topY = 134;
  const scoreY = topY + blockH + 38;
  const indexY = scoreY + 24;

  for (let i = 0; i < count; i++) {
    const r = results[i];
    const x = startX + i * (blockW + blockGap);

    // Guess (top half).
    drawColorTile(ctx, x, topY, blockW, halfH, r.guess, 'top');
    // Target (bottom half).
    drawColorTile(
      ctx,
      x,
      topY + halfH + splitGap,
      blockW,
      halfH,
      r.target,
      'bottom',
    );

    // Quiet "01 GUESS / TARGET" label inside the swatch? No — keep it pure.
    // The score below carries the data; the row reads top-to-bottom as
    // "what you picked" → "what it was".

    // Score in Fraunces, centered under the block.
    ctx.font = `500 22px ${FONT_SERIF}`;
    ctx.fillStyle = COLORS.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(r.score.toFixed(1), x + blockW / 2, scoreY);

    // Round index in mono, dim, tracked.
    ctx.font = `500 11px ${FONT_MONO}`;
    ctx.fillStyle = COLORS.dimmer;
    drawSpacedTextCentered(
      ctx,
      `0${i + 1}`,
      x + blockW / 2,
      indexY,
      2.4,
    );
  }
}

function drawColorTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hsb: HSB,
  half: 'top' | 'bottom',
) {
  // Rounded corners only on the outer edge of each half, so the pair reads
  // as one block. Top half: rounded top; bottom half: rounded bottom.
  const r = 10;
  ctx.fillStyle = hsbToHex(hsb.h, hsb.s, hsb.b);
  pathSemiRounded(ctx, x, y, w, h, r, half);
  ctx.fill();

  // Subtle inner border on the rounded edges only, for definition against
  // the bg. Kept very faint so it doesn't compete with the color.
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  pathSemiRounded(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r, half);
  ctx.stroke();
}

function pathSemiRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  half: 'top' | 'bottom',
) {
  ctx.beginPath();
  if (half === 'top') {
    // Rounded top, flat bottom.
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  } else {
    // Flat top, rounded bottom.
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  totalScore: number,
  domain: string,
) {
  // Left: BIG total score, the headline. Fraunces 500 ~104px, italic /50.
  const leftX = 64;
  const baselineY = H - 56;
  const totalText = totalScore.toFixed(1);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.fg;
  ctx.font = `500 104px ${FONT_SERIF}`;
  ctx.fillText(totalText, leftX, baselineY);
  const totalW = ctx.measureText(totalText).width;

  ctx.fillStyle = COLORS.dim;
  ctx.font = `italic 500 40px ${FONT_SERIF}`;
  ctx.fillText(`/${MAX_RUN_SCORE}`, leftX + totalW + 8, baselineY);

  // Tiny mono label tucked above the score, anchoring the "what is this".
  ctx.font = `500 11px ${FONT_MONO}`;
  ctx.fillStyle = COLORS.dimmer;
  ctx.textBaseline = 'alphabetic';
  drawSpacedTextLeft(ctx, 'TOTAL', leftX, baselineY - 102, 2.4);

  // Right: domain. The only call to action; the URL is enough.
  ctx.font = `500 13px ${FONT_MONO}`;
  ctx.fillStyle = COLORS.dim;
  drawSpacedTextRight(ctx, domain, W - 64, baselineY - 12, 2.4);
}

// --- mono letter-spacing helpers ---
// canvas doesn't honour letter-spacing, so we walk character-by-character.

function drawSpacedTextLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  leftX: number,
  yBaseline: number,
  spacing: number,
) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let cursor = leftX;
  for (const ch of text) {
    ctx.fillText(ch, cursor, yBaseline);
    cursor += ctx.measureText(ch).width + spacing;
  }
}

function drawSpacedTextRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  rightX: number,
  topY: number,
  spacing: number,
) {
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + spacing;
  total -= spacing;
  let cursor = rightX - total;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const ch of text) {
    ctx.fillText(ch, cursor, topY);
    cursor += ctx.measureText(ch).width + spacing;
  }
}

function drawSpacedTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  topY: number,
  spacing: number,
) {
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + spacing;
  total -= spacing;
  let cursor = centerX - total / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const ch of text) {
    ctx.fillText(ch, cursor, topY);
    cursor += ctx.measureText(ch).width + spacing;
  }
}
