# Engineering Rules

Non-negotiables. If a rule here blocks something you want to do, change the rule
deliberately and write down why in `DECISIONS.md` — don't route around it.

---

## A. Audio capture

**A1. Disable all browser audio processing.** Non-negotiable and easy to get
wrong, because the defaults are all `true`:

```ts
getUserMedia({ audio: {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl:  false,
}})
```

Echo cancellation and noise suppression are tuned for speech and will mangle a
percussive transient. Auto gain will fight the decay envelope we measure. If
pitch readings are inexplicably unstable, **check this first.**

**A2. Never trust `sampleRate`.** Read it from the `AudioContext`; don't assume
44100. Cents maths is sample-rate-relative and a wrong assumption is a silent,
plausible-looking error.

**A3. Analyse the decay tail, not the attack.** The first 20–30 ms of a strike
is broadband noise with no usable pitch. Never run the detector on the raw
attack.

**A4. Align the analysis window on the attack PEAK, never the level trigger.**
A hard strike crosses a threshold earlier in its attack than a soft one, so a
fixed offset from the trigger samples different points in the decay depending
on how hard you hit — and since higher partials decay faster, the estimate
moves with it. This was the main source of reading-to-reading jitter (D22).

**A5. One strike = one onset.** Enforce a refractory period (~250 ms) after a
detected onset. Without it a single `Na` registers several times and the tap
counter runs away.

**A6. Mic permission is requested on user gesture only,** with an explanation
of why, and the app degrades to a readable message if denied. Never a blank
screen.

---

## B. Pitch detection

**B1. `Na` is the only stroke.** It is the only one anyone tunes with
(RESEARCH §3). An earlier design used a `Tun` stroke to anchor absolute pitch;
it was not how the instrument is tuned and was removed (D13). Do not
reintroduce a second stroke.

**B2. The octave guard is structural, not corrective.** `Na` has a suppressed
fundamental and a dominant 3rd harmonic, so a naive detector reports a twelfth
too high. Rather than detecting that error and fixing it, constrain the search
band so it cannot be expressed: the dayan lives 150–400 Hz, so a third-harmonic
candidate at 780 Hz is not a value the function can return. Once a target note
is chosen the band narrows to 500 cents either side.

**Never replace this with post-hoc octave correction.** Making an error
impossible beats detecting and fixing it.

**B3. Every strike must agree with itself.** Measure each one over three
overlapping sub-windows. A clean stroke is periodic throughout; one spoiled by
a room reflection or a glancing hit is not. Disagreement past ~18 cents means
the reading is dropped and the display holds still. This is the honest
confidence measure and the main defence against visible jitter (D22).

**B4. Every estimate carries a confidence.** Use the MPM clarity metric. Below
threshold the reading is **discarded** — never displayed, never averaged in,
never silently interpolated. A confident wrong number is the worst failure mode
this app has.

**B5. Median, not mean.** Everywhere an aggregate is taken — the displayed
reading, the sub-window estimates, cents-per-tap. One bad strike or one slipped
hammer must not shift the result.

**B6. The DSP core is pure.** No `AudioContext`, no DOM, no React in
`src/lib/audio/`. Functions take a `Float32Array` and a sample rate, and return
numbers. That is what makes it testable without a drum.

**B7. Hard frequency bounds.** The dayan lives roughly 150–400 Hz. Anything
outside that is not the drum — reject it rather than displaying it.

---

## C. Safety — telling a human to hit a real instrument

These protect a physical object that cannot be un-broken. Treat them like
destructive-operation guards.

**C1. Never suggest a target the drum cannot reach.** Two limits, and the
second is the real one:

- The diameter → range table in `RESEARCH.md` §4, as a coarse prior.
- **Gatta travel** (D17). Blocks already near the bottom of the lace mean the
  drum is at its ceiling. Forcing it splits the head, and a lace out of travel
  needs re-lacing by a craftsman — no tuner helps.

**C2. Every instruction names the *safe* place to strike.** Middle of the gap,
never near the lace. The tasma snaps if struck, immediately and irreversibly.
Never generate an instruction that could be read as "hit the strap" or "hit the
head over the wooden edge."

**C3. Bias conservative.** Light taps then re-measure, never "hit it hard" or
one large correction. Small increments are both safer and more accurate.

**C4. Don't invent guidance.** Every claim traces to a source in
`RESEARCH.md`. If we genuinely don't know something — how hard to hit, before
calibration — the app **says we don't know** rather than guessing (PRD §7).

**C5. Surface the stop conditions.** If readings stay wildly inconsistent, or
the drum will not come onto pitch across repeated corrections, say the problem
may be the instrument — a damaged syahi, an unlevel bearing edge, or gattas out
of travel — and that hammering harder fixes none of them.

---

## D. Interface

**D1. Readable at arm's length, at an angle, one-handed.** You are sitting on
the floor with a drum in your lap and a hammer in your hand. Large type, high
contrast, no hover-dependent affordances, no small tap targets.

**D2. Hands-free, always.** Both hands are occupied. Nothing in the tuning loop
may require a touch — hammer blows are counted from the microphone rather than
entered (D19). Always provide an undo; mis-detection will happen.

**D3. Cents everywhere.** Musicians think in cents. The target's Hz may appear
once, small, beside the note; nowhere else.

**D4. Western note letters only.** `C#`. No Kali/Safed, no octave numbers — it
was clutter to the one person using this (D13). The mapping survives in
`cents.ts`, unrendered.

**D5. Show uncertainty as uncertainty.** Hold the display still rather than
moving it on a reading we don't trust. Never a crisp number the data doesn't
support.

**D6. Never claim more than was measured.** An earlier build announced the drum
was "even" after sixteen readings that may all have come from one spot, because
it could not tell one place from sixteen. A false green light is worse than no
verdict at all (D21).

**D7. Say nothing the player already knows.** He has ten years of hammer skill.
The app supplies perception and memory; it does not teach technique, name
positions, or say which way to hit (D19).

---

## E. Code

**E1. Small and boring.** Personal tool, one user. No state management library,
no component library, no abstraction layer added "for later." Add complexity
when something hurts, not before.

**E2. Client-side only.** No backend, no database, no auth. `localStorage` is
the persistence layer, and every access is wrapped — private windows and
blocked storage throw. If a feature seems to need a server, it's out of scope.

**E3. Unit tests on the DSP and the session logic, nowhere else required.**
That is where correctness is load-bearing and bugs are invisible. UI can be
checked by looking at it.

**E4. Synthetic fixtures are part of the test suite.** A harmonic stack at a
known f0 with 1:2:3:4:5 ratios and exponential decay, plus a `Na`-like variant
with the fundamental attenuated ~20 dB. **The detector must get both right** —
the second one is the whole point.

**E5. One page.** The tuner lives at `/`. There are no other routes, and adding
one needs a reason recorded in `DECISIONS.md` (D20).

**E6. Vocabulary is fixed.** Use the transliterations in `RESEARCH.md`
(`ghar`, `gatta`, `gajra`, `syahi`, `dayan`, `bayan`, `pudi`, `hathori`). Don't
anglicise them and don't invent new spellings.

**E7. Delete rather than keep.** Every correction from the player removed code,
and the app got better each time. Dead modules in a repo someone may read are
worse than the loss — `fft.ts` and `harmonics.ts` went when the diagnostics
bench did.
