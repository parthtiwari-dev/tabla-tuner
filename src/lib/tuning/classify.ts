/**
 * Deciding what the microphone just heard.
 *
 * The app listens continuously, so every onset has to be sorted into one of
 * two buckets: a pitched `na` at the kinar, or a hammer blow on the gajra.
 *
 * The player's insight is what makes this workable — hammer blows *are* picked
 * up, and that is a feature, not interference. Counting them is what allows
 * calibration to happen with no buttons and no free hand (D19).
 *
 * The discriminator is **clarity**, the NSDF peak height. A `na` is a tonal
 * stroke on a harmonic membrane and scores high. A hammer blow on the braided
 * gajra is a short, hard, largely inharmonic click; it excites the head a
 * little, but not into a clean periodic decay, so it scores low.
 *
 * This is a heuristic, not a certainty, so the threshold is a setting and the
 * classification is shown on screen. The stakes are deliberately low: a
 * mis-sorted onset costs a slightly wrong cents-per-tap figure, which is
 * informational. Nothing acts on it.
 */

import { detectPitchNearAnchor, detectPitch, DAYAN_F_MIN, DAYAN_F_MAX } from "@/lib/audio/mpm";
import type { Onset } from "./session";

/** A `na` must beat this NSDF clarity. Below it, the onset is taken as a tap. */
export const DEFAULT_NA_CLARITY = 0.78;

/**
 * How far from the target we still accept a reading, in cents. Wide enough to
 * show a badly-off drum; far too narrow for a 3rd-harmonic error (+1902 cents)
 * to slip through (RULES B3).
 */
export const TARGET_WINDOW_CENTS = 500;

export interface ClassifyOptions {
  /** When known, constrains the search and keeps octave errors impossible. */
  targetHz?: number;
  naClarity?: number;
}

export interface Classification {
  onset: Onset;
  /** Present whether or not it was accepted as a na, for the live display. */
  hz: number;
  clarity: number;
}

export function classifyOnset(
  window: Float32Array,
  sampleRate: number,
  options: ClassifyOptions = {},
): Classification {
  const { targetHz, naClarity = DEFAULT_NA_CLARITY } = options;

  const result = targetHz
    ? detectPitchNearAnchor(window, sampleRate, targetHz, TARGET_WINDOW_CENTS, {
        // Let a low-clarity result through so we can see it and call it a tap,
        // rather than the detector silently discarding it.
        clarityThreshold: 0,
      })
    : detectPitch(window, sampleRate, {
        fMin: DAYAN_F_MIN,
        fMax: DAYAN_F_MAX,
        clarityThreshold: 0,
      });

  const pitched = result.hz > 0 && result.clarity >= naClarity;

  return {
    onset: pitched
      ? { kind: "na", hz: result.hz, clarity: result.clarity }
      : { kind: "tap" },
    hz: result.hz,
    clarity: result.clarity,
  };
}
