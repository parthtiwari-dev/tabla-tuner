# Tabla Tuner

**A browser tuner for tabla, built to solve a problem I'd had for ten years and never solved.**

No install, no signup, no backend. Open it, play `na`, and it tells you how far off you are.

---

## The problem

I've played tabla for about ten years. I could never tune it.

That isn't unusual, and it isn't laziness. Tuning is the part of the tradition taught last — by ear, over years, standing next to someone who already knows. My taleem stopped before I got there. So I could play the drum, and I could hear that something was wrong, but I could not fix it. I'd get one spot on the rim sounding right, rotate the drum, and it would be wrong again. Then I'd hammer, and make it worse, and not know I'd made it worse until it was far too late.

Every guide I found said the same thing: *tune it evenly all around.* Not one of them said how to know whether you had.

## Why no tool existed

**Every other instrument has independent controls.** Six guitar strings — tune one, the others don't move. Piano strings, harp strings, violin pegs: independent, one at a time.

A tabla has **sixteen coupled controls and no independent ones.** A single rawhide lace ties every point on the head to every other, over a membrane where the pitch at any spot depends on the tension everywhere. Tighten one position and you've just changed its neighbours and the point directly opposite. You aren't tuning sixteen things one at a time — you're solving one coupled system by hand, by ear, with a hammer.

That's why it's hard, and it's not folklore. It's the shape of the problem.

**And generic tuners actively lie to you on tabla.** The `na` stroke — the one you actually tune with — has a *suppressed fundamental* and a dominant third harmonic. Your ear reconstructs the missing fundamental automatically and never notices. An autocorrelation tuner cannot, so it locks onto the third harmonic and reports a note an octave and a fifth too high. For years I assumed the problem was my ear. It was partly the instruments I was measuring with.

## Why it's solvable at all

Almost every drum on earth is unpitched. A snare, a conga, a bare membrane vibrates in inharmonic modes (1.00, 1.59, 2.14, 2.30…) and no pitch detector has anything to grab.

**The tabla dayan is one of the world's few exceptions.** C. V. Raman showed in *Nature* in 1920 that the syahi — the black paste at the centre — mass-loads the membrane in a graded way that collapses those inharmonic modes onto a near-perfect harmonic series, **1:2:3:4:5**.

That's what the black paste is actually *for*. And it's the single fact this entire project stands on: the dayan is a genuinely pitched instrument, so pitch detection applies to it.

## What it does

One screen. It listens continuously and never asks you to press anything, because both your hands are busy — hammer in one, drum steadied by the other.

- **Finds your drum's note.** Play `na` once and it tells you where the drum is sitting, then you accept it or pick another of the twelve.
- **Shows the error.** One large number, in cents. Flat, sharp, or on it.
- **Counts your hammer blows by itself.** A `na` is tonal; a hammer tap on the gajra is a hard inharmonic click. The app sorts them apart, so `na(−20) → tap → tap → na(−6)` tells it that two taps moved the head fourteen cents. After a few corrections it knows *your* hand on *your* drum: **"your taps ≈ 7 cents each."**
- **Warns you before you break something.** Blocks near the bottom of the lace mean the drum is at its ceiling; forcing it splits the head, and a lace out of travel needs re-lacing by a craftsman, not a tuner.

It does **not** tell you which way to hit. If you play tabla you already know. What you can't do alone is perceive the error reliably and remember what the last few minutes of hammering actually did. It supplies exactly those two things and stays quiet otherwise.

## It works

The first time I used it, it landed on the exact pitch I'd been tuning to by ear for years — found independently, agreeing with a decade of habit. It was the first time in years I tuned my own tabla properly without someone standing next to me.

---

## Engineering notes

### Pitch detection is hand-written, not a library

~200 lines of the **McLeod Pitch Method** (normalised square difference, key-maxima picking, parabolic interpolation). Libraries exist. The part they get wrong on tabla is exactly the octave logic, which is the part that matters here.

**The octave guard is structural, not corrective.** Rather than detecting a harmonic error and fixing it, the search band is constrained so the error cannot be expressed: a dayan lives roughly 150–400 Hz, so a third-harmonic candidate at 780 Hz is simply not a value the function can return. Once a target note is chosen the band narrows to ±500 cents around it, which makes it impossible rather than merely unlikely.

### Two fixes for measurement jitter

**Peak alignment.** A hard strike crosses the level trigger *earlier in its attack* than a soft one, so measuring at a fixed offset from the trigger samples different points in the decay depending on how hard you hit. Higher partials die faster than the fundamental, so the partial balance — and the estimate — shifts with strike strength. Anchoring the analysis window on the attack **peak** measures every strike at the same point in its life.

**Self-consistency.** Each strike is measured three times over overlapping sub-windows. A clean stroke is periodic throughout and all three agree; one spoiled by a room reflection or a glancing hit is not. That disagreement is the honest confidence measure — a strike that doesn't agree with itself is dropped rather than displayed, because a confident wrong number is the worst thing a tuner can do.

### Tested without a drum in the room

The DSP is pure — `Float32Array` and a sample rate in, numbers out, no Web Audio and no React anywhere near it. So it's tested against **synthetic tabla strokes**: a 1:2:3:4:5 harmonic stack with per-partial exponential decay, in two variants.

The important one models `na` with the fundamental attenuated 20 dB and the third partial dominant — the exact signal that makes generic tuners fail. It resolves within **1 cent**, and still resolves at −34 dB.

**85 tests.** The ones that carry weight:

| | |
|---|---|
| `Tun` stroke, six pitches | < 1 cent |
| **`Na`, fundamental −20 dB** | **< 1 cent** |
| `Na`, fundamental −34 dB | < 2 cents |
| Never reports the third harmonic | ✓ |
| Repeatability across ten noisy strikes | < 5 cents |
| Rejects silence and noise rather than guessing | ✓ |
| Hammer taps classified apart from `na` | ✓ |

### Stack

Next.js · TypeScript · Tailwind · Web Audio (AudioWorklet). **Entirely client-side** — no backend, no database, no accounts, no analytics. Audio never leaves the device. `localStorage` holds your settings and hammer calibration.

```bash
npm install
npm run dev     # localhost:3000
npm test
```

> Microphone access needs HTTPS, so on a phone it must be deployed, not on `localhost`.

### An honest note on the process

This was built with Claude, and the interesting part wasn't the code — it was that **I was wrong about the design three times, and being a tabla player is what caught it.**

The first version had you play a `Tun` stroke to anchor absolute pitch. Real players only ever strike the kinar and listen to `na`; the anchor was designed around a DSP worry, not around practice. The second version surveyed sixteen labelled positions and built a map. You're looking at the drum — the app doesn't need to know where you are. The third told you which way to swing the hammer, which is the one thing a ten-year player doesn't need told.

Each correction *deleted* code. The final version is much smaller than the first, and the decision log in [`docs/DECISIONS.md`](docs/DECISIONS.md) has all nineteen turns of it, including the reversals. That's the record I'd actually want someone to read.

## Documentation

| | |
|---|---|
| [`docs/RESEARCH.md`](docs/RESEARCH.md) | The acoustics and the practitioner method, sourced |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Every decision and every reversal |
| [`docs/PRD.md`](docs/PRD.md) | What it is and what it deliberately isn't |
| [`docs/INSTRUMENT.md`](docs/INSTRUMENT.md) | The specific drum this was built against |
| [`docs/RULES.md`](docs/RULES.md) | Audio, safety and interface constraints |

## Limits, stated plainly

- **Dayan only.** The bayan is acoustically inharmonic and pitch-bent by heel pressure in play — a materially harder problem.
- **Tuned around one drum.** The frequency band assumes a concert-sized dayan; the `na`-versus-hammer threshold was calibrated against one hammer and one hand. Both are adjustable in settings.
- **Absolute pitch drifts on a stretched head.** Real tabla partials aren't perfectly harmonic. Relative accuracy stays under 3 cents, but the absolute reading can sit ~20 cents from what an ear calls in tune. An optional reference tone is there for that.
- **It won't replace a teacher's ear.** It's an instrument that extends mine.

## Licence

MIT.
