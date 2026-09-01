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

## M1b — Strip to `Na` only (small) ⟵ next

Applying D13/D14 before building further, so M2 isn't built on the wrong shape.

- Remove the anchor/survey **mode switch**; the first `Na` of a pass sets the
  reference band silently
- Remove `compareStrokes` from `harmonics.ts` (D12 withdrawn); keep the partial
  analysis, which is still useful in diagnostics
- Interface shows a bare note letter — no Kali/Safed, no octave (PRD §6).
  `INDIAN_NAMES` stays in `cents.ts`, unrendered
- `/diagnostics` keeps Hz, clarity and partial bars; it is a bench, not the app

No new DSP. The detector is unchanged — this is deletion.

---

## M2 — The tuning screen (medium) ⟵ REPLACES the survey design below

**Superseded design kept below for context only. Build this instead.**

Per D16/D17/D18, there is no survey and no position tracking. One screen:

- **Headroom gate first** — where do the gattas sit? Out of travel means stop
- **Target note** — suggested from the drum, or picked from twelve; octave
  inferred silently
- **Live reading** — strike `Na`, get one large number: how far off, which way
- **Rolling trail** — last ~16 readings, unlabelled, showing scatter collapsing
- **Optional drone** at the target, off by default, muted briefly after each
  strike so it cannot confuse the detector
- Quiet, instrument-like: dark, restrained, few colours, large type

No ghar numbers. No ring diagram. No counting. No pass.

**Done when:** you can tune the drum with it and the trail visibly tightens.

### Superseded — the survey design (D13/D14, replaced by D16)

The core feature.

- Session model: 16 ghars × N strikes, median + spread per ghar
- Band bootstrapped from the first strike of the pass (D13)
- **"Turn one ghar"** between positions — the drum rotates, the hand does not
  (D14). Auto-advance on detected strike (RULES D2), with undo, plus a
  restart-pass for when you lose your place
- Audio cues for recorded / turn / didn't-hear (RULES D3) — you are looking at
  the drum, not the screen
- **The ring** — 16 marks, low/even/high, headline spread

**Done when:** you can walk the drum in one turn and get a picture that matches
what your ear already told you. This is the screen that doesn't exist anywhere
else; give it the most design attention in the project.

Open: how many strikes per ghar? 3 is the assumption (48 strikes a pass). If
M1's repeatability is strong, 1-2 may do. Decide from real data, not taste.

---

## M3 — Correction guidance (small–medium)

Turning the map into instructions. The player asked for the **full guided
loop**, so this is not optional polish.

- Encode the traditional sequence `1, 9, 14, 6, 11, 3, 8, 16, 5, 13, 2, 10, 15,
  7, 12, 4`, filtered to ghars actually out of tolerance
- One instruction at a time: which ghar, which hammer face, which direction,
  "two or three light taps"
- Re-measure the corrected ghar **and its opposite** after each hit
- Convergence tracking across passes — the spread is the number being watched
- A drum whose spread will not come down across several passes gets flagged as
  a possible instrument problem (replaces the withdrawn D12 check)
- All safety rails from RULES §C

**Done when:** following it end to end actually reduces measured spread.

---

## M4 — Pull to pitch (small) — optional, and only after the head is even

Cut back hard from the old scale module (D13). What survives:

- Diameter setting → safe range, as a **hard block** (RULES C1). Not teaching —
  it stops the app suggesting a tension that splits a head.
- Gatta pass: `1-5, 2-6, 3-7, 4-8` to move the whole drum bodily onto a note,
  then re-check evenness because coarse tuning disturbs it.

Deferred indefinitely: raga-aware targets, Sa/Pa/Ma ladder, drone reference,
natural-pitch finder, Kali/Safed naming.

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
