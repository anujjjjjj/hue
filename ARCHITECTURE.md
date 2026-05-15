# Architecture

How Hue is put together. Read `CLAUDE.md` first for the product framing and the
decided-vs-open constraints.

## Overview

Hue is a single-page React app with no backend. One Zustand store holds all
game state; five phase components render based on `store.phase`; a 3D blob
(React Three Fiber) is the shared hero element across three of those phases.
All color conversion and scoring is pure functions in `src/lib/`.

A **run** is 5 rounds played in sequence. The round loop
(Memorize → Recall → Results) is unchanged from v1; a thin layer above it
tracks `roundIndex` and `results[]`, and decides whether "after Results" means
"next round" or "go to Summary".

```
App.tsx ── reads store.phase ── crossfades between ──┐
                                                     ▼
                          Intro → Memorize → Recall → Results ──┐
                                     ▲         │         │      │
                                     │         ▼         ▼      │
                                     │       <Blob>   <Blob>×2  │
                                     │      <Picker>            │
                                     │                          │
                                     └─ advanceRound (rounds 0-3)
                                                                │
                                          advanceRound (final) ─┴─▶ Summary
                                                                       │
                                                              Play again
                                                                       ▼
                                                              (fresh run, →
                                                              Memorize)
```

## State — `src/store/gameStore.ts`

A single Zustand store, wrapped in `persist`:

| field      | meaning                                                              |
|------------|----------------------------------------------------------------------|
| `phase`    | `'intro' \| 'memorize' \| 'recall' \| 'results' \| 'summary'`        |
| `target`   | the current round's `HSB` (mirrors `run.targets[run.roundIndex]`)    |
| `guess`    | the player's live `HSB` guess                                        |
| `result`   | `RoundResult` (ΔE, score, ΔH/ΔS/ΔB) — null until locked              |
| `run`      | `RunState` — `active`, `roundIndex`, `targets[]`, `results[]`, `totalScore` |
| `settings` | `shrinkStyle` + `shrinkDuration` — **the only persisted slice**      |

Actions:

- `begin()` — pre-generates the run's 5 targets via `generateRun()`, sets
  `roundIndex = 0`, and enters round 0's Memorize. Intro's button calls this.
- `setGuess()` — live picker writes.
- `lockGuess()` — scores the guess, pushes a `RunRoundEntry` to `run.results`,
  updates `run.totalScore`, routes to Results. Does **not** advance — the
  player still sees this round's Results until they hit "Next".
- `advanceRound()` — Results screen's CTA. Rounds 0–3: bumps `roundIndex` and
  enters Memorize for the next target. Final round: routes to Summary.
- `playAgain()` — drops straight into a fresh run (calls `begin()`). Summary's
  CTA. The friction to start another run is intentionally near zero.
- `updateSettings()` — patches the settings slice.

`advanceToRecall()` is a standalone setter the Memorize phase calls once the
blob has finished collapsing.

`partialize` ensures only `settings` is written to localStorage (`hue-v1` key) —
round and run state are ephemeral and must not survive a reload.

## Phase routing & crossfade — `App.tsx`

`App` keeps two slots, `current` and `previous`. When `store.phase` changes,
the old phase moves into `previous` and both render for `transitionMs` with
opposing opacity keyframes (`phaseIn` / `phaseOut`), then `previous` clears.
Nothing slides or bounces — opacity only. Each phase owns its own `<Canvas>`,
so at most two canvases are mounted briefly during a transition.

Standard `CROSSFADE_MS` is 560ms. The Results→Summary transition uses 720ms —
a beat longer to mark the shift from "a round" to "the whole run". Every other
transition stays at the standard duration.

## The color pipeline — `src/lib/color.ts`

One source of truth. Everything renderable or scoreable flows through here.

```
HSB ──hsbToRgb──▶ sRGB ──rgbToXyz──▶ XYZ ──xyzToLab──▶ Lab ──ciede2000──▶ ΔE
       │                                                          │
       └─▶ blob material color, SB pad pixels, hex strings         └─▶ scoring
```

- `hsbToRgb(h,s,b)` — the single color-conversion primitive. RGB in `[0,1]`.
- `rgbToXyz` / `xyzToLab` — standard sRGB linearization and D65 Lab conversion.
- `ciede2000(lab1, lab2)` — full CIEDE2000 (Sharma, Wu & Dalal 2005), including
  the hue-averaging and rotation-term edge cases. Verified in tests against
  published reference pairs.

`src/lib/scoring.ts` composes the pipeline: `scoreGuess(guess, target)` returns
`{ deltaE, score, dH, dS, dB }`. The ΔE→score map (`scoreFromDeltaE`) lives in
one place so it's tunable.

`src/lib/rng.ts` — `mulberry32` seedable PRNG, `generateTarget(seed?)`, and
`generateRun(seed?)`. Targets are biased toward memorable colors (S 45–95,
B 55–95). `generateRun` divides the hue wheel into `RUN_LENGTH` equal buckets,
samples one hue per bucket, then Fisher-Yates-shuffles the order with the same
RNG — so no run ever feels like "five blues" and seeded runs are deterministic.
Seedable from day one so Daily and Versus drop in cleanly.

## The run layer — `src/lib/run.ts` + the store

The run layer is deliberately thin and lives mostly in two places:

- `lib/run.ts` holds the constants: `RUN_LENGTH = 5`, `MAX_RUN_SCORE = 50`,
  and `verdictFor(score)` mapping the 0–10 round score to one of
  `EXACT / NEAR / CLOSE / WARM / OFF`. The bands' lower bounds are inclusive
  (9.0, 7.5, 6.0, 4.0). Tune here, not in the Summary component.
- The store's `run: RunState` accumulates `RunRoundEntry` records as each
  round locks. The Summary screen reads from this; the Nav reads `roundIndex`
  for the `ROUND 0X · OF 05` indicator.

The round components (Memorize, Recall, Results) barely changed: they still
read `target` / `guess` / `result` from the top of the store. The Results
button just switches label and calls `advanceRound()` instead of
`playAgain()`. The run wraps the existing loop; it doesn't replace it.

## The blob — `src/components/blob/Blob.tsx`

`<Blob color shrink? onCollapseComplete? />` renders a `<Canvas>` containing the
lighting rig and `<BlobMesh>`.

- **Geometry:** `IcosahedronGeometry(1.4, 48)`, built once via `useMemo`,
  disposed on unmount. Original vertex positions are cached so the deformation
  is recomputed fresh each frame rather than accumulating.
- **Deformation:** in a single `useFrame` loop, each vertex is displaced along
  its normal (= normalized position, for an origin-centered icosphere) by a 3D
  sine-noise function; normals are recomputed after. The blob also slowly
  rotates.
- **Material:** `MeshPhysicalMaterial` with clearcoat for the glossy finish.
  `clearcoat` / `roughness` are driven per-frame by the shrink style.
- **Lighting:** key (white directional), fill (warm directional), ambient —
  identical in every phase by design.
- **Shrink:** when a `shrink` prop is passed, `lib/shrink.ts` provides the
  non-linear `easeShrink` curve, `shrinkScale`, and `surfaceParams` for the
  three styles (`scale` / `densify` / `calm`).
- **Collapse:** when `shrink.progress` reaches 1, `Blob` runs a fixed timeline —
  the mesh scales to a point (ease-in), a soft radial white flash blooms and
  fades (DOM element over the canvas), a held beat passes, then
  `onCollapseComplete` fires exactly once (guarded by a ref).

`lib/shrink.ts` holds all shrink/collapse constants and curves so the surface
behaviour can be tuned without touching the component.

## The picker — `src/components/picker/`

The picker is a hue ring + an SB pad + a numeric readout, all reflecting and
controlling **one shared `HSB` value** owned by the consuming phase.

- **`pickerMath.ts`** — all picker geometry as pure functions: pad coord ⇄ SB,
  `padPixelRGB` (the exact color shown at a pad coordinate, via `hsbToRgb`),
  and hue-angle ⇄ point math (0° at top, clockwise). Centralizing this is what
  prevents the picker's *visual* from drifting away from its *value* — the bug
  the previous prototype shipped.
- **`SBPad.tsx`** — renders the pad on a `<canvas>` by computing the actual
  `padPixelRGB` for each cell of a coarse grid, then scaling up. Never CSS
  gradients. Re-renders when hue changes.
- **`HueRing.tsx`** — a conic-gradient ring masked to a band; thumb positioned
  via `hueToPoint`.
- **`useDrag.ts`** — shared pointer-drag handling (mouse/touch/pen) using
  Pointer Events + pointer capture, so a drag survives the pointer leaving the
  element. `touch-action: none` on the controls.
- **`ColorPicker.tsx`** — composes the three, exposes `value` / `onChange`.
  Structured so alternate input modes (sliders, 3D cylinder) can be swapped in
  for difficulty levels later without touching the phases.

The **picker-sync invariant**: `padPixelRGB` and the scorer both call
`hsbToRgb`, and the thumb maps `S→x, B→y` via the same `pickerMath` functions.
`pickerMath.test.ts` asserts this and is the regression guard.

## The Summary screen — `src/components/phases/Summary.tsx`

The considered finish of a run. Layout, top-down:

- `RUN COMPLETE` mono tag.
- Big Fraunces total (`shownTotal.toFixed(1)`) with `/50` in dim italic. Counts
  up from 0 over 1400ms ease-out-cubic — same shape as the Results count-up,
  longer because this is the bigger moment.
- Vertical stack of `RUN_LENGTH` rows, max-width 440px, hairline `line`
  dividers. Each row: padded round number (mono dimmer) · two color swatches
  (guess then target, `hsbToHex`-backed) · serif score · mono verdict word.
  Rows fade-in on an 80ms stagger via the `summaryRowIn` keyframe.
- CTA row: `Play again` (calls `playAgain` → fresh run via `begin`). A code
  comment marks the slot where the Share button will land (Build Spec 03) so
  adding it doesn't re-lay-out the screen.

No badges, grades, or confetti — the dry verdict words carry all the
evaluative voice.

## Design system — `tailwind.config.js` + `src/styles/globals.css`

Color tokens (`bg`, `fg`, `dim`, `citron`, `good`, `warn`, `danger`, …) and the
three font families are configured in Tailwind. `globals.css` carries the
non-component pieces: the fixed full-viewport SVG-noise grain overlay (2.5%
opacity, above everything, pointer-events none), the background radial wash,
and the phase crossfade keyframes. UI primitives (`Button`, `MonoLabel`,
`Logo`) keep the editorial language consistent.
