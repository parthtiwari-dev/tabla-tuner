# PRD — Tabla Tuner

Version 0.1 · 2026-09-01 · Status: agreed, pre-build

## 1. The problem

I have played tabla for about ten years, with two years of formal taleem, and I
still cannot tune it. This is not unusual — tuning is the part of the tradition
that gets taught last, by ear, over years, and I never got that far with my
guru before lessons stopped.

The specific failure, in my own words:

> "I can tune it just a little where it gets to that soothing sound but only at
> one place — if I rotate it the sound isn't the same."

That is the whole problem. It is not "what note is this." It is that the drum is
only right in one spot.

### Why existing tools don't help

- **Generic chromatic tuners** report a note. They say nothing about position,
  and they actively mislead on tabla: the `Na` stroke has a suppressed
  fundamental and a dominant 3rd harmonic, so autocorrelation-based tuners lock
  onto the wrong partial and report a note an octave-and-a-fifth high.
- **The one tabla-specific app** (iOS, free, 2025) is a nicer chromatic tuner
  with Indian scale presets. It has nothing about evenness.
- **Every practitioner guide** says "tune it evenly all around" and then gives
  no way to check whether you have. The diagnostic step is simply absent from
  the written record. It lives in gurus' ears.

There is a real, unfilled gap here, and it is a small piece of software.

## 2. Why it's solvable

Three facts, established in `docs/RESEARCH.md`:

1. **The tabla dayan is a genuinely pitched instrument.** Raman, 1920: the
   syahi's mass-loading makes the overtones a near-perfect harmonic series
   (1:2:3:4:5). Most drums are inharmonic and untunable by machine. This one
   isn't. Standard pitch detection applies.
2. **Uneven tension produces a real, measurable pitch difference by position.**
   It splits the membrane's degenerate (1,1) mode. The effect I hear is physics,
   not imagination.
3. **Evenness is a *relative* measurement.** We don't need the true absolute
   pitch of a `Na` stroke — only ghar 4 versus ghar 12. Compare like with like
   and the harmonic ambiguity cancels out.

Measurement resolution is ~±2 cents; real unevenness is 10–50 cents. An order of
magnitude of headroom.

## 3. Goals

**Primary.** Let me see, as a picture, how evenly my dayan is tuned around its
circumference — and tell me which ghar to hit, in which direction, in what order.

**Secondary.** Tell me what note the drum is currently at, in both Western and
Indian naming, and help me move the whole drum onto a chosen scale.

**Tertiary.** Teach me *which* scale I should be tuning to and why — the thing
my taleem never reached.

### Non-goals

- Not a product. One user. No accounts, no analytics, no monetisation.
- Not a bayan tuner in v1. The bayan is inharmonic and pitch-bent in play; it's
  a materially harder problem and belongs in a later version if at all.
- Not a replacement for a teacher's ear. It is an instrument that extends mine.
- Not a repair diagnostic. It may *hint* that something is wrong with the syahi
  or the bearing edge; it will not diagnose.
- Not a practice/rhythm app. No taals, no metronome, no bol trainer.

## 4. Decisions taken

| Question | Decision |
|---|---|
| Form factor | **Fully responsive** — phone propped up and laptop, both first-class |
| Advancing through the survey | **Auto-advance on detected strike** — hands-free, since both hands are occupied |
| v1 scope | **Everything**: survey + tuner + scale-teaching |
| Priority when goals conflict | **Evenness first**, then pull the whole drum to the target scale |
| Drum type | Traditional — leather lace, 8 wooden gattas, 16-hole gajra |
| Diameter | To be measured; entered once as a setting |
| Use case | Both solo riyaz and accompanying a reference pitch |
| Hammer | A proper hathori is available |

## 5. The core flow

Six phases. The app walks through them in order, but any phase can be entered
directly.

### Phase 0 — Setup (once)
Enter the dayan's diameter. Physically mark **ghar 1** on the drum with a small
piece of tape, so numbering is consistent between sessions. The app explains
where to put it and why it matters.

### Phase 1 — Anchor
Play a few `Tun` strokes at the centre. The app establishes the drum's current
absolute pitch: `271 Hz — C#4, Kali 1, 24 cents flat`. This f0 becomes the
reference band for everything that follows.

### Phase 2 — Survey
The app calls out ghar 1. You strike `Na` there three times. It hears each
strike, records it, and **automatically advances** to ghar 2. Around the drum,
16 positions, roughly two minutes. Median of three strikes per ghar; the spread
across the three becomes a confidence indicator.

### Phase 3 — Diagnose
A polar map of the drum. Sixteen spokes, colour-coded: blue for flat, green for
even, red for sharp, with the deviation in cents at each. One headline number:

> **Spread: 34 cents.** Ghar 11 and 12 are notably flat. Aim for under 10.

This screen alone is the thing that doesn't exist anywhere else.

### Phase 4 — Correct
Guided, one instruction at a time, following the traditional opposite-side
sequence (`1, 9, 14, 6, 11, 3, 8, 16, 5, 13, 2, 10, 15, 7, 12, 4`) but skipping
ghars that are already fine:

> **Ghar 11 — 18 cents flat.** Flat face of the hathori, strike *down* on the
> gajra, in the middle of the gap. Two or three light taps. Then re-measure.

After each correction it re-measures that ghar **and its opposite**, because
tension moves across the head.

### Phase 5 — Converge
Loop back to Phase 2 until the spread is under threshold. The app tracks
progress across passes so you can see it tightening.

### Phase 6 — Pull to scale
Only now, with an even head, move the whole drum onto the target note using the
gattas in `1-5, 2-6, 3-7, 4-8` order. Then re-check evenness, because coarse
tuning disturbs it.

## 6. The scale-teaching module

Not a wall of text. Contextual, answering the questions actually being asked.

- **"What can my drum even do?"** From the diameter: a safe range, with a hard
  warning line. A 5.5" head forced to E will split. This is a safety feature,
  not a nicety.
- **"What note is this called?"** Western ↔ Kali/Safed mapping, always shown
  together.
- **"What should I tune to?"** The ladder: **Sa** is always right; **Pa** is the
  strong fallback; **Ma** when the raga omits the fifth; Dha/Ga as last resorts;
  and avoid tivra Ma, Re and Ni — they fight the drone.
- **"I'm playing along to something."** A drone reference (tanpura-ish sustained
  tone) at the chosen Sa, so I can tune against it by ear as well as by eye.
- **"I'm playing alone."** A *find-my-drum's-natural-pitch* mode: where does
  this head sit happiest with least tension asymmetry? Often the right answer
  for solo riyaz.

## 7. What the app must be honest about

Trust matters more than features here, because bad advice breaks a real drum.

- **It cannot tell you how hard to hit.** Not derivable from theory. v1 says
  "light taps, re-measure often." v2 learns it from my own logged before/after
  data — see §9.
- **A persistent `Na` vs `Tun` mismatch is a hint about the instrument**, not a
  tuning error. It usually means the syahi-to-edge thickness ratio is off. The
  app says so and stops there.
- **Low-confidence readings are shown as low-confidence,** never silently
  guessed. A greyed-out ghar with "couldn't hear that clearly, strike again" is
  correct behaviour. Confident wrong numbers are the worst possible failure.
- **Range warnings are hard blocks,** not suggestions.

## 8. Success criteria

The project succeeds if, after using it, I can tune my own dayan so it sounds
the same all the way around — without a teacher. Concretely:

1. A full survey takes under 3 minutes.
2. Repeating a survey without touching the drum reproduces each ghar within
   5 cents. *(If this fails, nothing else matters — measure it first.)*
3. Following the guidance reduces measured spread pass over pass.
4. The end state passes my own ear: rotating the drum, `Na` sounds the same.

Criterion 4 is the real one. Everything else is instrumentation.

## 9. Later, explicitly not now

- **Personal hammer calibration.** Every correction logs cents-before,
  cents-after, and tap count. After enough data: "for you, one light tap at a
  ghar moves it about 7 cents." This is the honest way to answer §7's first
  point, and it costs nothing now beyond logging.
- Session history and drift tracking over weeks — does ghar 12 always go flat?
- Bayan support.
- Recording and exporting a stroke for a teacher to listen to.
