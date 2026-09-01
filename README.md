# Tabla Tuner

A web tuner for tabla that measures the thing no other tuner does: whether the
dayan is tuned **evenly all the way around**.

## The problem

A tabla dayan can sit perfectly on pitch at one point on the rim and be
noticeably off at another. Every tuning guide ever written says "tune it evenly
all around" — and not one of them tells you how to check. That diagnostic step
isn't in the written record at all. It lives in gurus' ears, and it takes years.

Generic chromatic tuners don't help, and actively mislead: the `Na` stroke has a
suppressed fundamental and a dominant 3rd harmonic, so autocorrelation tuners
lock onto the wrong partial and report a note an octave-and-a-fifth too high.

## Why it works

The tabla dayan is one of the very few genuinely *pitched* drums in the world.
C. V. Raman showed in 1920 that the syahi's graded mass-loading collapses the
membrane's normally-inharmonic modes onto a near-perfect harmonic series,
1:2:3:4:5. That's what the black paste is actually for — and it's what makes the
drum tractable to a machine.

And the hard half of the problem turns out to be easier than it looks, because
**evenness is a relative measurement**. We never need the true absolute pitch of
a `Na` stroke — only ghar 4 compared to ghar 12. Anchor the absolute pitch once
from a `Tun` stroke, then compare `Na` strokes to each other. Like-for-like
comparison makes the harmonic ambiguity cancel out.

## What it does

Tap around the 16 ghars of the gajra; it hears each strike and advances
hands-free. Then it draws a polar map of your drum showing which houses are flat
and which are sharp, and tells you which one to hit, in which direction, in what
order — following the traditional opposite-side sequence.

It also reads absolute pitch in Western and Kali/Safed naming, and explains
which scale you should be tuning to and why.

## Docs

| | |
|---|---|
| [`docs/RESEARCH.md`](docs/RESEARCH.md) | The physics and the practitioner method. **Read before touching DSP code.** |
| [`docs/INSTRUMENT.md`](docs/INSTRUMENT.md) | Profile of the actual drum this is built for |
| [`docs/PRD.md`](docs/PRD.md) | What we're building and why |
| [`docs/PLAN.md`](docs/PLAN.md) | Build order, with a go/no-go gate at M1 |
| [`docs/RULES.md`](docs/RULES.md) | Engineering rules — audio, safety, UI |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decision log |

## Status

Pre-build. Research and planning complete.

---

*Personal tool. Built because ten years of playing never included learning to
tune.*
