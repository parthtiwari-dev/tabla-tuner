# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A tabla tuner for the web. Personal tool, one user, built from first principles.

It is **not** another chromatic tuner, and it is **not** a survey instrument.

The player has ten years of hammer skill. What he lacks alone is *perception*
of the error and *memory* of what the last few minutes of hammering did. The
app supplies exactly those two and stays quiet otherwise. It does not track
position, name ghars, teach scales, or say which way to hit — every one of
those was built, rejected by him, and deleted (D13, D16, D19, D21).

One page at `/`. If a change doesn't serve the two things above, it doesn't
belong.

## Read first

- `docs/RESEARCH.md` — the physics and the practitioner method. **Read this
  before touching any DSP or tuning-guidance code.** It contains non-obvious
  facts (the `Na` missing-fundamental trap, the harmonic series result, the
  safety limits) that will otherwise be silently violated.
- `docs/PRD.md` — what we're building and why, with scope boundaries.
- `docs/PLAN.md` — the build order.
- `docs/RULES.md` — engineering rules, especially the audio ones.
- `docs/DECISIONS.md` — decisions already made. Don't relitigate; append.

## The one idea that makes this work

`Na` — the only stroke anyone tunes with — has a suppressed fundamental and a
dominant 3rd harmonic, so naive detectors report a twelfth too high.

The guard is **structural, not corrective**: the search band is constrained so
the error cannot be expressed. A dayan lives roughly 150-400 Hz, so a
third-harmonic candidate at 780 Hz is not a value the function can return. Once
a target note is chosen the band narrows to +/-500 cents around it.

Never replace this with post-hoc octave correction. Making an error impossible
beats detecting and fixing it.

## Stack

- Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel
- **Entirely client-side.** No backend, no database, no auth, no accounts.
- Audio: Web Audio API + AudioWorklet. Pitch detection written by hand
  (McLeod Pitch Method), not a dependency — it's ~150 lines and we need to
  control the octave logic.
- Persistence: `localStorage` only.

## Working rules

- Keep it small. This is a personal tool, not a product. Resist frameworks,
  abstraction layers, and state managers until something actually hurts.
- Prefer plain functions over classes. The DSP is pure math — keep it pure and
  unit-testable, with no Web Audio types in the core algorithms.
- Every tuning instruction the app gives a human must be traceable to a source
  in `docs/RESEARCH.md`. We are telling someone to hit a real instrument with a
  real hammer. Do not invent guidance.
- Safety rails are not optional. See `docs/RULES.md`.

## Testing audio without a tabla

You will usually not have a drum available. Fixtures in
`src/lib/audio/__fixtures__/` generate synthetic strokes: a 1:2:3:4:5 harmonic
stack with per-partial exponential decay, plus a `Na`-like variant with the
fundamental attenuated 20 dB. **The detector must get both right** — the second
is the whole point.

## Conventions

- Indian terms in code use the transliterations in `docs/RESEARCH.md`
  (`ghar`, `gatta`, `gajra`, `syahi`, `dayan`, `bayan`, `pudi`, `hathori`).
  Don't anglicise them and don't invent new spellings.
- Pitch error is always in **cents**, never Hz, in anything user-facing.
- Western note letters only. No Kali/Safed, no octave numbers — the mapping
  survives in `cents.ts` but nothing renders it (D13).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
