# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A tabla tuner for the web. Personal tool, one user, built from first principles.

It is **not** another chromatic tuner. Its reason to exist is the *evenness*
problem: a tabla dayan can be perfectly on-pitch at one point on the rim and
noticeably off at another, and no existing tool measures that. This app surveys
all 16 ghars around the crown, maps which are flat and which are sharp, and
tells you where to hit.

If a change doesn't serve that, question whether it belongs.

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

Absolute pitch detection on a `Na` stroke is unreliable — `Na` has a suppressed
fundamental and a dominant 3rd harmonic, so naive detectors report the wrong
octave. But **evenness is a relative measurement**. We anchor the absolute
pitch once from a `Tun` stroke (which has a real fundamental), then compare
`Na` strokes *to each other* across the 16 positions. Like-for-like comparison
makes the harmonic ambiguity cancel.

Never let a change break this separation. Absolute readings come from `Tun`.
Relative readings come from `Na`, band-constrained around the anchor.

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

You will usually not have a drum available. Generate synthetic test signals —
a harmonic stack at a known f0 with the 1:2:3:4:5 ratios and an exponential
decay, plus a "Na-like" variant with the fundamental attenuated 20 dB. The
detector must return the correct f0 for both. Fixtures live in
`src/lib/audio/__fixtures__/`.

Real recordings, once we have them, go in `docs/samples/` with a README noting
the drum, the ghar, and the measured pitch.

## Conventions

- Indian terms in code use the transliterations in `docs/RESEARCH.md`
  (`ghar`, `gatta`, `gajra`, `syahi`, `dayan`, `bayan`, `pudi`, `hathori`).
  Don't anglicise them and don't invent new spellings.
- Ghars are numbered **1–16**, one-indexed, matching how a player counts them.
  Convert to zero-indexed only at array boundaries and comment where you do.
- Pitch error is always in **cents**, never Hz, in anything user-facing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
