# Decision Log

Append-only. Newest at the bottom. If a decision is reversed, add a new entry
that says so rather than editing the old one.

---

## D1 — Build it at all
**2026-09-01 · Decided: yes**

Feasibility rested on whether a drum can be pitch-tracked at all. Established
that the tabla dayan is one of the few genuinely harmonic drums (Raman 1920,
1:2:3:4:5, caused by the syahi's mass-loading), so standard pitch detection
applies. Measurement resolution ~±2 cents against 10–50 cents of real-world
unevenness. See `RESEARCH.md` §3 and §6.

---

## D2 — The product is the *evenness survey*, not a tuner
**2026-09-01**

Chromatic tuners already exist, including one tabla-specific app. None of them —
and none of the practitioner guides — address circumferential evenness, which is
the actual stated problem. Every guide says "tune it evenly all around" and none
says how to check. That gap is the reason to build.

---

## D3 — Absolute from `Tun`, relative from `Na`
**2026-09-01 · Architectural, load-bearing**

`Na` has a suppressed fundamental and a dominant 3rd harmonic (Courtney); naive
detectors report a twelfth too high. But `Na` is also the stroke that reveals
local tension variation, so we can't avoid it.

Resolution: anchor absolute pitch once from `Tun` (real fundamental), then use
`Na` only for *relative* comparison between ghars, band-constrained around the
anchor. Like-for-like comparison cancels the harmonic ambiguity.

**This is the idea the project rests on. Don't refactor it away.**

---

## D4 — Fully responsive, phone and laptop both
**2026-09-01 · User decision**

Considered phone-only for the floor-sitting use case. Chose both as first-class.
Costs some UI work; keeps the tool usable in either setting.

---

## D5 — Auto-advance on detected strike
**2026-09-01 · User decision**

Both hands are occupied — hammer in one, drum steadied by the other. Tapping the
screen 16 times per pass is the wrong interaction. The onset detector is
required anyway, so auto-advance is nearly free.

Accepted risk: mis-triggering on stray noise. Mitigated by a confidence gate and
a mandatory undo (RULES D2).

---

## D6 — v1 includes the scale-teaching module
**2026-09-01 · User decision**

Considered deferring it. Included because "which scale should I even tune to"
is part of the original problem — the taleem stopped before it. Kept contextual
and small rather than a documentation dump (PRD §6).

---

## D7 — Evenness first, then pull to scale
**2026-09-01 · User decision, and physically correct**

Chasing an absolute note on an unevenly tensioned head fights itself — the pitch
you read depends on where you struck. Even the head first at whatever pitch it
naturally sits, then move the whole drum with the gattas, then re-check evenness
because coarse tuning disturbs it.

---

## D8 — Traditional drum assumed
**2026-09-01 · User-confirmed, then photo-confirmed**

Leather lace, 8 wooden gattas, 16-hole gajra, proper hathori available. All
guidance targets this. Bolt-tuned tablas would need a different model and are
out of scope.

**Confirmed by photograph 2026-09-01.** Rawhide lace, wooden gattas, braided
gajra, compound pudi with a visible maidan/chanti boundary. Also: the lace
holes are already marked on the head with small teal dots, so ghar positions
need no new marking — only agreement on which one is ghar 1. See
`INSTRUMENT.md`.

---

## D9 — Stack: Next.js on Vercel, entirely client-side
**2026-09-01**

Next.js + TypeScript + Tailwind on Vercel. No backend, no database, no auth;
`localStorage` only. Vite would be marginally lighter for a pure client-side
audio app, but Next.js on Vercel is the zero-friction path and leaves room if a
share link is ever wanted. Not a decision worth agonising over — reversible.

---

## D10 — Hand-write the pitch detection
**2026-09-01**

Rather than `pitchfinder` or similar. It's ~150 lines of McLeod Pitch Method,
and the part libraries get wrong on tabla is exactly the octave logic we most
need to control (D3, RULES B2). Keeping it in-house also keeps the DSP pure and
unit-testable without a drum in the room.

---

## D11 — Bayan out of scope for v1
**2026-09-01**

The bayan is acoustically inharmonic and deliberately pitch-bent by heel
pressure during play. Genuinely harder, and not part of the stated problem.
Revisit only after the dayan work is finished and proven.

---

## D12 — The `Na` vs `Tun` comparison ships as a stated feature
**2026-09-01**

The anchor step already reads `Tun`; the survey already reads `Na`. Comparing
the two costs no extra measurement and surfaces a real diagnosis: a persistent
mismatch indicates a syahi-to-edge thickness problem, i.e. the instrument
rather than the tuning (RESEARCH §3). Prompted by visible syahi crazing on the
actual drum — see `INSTRUMENT.md`. Reported as a *hint*, never a diagnosis
(PRD §7, RULES C5).

---

## Open questions

- **Dayan diameter** — photo estimate **~5.0–5.3"**, working assumption 5.25".
  Straddles the D–D# / C–C# boundary, so it needs a flat, centred measurement
  of the playing surface. Blocks the safe-range table in M4 only, and M1's
  measured pitch will largely settle it regardless. See `INSTRUMENT.md`.
- **Ghar and gatta count** — assumed 16 and 8; photos consistent with this but
  not countable with confidence. Confirm by eye.
- **Syahi integrity** — surface crazing visible. Probably cosmetic; needs the
  three-step check in `INSTRUMENT.md`. If the syahi is delaminating, the drum
  is not tunable by anyone and this becomes a repair, not a software problem.
- **Tolerance threshold** — what spread counts as "even enough"? Provisionally
  10 cents. Should be calibrated against your own ear during M2, not guessed.
