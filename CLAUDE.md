# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Hue** — a color memory game. A 3D blob appears in a target color and shrinks
over a few seconds, then collapses and vanishes. The player recreates the color
from memory with a color picker and is scored on perceptual (CIEDE2000)
accuracy. Five rounds make a **run**; a Summary screen totals the run out of
50 and gives each round a one-word verdict.

It must read as a **premium editorial product** — closer to a magazine or a
fine piece of software than a casual mobile game. No badges, no confetti, no XP
bars. Voice is calm, dry, slightly literary.

## Commands

```bash
npm install        # install deps (pnpm not available in this env; npm is)
npm run dev        # Vite dev server
npm run build      # tsc -b + vite build
npm run preview    # preview the production build
npm test           # vitest run (one-shot)
npm run test:watch # vitest watch mode
```

## Tech stack

Vite · React 18 · TypeScript (strict) · Three.js via @react-three/fiber +
@react-three/drei · Zustand (with `persist` for settings) · Tailwind CSS ·
Vitest. No backend — state is localStorage only. Target: static deploy.

## Project layout

```
src/
  components/
    blob/    Blob.tsx — the hero 3D element + shrink/collapse
    picker/  HueRing, SBPad, ColorPicker, pickerMath, useDrag
    phases/  Intro, Memorize, Recall, Results, Summary
    ui/      Button, MonoLabel, Logo, Nav, Settings
  store/     gameStore.ts — Zustand store, phases, run state, settings
  lib/       color.ts (HSB/Lab/CIEDE2000), rng.ts, scoring.ts, shrink.ts,
             run.ts (run length + verdict mapping), brand.ts
  styles/    globals.css (grain overlay, crossfade, base)
  App.tsx    phase routing + crossfade
```

See `ARCHITECTURE.md` for how the pieces fit together and `PROGRESS.md` for
build history and what's outstanding.

## Conventions

- **Strict TypeScript.** `noUnusedLocals` / `noUnusedParameters` are on.
- **Centralize tunable values.** Scoring map (`scoring.ts`), shrink curve and
  surface params (`shrink.ts`), brand strings (`brand.ts`), picker geometry
  (`pickerMath.ts`), run length + verdict thresholds (`run.ts`). Don't scatter
  magic numbers.
- **Color math has one source of truth:** `hsbToRgb` in `lib/color.ts`. The
  blob, the SB pad, and scoring all go through it. Never re-derive color
  conversion inline.
- **Tailwind first**, plain CSS only where Tailwind is awkward.
- Comments explain *why*, not *what*. Default to none.

## Decided — do not redesign

These came out of an extended design exploration. Build them correctly; do not
substitute your own choices:

- The blob: IcosahedronGeometry (radius 1.4, detail 48), `MeshPhysicalMaterial`
  (the glossy "gem" finish), per-frame sine-noise vertex displacement. Lighting
  is identical across every phase — it must never trick the player about color.
- Shrink **is** the memorize timer. The disappear is collapse-to-a-point + a
  soft white light flash + a ~150ms held beat, then transition.
- Editorial visual language: near-black/near-white, Fraunces + Inter Tight +
  JetBrains Mono, the 2.5% grain overlay (non-negotiable texture). Accent
  colors are metadata only — the only loud color on screen is the game's color.
- CIEDE2000 perceptual scoring; `score = max(0, 10 - dE/3)`.
- Picker is hue ring + canvas-rendered SB pad for v1. The pad is canvas-correct
  (computed via `hsbToRgb`), never eyeballed with CSS gradients.
- Recall is untimed in v1.
- **Run structure:** a run is `RUN_LENGTH = 5` rounds played in sequence,
  totalled out of 50. The run wraps the existing round loop — blob, shrink,
  picker, scoring untouched. `generateRun(seed?)` enforces hue spread (one
  hue per equal bucket of the wheel) and is seed-ready so Daily and Versus
  drop in cleanly.
- **Summary screen:** vertical stack of 5 guess-vs-target rows, animated total
  count-up, one-word verdicts on the fixed scale (EXACT ≥ 9.0 · NEAR ≥ 7.5 ·
  CLOSE ≥ 6.0 · WARM ≥ 4.0 · OFF). No badges, no grades, no confetti. "Play
  again" goes straight into a fresh run. The CTA row leaves a marked slot for
  the future Share button (Build Spec 03).

## Open — keep flexible, don't solve yet

Recall-phase timer · final shrink style (`densify` is the default, may change
after playtest) · share card (Summary screen is its capture target) · Daily
mode (RNG and `generateRun` are already seedable) · Versus (URL-encoded seed) ·
stats / streak / history · difficulty-linked picker modes · sound. Run length
(5) and verdict thresholds may be tuned after playtest — both live as named
constants in `lib/run.ts`. Build so these can slot in without restructuring.

## Testing

Vitest, Node environment, `src/**/*.test.ts`. The non-negotiable coverage:

- `hsbToRgb` against known values.
- `ciede2000` against published Sharma, Wu & Dalal (2005) reference pairs —
  this algorithm must be verified, not eyeballed.
- **Picker sync** (`pickerMath.test.ts`) — the color the SB pad *shows* at a
  coordinate must equal the color produced by feeding that coordinate's HSB to
  the same `hsbToRgb` used for scoring. This is the regression test for a real
  bug in the previous prototype; do not let it rot.
- Seeded RNG determinism — including `generateRun(seed)` returning identical
  5-color runs (the guarantee Daily mode depends on).
- `generateRun` hue-spread invariant — every run covers all 5 hue buckets.
- Verdict boundary mapping (`run.test.ts`) — scores at 9.0 / 7.5 / 6.0 / 4.0
  land on the expected side of the EXACT/NEAR/CLOSE/WARM/OFF scale.

Run `npm test` before considering color/picker/scoring work done.
