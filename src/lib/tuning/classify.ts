/**
 * Deciding what the microphone just heard.
 *
 * The app listens continuously, so every onset must be sorted:
 *
 *   na      — a pitched stroke at the kinar. The measurement.
 *   tap     — a hammer blow on the gajra. Counted, for calibration.
 *   unclear — something happened, but not cleanly enough to trust.
 *
 * The player's insight is what makes this work: hammer blows *are* picked up,
 * and that is a feature. Counting them is what lets calibration happen with no
 * buttons and no free hand (D19).
 *
 * `na` versus `tap` is decided by NSDF **clarity**. A `na` is a tonal stroke
 * on a harmonic membrane and scores high; a hammer blow on the braided gajra
 * is a short hard click with no clean periodic decay and scores low.
 *
 * `unclear` is decided by whether the strike **agrees with itself** across
 * sub-windows. A clean stroke is periodic throughout; one spoiled by a room
 * reflection or a glancing hit is not. Those are dropped rather than shown,
 * because a confident wrong number is the worst thing this app can do.
 */

import { detectPitchRobust, DAYAN_F_MIN, DAYAN_F_MAX } from "@/lib/audio/mpm";
import type { Onset } from "./session";

/** A `na` must beat this NSDF clarity. Below it, the onset is taken as a tap. */
export const DEFAULT_NA_CLARITY = 0.78;

/**
 * Sub-window estimates must agree within this many cents. Generous enough for
 * a real drum's slight inharmonicity, tight enough to catch a spoiled strike.
 */
export const MAX_DISAGREEMENT_CENTS = 18;

/**
 * How far from the target a reading is still accepted, in cents. Wide enough
 * to show a badly-off drum; far too narrow for a 3rd-harmonic error (+1902
 * cents) to slip through (RULES B3).
 */
export const TARGET_WINDOW_CENTS = 500;

export interface ClassifyOptions {
  /** When known, constrains the search and keeps octave errors impossible. */
  targetHz?: number;
  naClarity?: number;
}

export interface Classification {
  /** null means unclear — ignore it entirely, do not move the display. */
  onset: Onset | null;
  hz: number;
  clarity: number;
  agreementCents: number;
}

export function classifyOnset(
  window: Float32Array,
  sampleRate: number,
  options: ClassifyOptions = {},
): Classification {
  const { targetHz, naClarity = DEFAULT_NA_CLARITY } = options;

  const band = targetHz
    ? (() => {
        const factor = Math.pow(2, TARGET_WINDOW_CENTS / 1200);
        return { fMin: targetHz / factor, fMax: targetHz * factor };
      })()
    : { fMin: DAYAN_F_MIN, fMax: DAYAN_F_MAX };

  const result = detectPitchRobust(window, sampleRate, {
    ...band,
    // Let low-clarity results through so we can see them and call them taps,
    // rather than the detector silently discarding them.
    clarityThreshold: 0,
  });

  const base = {
    hz: result.hz,
    clarity: result.clarity,
    agreementCents: result.agreementCents,
  };

  // Not tonal enough to be a na — almost certainly the hammer.
  if (result.hz <= 0 || result.clarity < naClarity) {
    return { ...base, onset: { kind: "tap" } };
  }

  // Tonal, but the strike did not agree with itself. Something interfered.
  if (result.agreementCents > MAX_DISAGREEMENT_CENTS) {
    return { ...base, onset: null };
  }

  return { ...base, onset: { kind: "na", hz: result.hz, clarity: result.clarity } };
}
