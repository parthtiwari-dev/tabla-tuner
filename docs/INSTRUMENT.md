# The Instrument

A profile of the actual dayan this tool is being built for. The app needs a
per-instrument profile anyway (diameter → safe range), so this is where it
lives.

Assessed 2026-09-01 from three photographs. **Photo-derived figures are
estimates** and are marked as such — anything load-bearing gets confirmed by
physical measurement or by the drum's own measured pitch.

---

## Construction — confirmed traditional ✅

Visible in the photos, and it settles decision D8:

- **Rawhide lace (tasma)** threaded through the gajra — not bolts
- **Wooden gattas** visible wedged between the lace runs on the shell
- **Braided gajra** crown, intact all the way round
- **Compound pudi**: the boundary between the inner maidan (lower skin only)
  and the outer chanti/kinar layer is clearly visible as a tone change
- **Small teal/green marks** at regular intervals just inside the gajra —
  these appear to sit at the lace holes

The 16-ghar / 8-gatta construction in `RESEARCH.md` applies to this drum.

*(The teal marks were once going to serve as position references. The app no
longer tracks position at all — D16 — so they are just a nice detail.)*

---

## Dimensions — estimated, needs confirming ⚠️

Measured off the ruler in photos 2 and 3, using the printed scale for
calibration (~155 px/inch in both frames).

| Measurement | Photo 2 (horizontal) | Photo 3 (vertical) | Take |
|---|---|---|---|
| Playing surface (inside gajra) | ~4.6" | ~5.3" | **~5.0–5.3"** |
| Outer edge, including gajra | ~6.2" | ~6.8" | ~6.2–6.8" |

The two frames disagree by about 0.7", which is expected: the ruler rests on
the raised head while the outer edge sits lower, so parallax shifts things, and
in photo 2 the ruler lies slightly below the drum's centre line (a chord, not a
diameter).

Cross-check: quoted tabla sizes typically run ~1–1.25" less than the outer
diameter including gajra. 6.2–6.8" outer → 5.0–5.6" quoted. Consistent.

**Working assumption: a ~5.25" dayan.** Which is awkward, because it straddles
a boundary that matters:

| If it's | Practical range |
|---|---|
| 5.00" | D – D# |
| 5.25" | C – C# |
| 5.50" | B – C# |

### How to settle it

Lay the ruler flat **across the widest part of the head, through the centre**,
and read the **inner** edge of the gajra on both sides — the playing surface,
not the outer braid. Sight straight down, not at an angle.

### Why this is less critical than it looks

The diameter table is a **prior, not a measurement**. Its real job is the safety
rail (RULES C1) — stopping the app from suggesting a tension that splits the
head. The *actual* answer to "what scale does this drum want" comes from
measuring what the drum does, which the tuner reports on the first strike. A
rough diameter is enough to bound the danger zone; the drum tells us the rest.

In practice **gatta travel is the better limit** (D17) — it reflects the drum's
present state rather than a generic size prior, and it is what the app checks.

---

## Condition

### Good signs

**The syahi is well centred.** Measured off photo 1, the syahi and the pudi
share a centre to within a few pixels. Off-centre syahi is a common defect and
this drum doesn't have it.

**The syahi-to-head ratio looks correct** — roughly **0.47** (syahi diameter
~47% of the playing surface). Healthy range is about 0.45–0.50.

This matters more than it sounds. `RESEARCH.md` §3 notes that a persistent
`Na` vs `Tun` pitch mismatch is caused by *"an improper relationship between
the thickness of the syahi in the centre and the thickness at the edge."* The
proportions here look right, which is a real point in the instrument's favour —
it suggests the drum is capable of being tuned properly.

**The pudi is intact** — no visible tears, splits, or damage at the bearing
edge. The gajra braid is unbroken all the way round.

### Watch item — syahi surface crazing ⚠️

The syahi shows a **fine crackled / reticulated texture** across much of its
surface, clearest in photos 2 and 3, along with the normal concentric layering
rings.

**This is probably fine.** Syahi is built up from many thin layers of iron
filings and paste, and a surface craze pattern is extremely common on any
tabla that isn't new. It is not, by itself, a problem.

**It matters only if it isn't just surface.** The syahi is the entire reason
this drum is harmonic — its graded mass-loading is what pulls the modes onto
the 1:2:3:4:5 series. If it *lifts*, *delaminates*, or *cracks through*, the
drum stops being harmonic, and at that point neither this app nor a teacher can
tune it. It becomes a re-syahi job.

**Two-minute check, no software needed:**

1. **Look along the surface** at a low angle in raking light. Cosmetic crazing
   is flat. Look for any craze line with a *raised or lifted edge*, or any
   patch that looks like it's separating from the skin.
2. **Press gently** around the syahi with a fingertip, especially near its
   outer edge. It should feel uniformly hard and bonded. Anything that gives,
   crunches, or feels papery is delamination.
3. **Play `Tun`, then play `Na`, and compare pitch by ear.** On a healthy drum
   they should sound like the *same note*. If they stubbornly don't — and the
   drum is otherwise evenly tuned — that points at the syahi rather than at
   your tuning.

Test 3 is a manual check only. An earlier design had the app perform it, but
that required a `Tun` stroke nobody tunes with, and the whole idea was
withdrawn (D13). Do it by ear if the drum ever stops behaving.

---

## Also in frame

A second drum sits behind the dayan in all three photos — red-topped with a
metallic rim, out of focus. Presumably the bayan, but the head colour is
unusual enough to be worth a look. Not needed for v1 (bayan is out of scope,
D11), but if it *is* the bayan, its condition is worth knowing before any
future work.

---

## Open

- [ ] Confirm playing-surface diameter with a flat, centred, straight-down
      measurement
- [ ] Count the gattas — expect **8**, and note how far down the lace they sit
      (this is the headroom check, D17)
- [ ] Do the three-step syahi check above
- [ ] Identify the second drum
