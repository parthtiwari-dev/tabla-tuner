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

**Rewritten 2026-09-01 per D16/D17/D18.** Two earlier designs are discarded: a
six-phase version opening with a `Tun` anchor, and a survey version that walked
sixteen labelled ghars. Both were the software's idea of the task, not the
task. What follows matches described practice.

The governing correction: **the note comes first, and evenness is the result,
not the method.** You decide the note before picking up the hammer, then bring
every position to that note. When they all match, the drum is even *and* on
pitch — never two goals, always one.

### Step 0 — Headroom (D17)

Look at where the 8 gattas sit on the lace. High means room to tighten; already
near the bottom means the drum is at its ceiling and cannot go higher.

If the target is out of reach, **the app says so and stops.** Forcing it splits
the head, and a lace out of travel is a craftsman's re-lace, not a tuning
session. This is the first screen because it decides whether the rest is
possible.

### Step 1 — The note

Either the app suggests from where the drum already sits ("you're near C#"), or
you pick from twelve. The octave is inferred from the drum and never asked
about — a dayan lives roughly D3–G4, so there is usually only one reachable
answer.

An optional drone at the target is available for the ear. Off by default; the
measurement is the truth (D18).

### Step 2 — Tune

Strike `Na` at the kinar. One large reading: how far off, which way. Hammer.
Strike again. Rotate when satisfied. Repeat around the drum.

**The app does not know or track where you are (D16).** No ghar numbers, no
position prompts, no counting. You are looking at the drum; it isn't.

### Step 3 — See the evenness

A rolling, unlabelled trail of the last ~16 readings. Scattered means uneven; a
tight cluster on the target means tuned. The objective picture, with none of
the position-tracking machinery.

### Done when

Every rotation gives the same reading, and it sounds right to you. Your ear is
the stop condition; the trail is the evidence.

### Explicitly not in the flow

- No `Tun` stroke — not how anyone tunes
- No ghar identity, numbering, or reference mark
- No scale theory gate before you can start
- No survey-then-act phase separation

## 6. Pitch on screen

One small number, off to the side: roughly what note the drum is sitting at.
`C#`, and nothing more.

- **No Kali/Safed naming.** The mapping stays in `cents.ts` but nothing renders
  it. It was clutter to the one person using this.
- **No octave numbers, no Hz** outside diagnostics.
- Cents appear per-ghar and as the spread, because that is the number that
  visibly improves as you work.

Absolute pitch costs nothing to obtain — the band-constrained detector resolves
it from `Na` alone — so this is purely a display decision and reversible.

### Cut from v1 (was D6, superseded by D13)

The scale-teaching module: raga-aware targets, the Sa/Pa/Ma ladder, drone
reference, natural-pitch finder. All of it deferred. The one piece worth
keeping is the **diameter safety rail** (§7), which is not teaching — it stops
the app suggesting a tension that splits a head.

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
