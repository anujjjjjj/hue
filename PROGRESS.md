# Progress

Build history and current status. See `CLAUDE.md` for project framing and
`ARCHITECTURE.md` for how it fits together.

## Status: Build Spec 02 (runs + Summary) implemented, browser QA outstanding

v1 (single-round loop) shipped. Build Spec 02 layered 5-round runs and the
Summary screen on top. Both build clean and the test suite passes. Neither
the single-round loop's original browser pass nor the new run-layer UI have
been verified in a real browser or on mobile — that remains the gate before
either can be called done (see Outstanding below).

| check                      | status                          |
|----------------------------|---------------------------------|
| `npm run build`            | passes (clean tsc -b + vite)    |
| `npm test`                 | 50 tests pass across 4 files    |
| `npm run dev`              | runs                            |
| Browser / mobile playtest  | **not done** — no browser in env |

---

## Session 1 — 2026-05-14 → 2026-05-15

Scaffolded the project from an empty directory and built the entire v1 game
loop, following the build order in the design spec.

### 1. Scaffold

Vite + React 18 + TypeScript (strict) + Tailwind. Design tokens (colors, three
font families, the hover-lift shadow) in `tailwind.config.js`. Google Fonts
(Fraunces / Inter Tight / JetBrains Mono) loaded in `index.html`. `globals.css`
carries the 2.5% SVG-noise grain overlay, the background radial wash, and the
phase crossfade keyframes. `hue.` wordmark + settings gear in the nav.

### 2. Color lib + tests

`src/lib/`:
- `color.ts` — `hsbToRgb`, `rgbToXyz`, `xyzToLab`, full `ciede2000`.
- `rng.ts` — `mulberry32` seeded PRNG, `hashSeed`, `generateTarget` (seedable).
- `scoring.ts` — `scoreGuess`, `scoreFromDeltaE`, `hueDelta`.

Tests (`color.test.ts`, `rng.test.ts`): `hsbToRgb` against known values;
`ciede2000` against 8 published Sharma, Wu & Dalal (2005) reference pairs plus
symmetry/identity; seeded-RNG determinism and target range.
*Note:* two CIEDE2000 reference values were initially mis-transcribed in the
test — the algorithm was correct; the expected values were fixed.

### 3. The Blob component

`components/blob/Blob.tsx` — reusable `<Blob>`: detail-48 icosphere,
`MeshPhysicalMaterial` gem finish, per-frame sine-noise vertex deformation in a
single `useFrame` loop, slow rotation, the fixed 3-light rig. `dpr` capped at
2; geometry disposed on unmount; original vertex positions cached so
deformation doesn't accumulate.

### 4. Shrink + collapse

`lib/shrink.ts` — the non-linear `easeShrink` curve, `shrinkScale`, and
`surfaceParams` for all three styles (`scale` / `densify` / `calm`), plus
collapse constants. `Blob` gained the `shrink` prop and the collapse timeline:
scale-to-a-point (ease-in) + a soft radial white flash (DOM element over the
canvas) + a held beat, then `onCollapseComplete` fires once (ref-guarded).

### 5. Store + phase routing

`store/gameStore.ts` — Zustand store (`phase`, `target`, `guess`, `result`,
`settings`) with `persist` + `partialize` so only `settings` hits localStorage.
`App.tsx` — two-slot opacity crossfade (560ms) between the four phases.

### 6. Memorize phase

`components/phases/Memorize.tsx` — random target via `generateTarget()`, blob
at `min(74vw,74vh)`, "Memorize" mono tag, one-decimal countdown readout that
turns `danger` red in the final 2s. An rAF loop drives `shrink.progress` over
`settings.shrinkDuration`; `onCollapseComplete` → `advanceToRecall()`.

### 7. Color picker

`components/picker/` — `pickerMath.ts` (all picker geometry as pure functions),
`SBPad.tsx` (canvas-rendered from `padPixelRGB` — never CSS gradients),
`HueRing.tsx` (masked conic gradient, 0° at top, clockwise), `useDrag.ts`
(Pointer Events + capture for mouse/touch), `ColorPicker.tsx` (composes all
three + numeric readout). `pickerMath.test.ts` asserts the picker-sync
invariant — the regression guard for the previous prototype's bug.

### 8. Recall phase

`components/phases/Recall.tsx` — live guess blob at `min(48vh,52vw)`,
`<ColorPicker>` bound to `store.guess`, "Lock it in" button. Untimed in v1 but
laid out so a timer could be added without restructuring.

### 9. Results phase

`components/phases/Results.tsx` — guess + target blobs side by side with mono
labels, "Perceptual distance · CIEDE2000" sub-label, big Fraunces score that
counts up 0→final over ~1100ms (ease-out cubic), and the ΔH/ΔS/ΔB/ΔE row.
"Play again" → intro.

### 10. Settings

`components/ui/Settings.tsx` — gear-icon panel for shrink style + shrink
duration (3–12s), persisted to localStorage via the store.

---

## Session 2 — 2026-05-15 — Build Spec 02 (runs + Summary)

Layered a 5-round run on top of the existing v1 round loop and added a Summary
screen. The round components (Memorize, Recall, Results) were left
structurally intact — the run wraps them rather than replacing them. Single-
round mode was dropped per the spec's "use judgment" clause: the run is the
game now.

### 1. Run constants + verdict mapping

`src/lib/run.ts` — `RUN_LENGTH = 5`, `MAX_RUN_SCORE = 50`, and `verdictFor`
mapping a 0–10 round score to `EXACT / NEAR / CLOSE / WARM / OFF` with
inclusive lower bounds at 9.0 / 7.5 / 6.0 / 4.0. Tunable in one place.

### 2. `generateRun()`

`src/lib/rng.ts` — `generateRun(seed?)` returns 5 HSB colors. Hue spread is
enforced by carving the wheel into `RUN_LENGTH` equal buckets, sampling one
hue per bucket, then Fisher-Yates-shuffling with the same RNG. Sat/brightness
reuse the gameable bias from `generateTarget`. Seed-ready (number or date
string) so Daily and Versus drop in without restructuring.

### 3. Store: run state

`src/store/gameStore.ts` — new `RunState` (`active`, `roundIndex`, `targets[]`,
`results[]`, `totalScore`) and a new `summary` phase.

- `begin()` now starts a run: pre-generates the 5 targets, enters round 0's
  Memorize.
- `lockGuess()` keeps its name (so Recall.tsx didn't change) but its semantics
  are now commitRound — scores, pushes a `RunRoundEntry`, updates
  `totalScore`, routes to Results without advancing.
- `advanceRound()` (new) is the Results CTA: bumps `roundIndex` and re-enters
  Memorize for rounds 0–3; routes to Summary on the final round.
- `playAgain()` (from Summary) calls `begin()` — straight into a fresh run.

The top-level `target` / `guess` / `result` fields stay so the round
components didn't need rewiring; they're updated as part of the run actions.

### 4. Round indicator + Results button states

`src/components/ui/Nav.tsx` — quiet `ROUND 0X · OF 05` mono label, shown
only during Memorize / Recall / Results.

`src/components/phases/Results.tsx` — button reads "Next round" for rounds
0–3, "See results" on the final round; both call `advanceRound()`. Optional
mono line below the deltas: `RUN TOTAL · X / Y SO FAR`.

### 5. Summary phase

`src/components/phases/Summary.tsx` — `RUN COMPLETE` tag, big serif total
with `/50` italic, 1400ms ease-out-cubic count-up. Vertical stack of 5
guess-vs-target rows (max-width 440px) with hairline dividers, 80ms staggered
fade-in via the `summaryRowIn` keyframe. `Play again` CTA, with a marked code
comment slot for the future Share button (Build Spec 03) so adding it
doesn't re-lay-out the screen.

`src/App.tsx` — Summary registered in the phase switch. Results→Summary
crossfade is 720ms (a beat longer than the standard 560ms) to mark the shift
from "a round" to "the whole run".

### 6. Tests

`src/lib/rng.test.ts` (extended) — `generateRun` determinism under a fixed
seed, determinism under a date string, divergence on different seeds, range
invariants across 50 seeds, and the hue-spread rule (all 5 buckets covered).

`src/lib/run.test.ts` (new) — verdict boundary mapping at 9.0 / 7.5 / 6.0 /
4.0, run-total accumulation arithmetic, constant invariants.

Suite: 50 tests across 4 files; `npm run build` clean.

---

## Outstanding

- **Browser + mobile playtest** — still the gate. v1's round loop wasn't
  verified in-browser either; Build Spec 02 adds the round indicator, Results
  button-state flip, the Summary screen layout / mobile row stacking, and the
  total count-up timing on top. All need a real device pass. Per CLAUDE.md
  guidance, UI claims aren't verified until they're seen.
- **Performance sanity check** in-browser: detail-48 geometry with per-frame
  `computeVertexNormals` is heavy — confirm it holds 60fps, especially with
  two blobs mounted on Results / during a crossfade. Drop geometry detail
  if not.
- Bundle is ~987 kB (mostly Three.js). Fine for now; code-split later if
  needed.
- **Persisting past runs.** Not done. If cheap, adding a localStorage array
  of past run summaries would make stats / streak / history trivial later.
  Deliberately deferred.

## Roadmap

- **Build Spec 03 — Share card** (next). The Summary screen is its capture
  target; the CTA row already has the marked slot.
- **Daily mode.** `startRun(dateSeed)` plus once-per-day localStorage gating;
  `generateRun` being seed-ready is the groundwork.
- **Versus.** URL-encoded seed; also rides on seeded `generateRun`.
- **Stats / streak / history.** Would read from accumulated run results in
  localStorage (see Outstanding above).
- Recall-phase timer · difficulty-linked picker modes (sliders, 3D cylinder)
  · sound design.
