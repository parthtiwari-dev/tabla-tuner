# Build Plan

## Status — shipped

The tuner is built and has been used successfully on a real drum. One page at
`/`, no other routes.

| | |
|---|---|
| M0 · scaffold | done |
| M1 · DSP core | done — gate retired unrun (D20); real use answered it |
| M2 · the tuning screen | done |
| M3 · automatic tap counting and calibration | done (D19) |
| M4 · headroom check | done (D17) |
| M5 · persistence | done |
| — · jitter fixes | done (D22) |

Removed along the way: the diagnostics bench, `fft.ts`, `harmonics.ts`, the
survey model, ghar identity, scale theory, hammer direction advice, and the
spread/trend readouts. Each deletion came from a correction by the player.

## Not building

Bayan support · accounts · a backend · sharing · rhythm or practice features ·
native apps · ghar identity · raga logic.

## Open, if it is ever put in front of strangers

- The frequency band assumes a concert-sized dayan; a 6" drum or a bolt-tuned
  student tabla would need wider assumptions
- The `na`-versus-hammer clarity threshold is calibrated to one hammer and one
  hand — adjustable in settings, but the default is personal
- Only ever run in one browser on one machine
- A domain, and a check of real search volume before assuming SEO is worth it

---

## Historical build order

Kept for the record; all of it is done or deleted.

