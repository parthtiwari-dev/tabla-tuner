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

## D13 — Na only. No Tun phase, no scale theory in the flow
**2026-09-01 · User correction. Supersedes parts of D3, D6 and all of D12.**

The player's objection, verbatim: *"whenever I have seen someone play tabla or
tune it, they only check the kenar. The na sound is what gets tuned. If the na
sound from all the sides is equal, the middle portion, the syahi, would always
be in tune... there is so much naming. I just want a simple place wherein if I
play the na sound on all the 16 ghars, I should be able to do something with
it."*

**The sources agree with him, including ones already in RESEARCH.md.** The
tuning sequence documentation: *"practitioners play a strong 'na' on the chaati
after tuning each ghar, rotating the tabla and repeating after every ghar."*
Courtney's stated reason for preferring `Na` over `Tun` for tuning: it reveals
localized tension variation around the perimeter. `Tun` is a diagnostic of
overall resonance, not a step in the tuning loop.

The `Tun` anchor phase was designed around a DSP worry, not around practice.

### Why it was never needed

For evenness the harmonic ambiguity cancels exactly. If the detector locks onto
the 3rd partial at ghar 4 *and* at ghar 12:

    1200 * log2(3*f12 / 3*f4)  ==  1200 * log2(f12 / f4)

The factor of 3 divides out identically. Locking onto the "wrong" partial costs
nothing **provided it is the same wrong partial each time** — which is achieved
by anchoring the search band on the first `Na` strike of the pass. No separate
stroke, no separate phase.

### Consequences

- The anchor phase, the `Tun` stroke and the mode switch are **removed**.
- Absolute pitch still falls out of `Na` for free (the 150-400 Hz band already
  resolves it; tests confirm this down to a -34 dB fundamental). It is a
  *display* choice now, not an architectural one.
- **D12 is withdrawn.** The Na/Tun syahi hint required a stroke we no longer
  ask for. A drum whose spread refuses to come down across passes is a similar
  signal and costs nothing, so that replaces it.
- Kali/Safed naming is **out of the interface**. The mapping stays in
  `cents.ts` — it is harmless and may be wanted later — but nothing renders it.
- The scale-teaching module (D6) is **cut from v1**.

### What the player still wants

Guidance was never the problem. Asked how far the app should go, he chose the
**full guided loop** — measure, show, correct, re-measure, until even. The
objection was to ceremony *before being allowed to start*, not to help.

---

## D14 — The drum rotates; the striking hand stays put
**2026-09-01 · User-confirmed**

Positions are reached by turning the tabla under a fixed striking hand, not by
reaching around a stationary drum. Matches the sources ("rotating the tabla and
repeating after every ghar") and matches how the original problem was
described — *"if I rotate it the sound isn't the same."*

Consequences:

- The instruction between readings is **"turn one ghar"**, never a position name.
- The app counts strikes and infers position; it cannot see the drum. Losing
  your place is therefore possible, so an undo and a restart-pass are required.
- One physical reference mark is needed to know where a pass began. The teal
  dots already on the head (INSTRUMENT.md) serve; only "which one is first"
  needs deciding.
- Striking consistency is *better* under this model than reaching around, since
  hand position and angle stay constant. Good for measurement noise.

---

## D15 — Sixteen positions, not four
**2026-09-01**

Prior art found late: `aituning.netlify.app` (Nov 2025, by a 15-year player) is
a browser tabla tuner that does include a tension map — but at **four**
positions (12-3-6-9), behind a required raga-and-Sa selection screen, using FFT
peak-picking with hand-written harmonic correction.

It narrows the gap without closing it. Sixteen ghars, `na` only, no theory
gate, and NSDF rather than peak-picking remains unbuilt by anyone.

---

## D16 — The app does not track which ghar you are on
**2026-09-01 · User correction. Supersedes the survey model in D13/D14.**

*"It doesn't need to identify each ghar, all those 16 ghars, how each one of
them sounds."*

The survey framing — walk sixteen labelled positions, build a map, then act on
it — was mine, not the practice. You are looking at the drum. You know where
your hand is. The app never needs to.

**What this deletes:**

- Ghar numbering and the ghar-1 reference mark
- Position tracking, strike counting, "turn one ghar" prompts
- The count-and-infer failure mode, and the undo / restart-pass it required
- The polar ring diagram with labelled spokes
- The whole notion of a "pass" as a discrete unit

**What remains** is a live readout. Strike `Na` → one number, how far off and
which way → hammer → strike again → rotate when satisfied. The app is a
continuously available reference, not a survey instrument.

### Seeing evenness without position identity

Evenness still has to be visible, or the tool loses its point. Solution: a
**rolling trail of the last ~16 readings, unlabelled**. Scatter means uneven; a
tight cluster on the target means tuned. You get the objective picture without
the app ever knowing which spot produced which mark.

---

## D17 — Gatta position is the headroom indicator, and it gates everything
**2026-09-01 · User insight, source-confirmed**

*"It depends on how tightly the 8 blocks are attached to it. If they are very
far low then the tabla can't be pitched to a higher note."*

The 8 gattas ride on the lace between the rims. Driving them **down** shortens
the lace path, raises tension, raises pitch. Their current position is therefore
a direct, visible readout of **how much tuning range is left**:

- Blocks sitting **high** → plenty of travel, room to tighten
- Blocks already **near the bottom** → at the ceiling. The drum cannot go
  higher. Hammering to force it risks splitting the head.

Source confirmation: a head tunes roughly 1–2 scales either side of its design
range, and *"lacing that has stretched beyond tuning range needs replacement by
a craftsman."* Out of travel is a **re-lace job, not a tuning job** — no
software helps.

**Consequences:**

- A **headroom check comes before anything else.** If the target is above what
  the blocks allow, the app must say so and stop, not offer guidance.
- This is a better safety rail than the diameter table (RULES C1), because it
  reflects the drum's actual present state rather than a generic size prior.
  The diameter table stays as a coarse sanity bound.
- Worth capturing the block position at the start of a session.

---

## D18 — Reference tone optional; measurement is the truth
**2026-09-01 · User decision**

A drone at the target is available but off by default, and the app does not ask
the ear to arbitrate its numbers.

Accepted cost, stated plainly: on a drum with stretched partials the absolute
reading may sit up to ~20 cents from what the ear calls in tune (see the
inharmonicity tests in `mpm.test.ts`). Relative accuracy is unaffected at under
3 cents, so *evenness* remains exact; only the absolute target may be biased.
Revisit if that bias proves audible in practice.

Target note is set **either** by the app suggesting from the drum's current
pitch **or** by picking from a list of twelve. Octave is inferred from the drum
and never asked about.

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

---

## D19 — Continuous listening. No buttons, no hammer instructions
**2026-09-01 · User correction**

*"The app should keep detecting audio... if it's pitched high or low, then it
shouldn't tell me to hit the hammer which way because I know it. And I know
that my hammer sound would actually be recorded by the app... so this isn't
really a problem for me."*

Two changes, one of which turned a problem into a feature.

**No direction advice.** Ten years of playing; he knows which way to hit and
how. Telling him is noise. The app shows the number and stays quiet.

**Hammer blows in the microphone are the calibration mechanism, not
interference.** The previous design had tap-count buttons, which need a free
hand he does not have. Since the mic hears the hammer anyway, the app counts
blows itself:

    na(-20c) -> tap -> tap -> na(-6c)   =>  2 taps moved it 14 cents

Discriminator is NSDF **clarity**: a `na` is a tonal stroke on a harmonic
membrane and scores high; a hammer blow on the braided gajra is a short hard
click with no clean periodic decay and scores low. Threshold is a setting
(`naClarity`, default 0.78) and the live classification is displayed, because
it is a heuristic and a visible heuristic is one he can adjust.

Stakes are deliberately low: a mis-sorted onset costs a slightly wrong
cents-per-tap figure, which is informational only. Nothing acts on it.

**How the drum actually gets tuned**, which was his question: he already has
the hammer skill. What he lacks is *perception* of the error and *memory* of
what the last few minutes did. The app supplies exactly those two and nothing
else.
