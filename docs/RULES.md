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
44100. Cents math is sample-rate-relative and a wrong assumption is a silent,
plausible-looking error.

**A3. Analyse the decay tail, not the attack.** The first ~20–30 ms of a strike
is broadband noise with no usable pitch. Window from ~30 ms after onset for
~400–600 ms. Never run the detector on the raw attack.

**A4. One strike = one onset.** Enforce a refractory period (~250 ms) after a
detected onset. Without it a single `Na` registers three times and the
auto-advance runs away.

**A5. Mic permission is requested on user gesture only,** with an explanation
of why, and the app degrades to a readable message if denied. Never a blank
screen.

---

## B. Pitch detection

**B1. Absolute pitch comes from `Tun`. Relative pitch comes from `Na`.**
This separation is the core of the design. Do not blur it, do not "simplify" it
away. See `CLAUDE.md` and `RESEARCH.md` §3.

**B2. Guard the octave, always.** `Na` has a suppressed fundamental and a strong
3rd harmonic. Every absolute estimate must be sanity-checked against the
sub-harmonics: if a candidate f0 has plausible energy at f0/2 or f0/3 within the
dayan's range, prefer the lower. An unguarded detector will confidently report
a note a twelfth too high.

**B3. Constrain the search band during surveys.** Once anchored, search only
±200 cents around the known f0. This makes octave errors structurally
impossible during the survey rather than merely unlikely.

**B4. Every estimate carries a confidence.** Use the MPM clarity metric.
Below threshold, the reading is **discarded and re-requested** — never
displayed, never averaged in, never silently interpolated. A confident wrong
number is the worst failure mode this app has.

**B5. Median, not mean.** Three or more strikes per ghar, take the median. One
bad strike shouldn't shift the result. Report the spread as confidence.

**B6. The DSP core is pure.** No `AudioContext`, no DOM, no React in
`src/lib/audio/`. Functions take `Float32Array` + `sampleRate` and return
numbers. This is what makes it testable without a drum.

**B7. Hard frequency bounds.** The dayan lives roughly 150–400 Hz. Anything
outside that is not the drum — reject it rather than displaying it.

---

## C. Safety — telling a human to hit a real instrument

These protect a physical object that cannot be un-broken. Treat them like
destructive-operation guards.

**C1. Never suggest a target outside the head's range.** The diameter → range
table in `RESEARCH.md` §4 is a **hard block**, not a warning. A 5.5" head at E
splits. If the user asks for something out of range, refuse and explain.

**C2. Every instruction names the *safe* place to strike.** "Middle of the ghar
gap" — never near the lace. The tasma snaps if struck, immediately and
irreversibly. Never generate an instruction that could be read as "hit the
strap" or "hit the head over the wooden edge."

**C3. Bias conservative.** Always "two or three light taps, then re-measure,"
never "hit it hard" or a large single correction. Small increments with
re-measurement is both safer and more accurate.

**C4. Don't invent guidance.** Every instruction traces to a source in
`RESEARCH.md`. If we genuinely don't know something — how hard to hit — the app
**says we don't know**. See PRD §7.

**C5. Surface the stop conditions.** If readings are wildly inconsistent, or
`Na` and `Tun` persistently disagree, tell the user the problem may be the
instrument (syahi, bearing edge) and that hammering harder will not fix it.

---

## D. Interface

**D1. Readable at arm's length, at an angle, one-handed.** You are sitting on
the floor with a drum in your lap and a hammer in your hand. Large type, high
contrast, no hover-dependent affordances, no small tap targets.

**D2. Hands-free through the survey.** Once started, a full 16-ghar pass needs
zero touches. Auto-advance on strike. Always provide an undo for a mis-detected
strike — it will happen.

**D3. Audio feedback is first-class, not decoration.** You will be looking at
the drum, not the screen. Spoken or tonal cues for "recorded", "next ghar",
"couldn't hear that."

**D4. Cents everywhere.** Hz appears only in a diagnostics view. Musicians think
in cents.

**D5. Both namings, always together.** `C# · Kali 1`. Never one alone.

**D6. Show uncertainty as uncertainty.** Greyed, hatched, explicitly labelled.
Never a crisp number the data doesn't support.

---

## E. Code

**E1. Small and boring.** Personal tool, one user. No state management library,
no component library, no abstraction layer added "for later." Add complexity
when something hurts, not before.

**E2. Client-side only.** No backend, no database, no auth. `localStorage` is
the persistence layer. If a feature seems to need a server, it's out of scope.

**E3. Unit tests on the DSP, and nowhere else required.** The math is where
correctness is load-bearing and where bugs are invisible. UI can be checked by
looking at it.

**E4. Synthetic fixtures are part of the test suite.** A harmonic stack at
known f0 with 1:2:3:4:5 ratios and exponential decay, plus a `Na`-like variant
with the fundamental attenuated ~20 dB. **The detector must get both right** —
the second one is the whole point.

**E5. One-indexed ghars.** 1–16, matching how a player counts. Convert at array
boundaries only, and comment where you do.

**E6. Vocabulary is fixed.** Use the transliterations in `RESEARCH.md`. Don't
anglicise, don't re-spell, don't abbreviate.
