# Research: How a tabla is actually tuned, and what a computer can measure

Status: complete (first pass). Compiled 2026-09-01 from acoustics literature and
practitioner sources. Every non-obvious claim has a source at the bottom.

This document exists because the project rests on one question — *is this even
possible?* — and the answer depends entirely on physics that is not common
knowledge. Read this before touching any DSP code.

---

## 1. The problem, stated precisely

A dayan (right-hand drum) has to satisfy **two independent conditions**:

1. **Absolute pitch.** The open ringing tone sits on the tonic (Sa) of whatever
   scale is being played.
2. **Circumferential evenness.** The pitch must be *the same wherever you strike
   around the rim*. The head is a circle under tension from a single leather
   lace; tension is not automatically uniform.

Condition 1 is easy to measure and easy to hear. Condition 2 is the hard one,
and it is the actual problem this project solves. Every practitioner source
says some version of *"tune it evenly all around"* — and then **none of them
say how to know whether you have.** That is the gap.

Confirmed across sources: the beginner guide "does not provide detailed
diagnostic guidance on how to test pitch at specific positions or how to
identify which spots are flat versus sharp." The Art of Tabla guide
"includes no method for identifying uneven spots once problems develop."
The only tabla-specific tuner app on the market (iOS, free, 2025) "makes no
mention of tuning evenness around the drum head."

The received wisdom is: *develop the ear over a decade, or take it to your guru.*

---

## 2. Anatomy of the tuning system

| Part | Role |
|---|---|
| **Pudi** | The compound head (goatskin), with the loaded centre |
| **Syahi / gab** | Black paste at centre — iron filings + rice/flour paste. Mass-loads the membrane. **This is the part that makes tabla harmonic.** |
| **Maidan** | The open annulus between syahi and rim |
| **Kinar / chanti** | The outer rim ring — where `Na` is struck |
| **Gajra** | The braided crown/plait around the circumference. Fine tuning happens here. |
| **Ghar** | The gaps between the lace holes in the gajra. **A standard dayan has 16 holes, so 16 ghars.** These are the discrete addressable positions. |
| **Gatta / gitak** | 8 cylindrical wooden blocks between the lace runs on the shell. Coarse tuning. |
| **Tasma / baddhi** | The leather lace. **Never strike this — it snaps.** |
| **Hathori** | The tuning hammer |

### Coarse vs fine — two different controls

- **Gatta (8 blocks):** drive a block *down* so the lace tightens and pitch
  rises. Coarse, moves the whole head. Used to get into the right neighbourhood.
- **Gajra (16 ghars):** hammer *down* on the crown for local tension up, pitch
  up at that region. Hammer *upward from underneath* for pitch down.
  Fine, and **local**. This is the control that fixes unevenness.

### Documented strike orders (opposite-side principle)

Tension must never be applied lopsidedly, so all sources prescribe crossing the
drum between consecutive strikes:

- **8 gattas:** `1-5, 2-6, 3-7, 4-8` (always the diametric opposite next)
- **16 ghars, simple:** `1-9, 2-10, 3-11, ...`
- **16 ghars, traditional full sequence:**
  `1, 9, 14, 6, 11, 3, 8, 16, 5, 13, 2, 10, 15, 7, 12, 4`

That last sequence is a real, encodable algorithm — a maximally-spread ordering
of 16 positions. **The app should generate and display this order.**

### Hard safety rules from the sources

- Never strike the tasma (leather lace) — it breaks immediately.
- Strike in the *middle* of a ghar, never on the lace crossing.
- Never strike the part of the pudi overlaying the wooden bearing edge.
- A head only tolerates roughly **1–2 semitones above or below its design
  scale**. Beyond that it splits. A 5.5" head forced up to E "will surely split."
- If the *bearing edge* itself is not level, no amount of tuning fixes it — that
  is a repair job.

---

## 3. The acoustics — why this is possible at all

This is the crux. **Most drums have no pitch.** A snare, a conga, a bare
membrane vibrates in modes at inharmonic ratios (1.00, 1.59, 2.14, 2.30,
2.65...), so a pitch detector has nothing to lock onto.

**The tabla dayan is one of the few exceptions in the world.**
C. V. Raman demonstrated in *Nature*, January 1920, that the loaded dayan head
produces overtones in an essentially **perfect harmonic series, 1:2:3:4:5**.
The syahi's graded mass-loading (thickest at centre, thinning outward) is
precisely what collapses the inharmonic modes onto integer multiples.
Modern FEM work confirms computed vs measured ratios agree "within seven
percent or better."

**Consequence: a tabla dayan is a legitimately pitched instrument, and standard
monophonic pitch detection (YIN / autocorrelation / MPM) applies to it.**
This is the single fact the whole project stands on.

### Measured frequency data (for sanity-checking our detector)

- Dayan `tin/tun` stroke: fundamental around **300 Hz**, partials around
  **550 Hz** and **810 Hz**
- Another analysis: peak around 250 Hz, second around 471 Hz
- Syahi ring resonance reported at 330 / 680 / 1050 Hz
- `Na` stroke: **very pronounced 3rd harmonic at 783 Hz** (implying f0 around
  261 Hz = C4)

Working range for a dayan: roughly **F#3 (185 Hz) to E4 (330 Hz)**.

### The single biggest DSP trap

From Courtney's psychoacoustic analysis:

> `TUN` has a pronounced fundamental with lower-amplitude harmonics.
> `NA` **lacks a clear fundamental** but features a very pronounced third
> harmonic.

Humans don't care — the brain reconstructs the missing fundamental from the
harmonic series. **A naive autocorrelation tuner absolutely does care.** Point a
generic guitar tuner at a `Na` stroke and it will happily report the 3rd
harmonic, an octave-plus-a-fifth error. *This is very likely why generic tuner
apps feel useless on tabla.*

**The fix, and it is the core engineering idea of this project:**

1. Establish the absolute fundamental **once**, from a `Tin`/`Tun` stroke, which
   has a real fundamental.
2. For the rim survey, use `Na` (the sources agree `Na` is what "reveals
   localized tension variations around the drum's perimeter") — but **do not
   re-detect the pitch from scratch.** Constrain the search to a narrow band
   around the already-known f0, or track a *fixed* partial index and compare
   `Na`-to-`Na` **relatively** across positions.

Because the survey only ever compares like with like, harmonic ambiguity
cancels out entirely. We never need absolute truth from `Na` — we need
*consistency*, which is a far easier problem. **Relative measurement is the
whole trick.**

### Why local pitch differences exist at all

On a perfectly uniform circular membrane the (1,1) mode is degenerate — two
identical modes at 90 degrees. Break the symmetry with uneven tension and that
degeneracy **splits** into two slightly different frequencies. Striking at
different points around the rim preferentially excites different members of the
split pair. So the pitch you hear genuinely does change as you rotate — exactly
the effect described. It is real, physical, and measurable.

**Resolution budget:** a 1-second window gives around ±1–3 cents. Real-world
uneven tuning is on the order of 10–50 cents. Comfortable margin — roughly an
order of magnitude of headroom.

### Also worth knowing

- On a **good** tabla, `Na` and `Tun` should read the *same* pitch. On a poor one
  they won't — caused by a wrong thickness ratio between syahi and edge. So a
  persistent Na/Tun mismatch is a **diagnosis about the instrument**, not a
  tuning error. The app can surface this.
- The syahi is the harmonic engine. If it cracks, lifts, or gets damp, the drum
  stops being harmonic and no tuner (or human) can save it.
- Heads stretch, especially in the first weeks after a re-head. Temperature and
  damp storage move the pitch.

---

## 4. Choosing the scale

### Indian and Western note names

| Western | Indian |
|---|---|
| C | Safed 1 |
| C# | Kali 1 |
| D | Safed 2 |
| D# | Kali 2 |
| E | Safed 3 |
| F | Safed 4 |
| F# | Kali 3 |
| G | Safed 5 |
| G# / Ab | Kali 4 |
| A | Safed 6 |
| A# / Bb | Kali 5 |
| B | Safed 7 |

### Dayan diameter to practical pitch range

Measured at the rim. Varies with skin and syahi thickness.

| Diameter | Range |
|---|---|
| 5.00" | D – D# |
| 5.25" | C – C# |
| 5.50" | B – C# |
| 5.75" | G# – Bb |
| 6.00" | F# – A# |

**Note the inverse relation** — bigger head, lower pitch. Pushing a head far
outside its range risks splitting it. *(Sources disagree slightly at the edges;
treat as a guide, not gospel. The app should confirm against what the drum
actually does.)*

### Which degree to tune to, best to worst

1. **Sa (tonic)** — always correct when you know the key
2. **Pa (fifth)** — strong harmonic relation; the standard fallback
3. **Ma (fourth)** — for ragas that omit the fifth
4. **Dha (sixth) / Ga (third)** — last resort, weaker
5. **Avoid: tivra Ma (#4), Re (2nd), Ni (7th)** — dissonant against the drone

### Bayan

Tuned roughly, usually **Ma or Pa in the lower octave** (Ma preferred by
default), around a fourth/fifth/octave below the dayan. It is deliberately
loose, is bent by heel pressure during play, and is **acoustically inharmonic**
— pitch detection on the bayan is a genuinely harder problem and should not be
in v1.

---

## 5. Prior art and the gap

| Tool | Does | Doesn't |
|---|---|---|
| Generic chromatic tuners (web/app) | Show a note + cents | Not built for a missing-fundamental percussive transient; harmonic errors on `Na` |
| iOS "Tabla Tuner" (2025, free) | Tabla presets, real-time pitch, colour needle | **No evenness / per-position survey. No hammer guidance.** |
| Practitioner guides | Excellent on mechanics and safety | No diagnostic method — "tune it even" with no way to check |
| Open-source pitch libs (pitchfinder, PitchDetect, pitchcraft) | Solid YIN/autocorrelation building blocks | Generic; no tabla model |

**Nobody has built the per-ghar survey.** That is the whole opportunity, and it
is a small piece of software.

---

## 6. Feasibility verdict

| Capability | Verdict | Notes |
|---|---|---|
| Read the current pitch of a dayan | **Yes, solid** | Harmonic instrument; YIN works. Gate on onset, use `Tin`. |
| Name the note + cents error + Indian scale name | **Yes, trivial** | Pure arithmetic once f0 is known |
| Suggest a target scale | **Yes** | Rule-based from diameter + intended use |
| **Survey all 16 ghars and rank them flat to sharp** | **Yes — the core value** | Relative comparison sidesteps the hard DSP |
| Tell you *which ghar* to hit and in *which direction* | **Yes** | Direct from survey data + documented strike order |
| Tell you *how hard* to hit | **Partly** | Not derivable from theory — must be *learned* from the user's own before/after data |
| Bayan tuning | **Weak** | Inharmonic, pitch-bendable. Out of scope for v1. |
| Diagnose a bad syahi / unlevel bearing edge | **Partly** | Can flag a persistent Na/Tun mismatch as a hint, not a diagnosis |
| Replace a guru's ear | **No** | And shouldn't claim to |

**Overall: yes, this is buildable, and the hard part is smaller than it looks
— because the evenness problem is a *relative* measurement.**

---

## 7. Risks to design against

1. **Harmonic/octave errors** — the `Na` missing-fundamental trap. Mitigation:
   band-constrained detection anchored to a `Tin` reading. *Must be handled or
   the app is worse than useless.*
2. **Phone mic quality and room acoustics** — a percussive transient with
   reverb. Mitigation: onset detection, analyse the decay tail, discard
   low-confidence hits, take the median of N strikes per ghar.
3. **Inconsistent human striking** — your own strike varies. Mitigation: 3+
   strikes per position, median, and show the spread as a confidence bar.
4. **Drift during the session** — the head moves as you hammer. Mitigation:
   re-measure a reference ghar periodically; treat the survey as a loop, not a
   one-shot.
5. **Physical damage from bad advice** — the app tells you to hammer, and
   hammers break heads. Mitigation: hard-coded safety rails, range warnings from
   the diameter table, conservative "small taps, re-measure" framing, and never
   suggest exceeding the head's range.

---

## Sources

- [Harmonic and Timbre Analysis of Tabla Strokes (arXiv 1510.04880)](https://arxiv.org/abs/1510.04880)
- [The eigenspectra of Indian musical drums (arXiv 0809.1320)](https://arxiv.org/pdf/0809.1320)
- [Tuning the Tabla: A Psychoacoustic Perspective — David Courtney, chandrakantha.com](https://chandrakantha.com/music-and-dance/instrumental-music/indian-instruments/tabla/tuning-the-tabla/)
- [Chapter 34: Tabla Tuning — kksongs.org](https://kksongs.org/tabla/chapter34.html)
- [8. Tuning Tabla — sangtar.com](https://www.sangtar.com/2007/04/8-tuning-tabla/)
- [How to tune a tabla — tablaschool.co.uk](https://tablaschool.co.uk/tune-tabla/)
- [Tuning and Various Scales — tablalegacy.com](https://www.tablalegacy.com/tuning-and-various-scales)
- [The Art of Tabla Rhythm: Tuning the Tabla](http://artoftabla.blogspot.com/p/tunning-tabla.html)
- [How to Tune your Tabla — fixmytabla.blogspot.com](http://fixmytabla.blogspot.com/p/how-to-tune-your-tabla.html)
- [Course:Phys341 2020/Tabla — UBC Wiki](https://wiki.ubc.ca/Course:Phys341_2020/Tabla)
- [Syahi — Wikipedia](https://en.wikipedia.org/wiki/Syahi)
- [Professional Tabla Repair & Tuning — drumdr.com](https://www.drumdr.com/tabla-repair.html)
- [Tabla Tuner — App Store](https://apps.apple.com/us/app/tabla-tuner/id6760444065)
- [pitchfinder — npm](https://www.npmjs.com/package/pitchfinder)
- [cwilso/PitchDetect — GitHub](https://github.com/cwilso/PitchDetect)
- [Detecting pitch with the Web Audio API and autocorrelation](https://alexanderell.is/posts/tuner/)
