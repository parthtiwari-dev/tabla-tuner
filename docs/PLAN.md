# Build Plan

Ordered so that the riskiest thing is proven first. **Milestone 1 is a
go/no-go.** If pitch detection isn't repeatable on a real tabla, nothing built
on top of it matters, and we'd rather learn that in a day than after a week of
UI work.

Rough sizes assume focused sessions, not calendar days.

---

## M0 — Skeleton ✅ built, not yet deployed

Next.js 16 App Router + React 19 + TypeScript + Tailwind 4. Mic permission
request and a live input-level meter with a visible trigger threshold, on
`/diagnostics`.

**Done when:** the deployed URL shows a level meter that moves when you tap the
drum. Confirms HTTPS mic access works on your actual phone, which is the only
place that matters.

- [x] Project builds, typechecks, and serves locally
- [ ] **Deployed to Vercel** — still outstanding, and it gates the phone test:
      `getUserMedia` needs HTTPS, so `localhost` on a laptop is the only place
      the mic works until this is done

---

## M1 — The DSP core, and the go/no-go 🔬 code done, gate not yet run

The whole project's risk lives here. Pure functions, no UI.

`src/lib/audio/` —
- `onset.ts` — spectral-flux onset detection with a refractory period
- `mpm.ts` — McLeod Pitch Method: normalised square difference, peak picking,
  parabolic interpolation, clarity metric
- `octave.ts` — the sub-harmonic guard (RULES B2) and band-constrained search
  (RULES B3)
- `cents.ts` — Hz ↔ cents ↔ note name ↔ Kali/Safed

Write it by hand rather than pulling `pitchfinder`. It's ~150 lines, we need
control over the octave logic specifically, and the octave logic is the part
libraries get wrong on tabla.

**Tests first, with synthetic fixtures** (RULES E4): a 1:2:3:4:5 harmonic stack
with exponential decay at known f0, and a `Na`-like variant with the
fundamental attenuated 20 dB. Both must return the true f0.

**Then a throwaway diagnostic page** — strike the drum, dump f0, clarity, and
the FFT. Take it to the actual tabla.

### Built

- [x] `cents.ts` — Hz ↔ MIDI ↔ cents, Western + Kali/Safed naming
- [x] `fft.ts` — radix-2 FFT, Hann window, magnitude spectrum
- [x] `mpm.ts` — NSDF, key-maxima picking, parabolic refinement, band-constrained
      search, octave-ambiguity flag
- [x] `harmonics.ts` — partial analysis, inharmonicity, Na/Tun comparison (D12)
- [x] `onset.ts` — level-triggered strike capture, attack skip, refractory
- [x] `capture.ts` + AudioWorklet — raw mic, all browser processing disabled
- [x] `__fixtures__/synth.ts` — synthetic Tun and Na strokes
- [x] `/diagnostics` bench — live readings, partial bars, spread statistic

**50 tests passing.** The load-bearing ones:

| Test | Result |
|---|---|
| Tun stroke, 6 pitches | < 1 cent |
| **Na stroke, fundamental −20 dB** | **< 1 cent** |
| Na with fundamental −34 dB | < 2 cents |
| Never reports the 3rd harmonic | ✓ |
| **Relative accuracy under inharmonicity** | **< 3 cents** |
| Repeatability across 10 noisy strikes | < 5 cents |
| Rejects silence and noise | ✓ |

The relative-accuracy test is the one that matters most: with stretched
partials, *absolute* error grows to ~20 cents, but ghar-to-ghar *differences*
stay accurate to under 3 cents. That is the evenness survey's whole premise,
and it now has a test behind it.

### Known and accepted limitation

Band-constrained autocorrelation reports a sub-multiple for a harmonic tone
above the band — an 880 Hz tone reads as 293.3 Hz, because the signal genuinely
*is* periodic there. This is the flip side of the property that solves the Na
problem: the band asserts "the source is a dayan." Documented in the tests.
Acceptable, because the microphone is pointed at a dayan.

**Go/no-go gate — NOT YET RUN. Needs the real drum.**
Strike the same ghar ten times without touching the drum. Readings must agree
within **±5 cents** — read the Spread stat on `/diagnostics`. Then survey four
positions 90° apart and confirm the numbers differ in a way that matches what
your ear hears.

- ✅ Passes → continue.
- ❌ Fails → stop and diagnose before building anything else. Likely causes, in
  order: browser audio processing still enabled (RULES A1), analysing the attack
  instead of the decay (A3), or a genuinely damaged syahi. **Do not paper over
  this with smoothing.**

---

## M2 — The survey (medium)

The core feature.

- Session model: 16 ghars × N strikes, median + spread per ghar
- Anchor step: `Tun` strokes → absolute f0
- Survey step: auto-advance on detected strike (RULES D2), with undo
- Audio cues for recorded / next / didn't-hear (RULES D3)
- **The polar map** — 16 spokes, blue→green→red, cents at each, headline spread

**Done when:** you can walk the drum in under 3 minutes hands-free and get a
picture that matches your ear. This is the screen that doesn't exist anywhere
else; give it the most design attention of anything in the project.

---

## M3 — Correction guidance (small–medium)

Turning the map into instructions.

- Encode the traditional sequence `1, 9, 14, 6, 11, 3, 8, 16, 5, 13, 2, 10, 15,
  7, 12, 4`, filtered to ghars actually out of tolerance
- One instruction at a time: which ghar, which hammer face, which direction,
  "two or three light taps"
- Re-measure the corrected ghar **and its opposite** after each pass
- Convergence tracking across passes
- All safety rails from RULES §C

**Done when:** following it end to end actually reduces measured spread.

---

## M4 — Absolute tuning and the scale module (medium)

- Diameter setting → safe range, as a **hard block** (RULES C1)
- Target scale picker, Western + Kali/Safed together
- The Sa → Pa → Ma ladder, with the notes to avoid
- Drone reference tone at the chosen Sa
- "Find my drum's natural pitch" mode for solo riyaz
- Gatta phase: `1-5, 2-6, 3-7, 4-8`, then re-check evenness

---

## M5 — Polish and persistence (small)

- `localStorage` session history
- Log every correction: cents before, cents after, tap count — this is the raw
  material for hammer calibration later, and costs nothing now
- Responsive pass on both phone and laptop
- Onboarding: where to stick the ghar-1 marker and why

---

## M6 — Learned hammer calibration (later, only with data)

Once enough corrections are logged: *"for you, one light tap at a ghar moves it
about 7 cents."* The honest answer to the one thing theory can't give us.
Needs real data first — don't build it early.

---

## Deliberately not in this plan

Bayan support · accounts · a backend · sharing · rhythm/practice features ·
native apps.

---

## Open items

1. **Measure the dayan's diameter** (across the outer rim, in inches) — blocks
   the range table in M4, nothing earlier.
2. **Confirm 16 holes / 8 gattas** on your specific drum when you next look at
   it. Standard, but worth a glance.
3. **Record reference samples** during M1 — a few clean `Na` and `Tun` strokes
   into `docs/samples/`. These become permanent regression fixtures and mean
   future DSP work doesn't require the drum in the room.
