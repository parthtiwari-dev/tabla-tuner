/**
 * Pitch detection by the McLeod Pitch Method (normalised square difference).
 *
 * Written by hand rather than pulled from a library (DECISIONS D10) because
 * the part libraries get wrong on tabla is exactly the octave logic, and we
 * need to control it.
 *
 * ## Why time-domain, and why the band matters
 *
 * The `Na` stroke has a suppressed fundamental and a dominant 3rd harmonic
 * (RESEARCH.md section 3). A spectral peak-picker reports that 3rd harmonic —
 * a twelfth too high. Autocorrelation-family methods are more robust because a
 * signal built from harmonics 2,3,4,5 of f0 is still *periodic at f0*, so the
 * NSDF peaks at the true period even when the fundamental is weak. That is the
 * same reconstruction the ear performs.
 *
 * That robustness fails when one partial dominates so heavily that the signal
 * is near-sinusoidal at 3*f0. So the real guard is structural: constrain the
 * search band (RULES B3). A dayan lives in roughly 150-400 Hz, so a candidate
 * at 3*f0 = 780 Hz simply cannot be returned. During a survey the band narrows
 * further to +/-200 cents around the anchor, which makes octave error
 * impossible rather than merely unlikely.
 */

export interface PitchOptions {
  /** Lowest frequency considered, Hz. */
  fMin?: number;
  /** Highest frequency considered, Hz. */
  fMax?: number;
  /**
   * Fraction of the strongest in-band NSDF peak that a peak must reach to be
   * eligible. Picking the *first* eligible peak (shortest period) avoids
   * locking onto a sub-harmonic. McLeod suggests 0.8-0.9.
   */
  peakThreshold?: number;
  /** Below this clarity the result is rejected outright (RULES B4). */
  clarityThreshold?: number;
}

export interface PitchResult {
  /** Detected frequency, or 0 when nothing was found. */
  hz: number;
  /** NSDF value at the chosen peak, 0..1. Our confidence measure. */
  clarity: number;
  /** Refined lag in samples. */
  tau: number;
  /** True when a competing octave candidate was nearly as strong. */
  ambiguous: boolean;
  /** Set when hz is 0, for diagnostics. */
  reason?: "too-quiet" | "no-peak-in-band" | "below-clarity";
}

export const DAYAN_F_MIN = 150;
export const DAYAN_F_MAX = 400;

const DEFAULTS: Required<PitchOptions> = {
  fMin: DAYAN_F_MIN,
  fMax: DAYAN_F_MAX,
  peakThreshold: 0.9,
  clarityThreshold: 0.6,
};

/**
 * Normalised square difference function, lags 0..maxTau.
 *
 *   nsdf[t] = 2 * sum(x[j] * x[j+t]) / sum(x[j]^2 + x[j+t]^2)
 *
 * Ranges -1..1; 1 means perfect periodicity at that lag. The normalisation is
 * what makes the value comparable across lags and usable as a confidence.
 */
export function nsdf(x: Float32Array, maxTau: number): Float64Array {
  const n = x.length;
  const limit = Math.min(maxTau, n - 1);
  const out = new Float64Array(limit + 1);

  for (let tau = 0; tau <= limit; tau++) {
    let acf = 0;
    let div = 0;
    for (let j = 0; j < n - tau; j++) {
      const a = x[j];
      const b = x[j + tau];
      acf += a * b;
      div += a * a + b * b;
    }
    out[tau] = div > 0 ? (2 * acf) / div : 0;
  }
  return out;
}

interface KeyMax {
  tau: number;
  value: number;
}

/**
 * MPM key maxima: within each region bounded by a positively-sloped zero
 * crossing and the following negatively-sloped one, keep only the highest
 * point. This collapses the ripple around each true period peak to one
 * candidate.
 */
export function findKeyMaxima(f: Float64Array): KeyMax[] {
  const maxima: KeyMax[] = [];
  const n = f.length;

  // Skip the peak at tau=0, which is always 1.
  let tau = 1;
  while (tau < n && f[tau] > 0) tau++;
  while (tau < n && f[tau] <= 0) tau++;

  let bestTau = -1;
  let bestVal = -Infinity;

  for (; tau < n; tau++) {
    if (f[tau] > bestVal) {
      bestVal = f[tau];
      bestTau = tau;
    }
    // Region ends on the downward zero crossing.
    if (f[tau] <= 0 && bestTau >= 0) {
      maxima.push({ tau: bestTau, value: bestVal });
      bestTau = -1;
      bestVal = -Infinity;
      while (tau < n && f[tau] <= 0) tau++;
      tau--;
    }
  }
  if (bestTau >= 0) maxima.push({ tau: bestTau, value: bestVal });

  return maxima;
}

/**
 * Parabolic interpolation around an integer peak, for sub-sample lag
 * resolution. Without this the pitch quantises to whatever the sample rate
 * allows, which at 250 Hz and 48 kHz is around 6 cents per lag step — far too
 * coarse for our +/-5 cent repeatability target.
 */
function refinePeak(f: Float64Array, i: number): { tau: number; value: number } {
  if (i <= 0 || i >= f.length - 1) return { tau: i, value: f[i] };

  const y0 = f[i - 1];
  const y1 = f[i];
  const y2 = f[i + 1];
  const denom = y0 - 2 * y1 + y2;
  if (denom === 0) return { tau: i, value: y1 };

  const delta = (0.5 * (y0 - y2)) / denom;
  // Guard against a degenerate fit throwing the estimate out of the bin.
  if (!Number.isFinite(delta) || Math.abs(delta) > 1) return { tau: i, value: y1 };

  return { tau: i + delta, value: y1 - 0.25 * (y0 - y2) * delta };
}

function rms(x: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i] * x[i];
  return Math.sqrt(sum / x.length);
}

/**
 * Detect the pitch of a windowed signal.
 *
 * `samples` should be the decay tail of a strike, not the attack — the first
 * 20-30 ms is broadband noise with no usable pitch (RULES A3).
 */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  options: PitchOptions = {},
): PitchResult {
  const opts = { ...DEFAULTS, ...options };

  if (rms(samples) < 1e-5) {
    return { hz: 0, clarity: 0, tau: 0, ambiguous: false, reason: "too-quiet" };
  }

  const tauMin = Math.max(2, Math.floor(sampleRate / opts.fMax));
  const tauMax = Math.ceil(sampleRate / opts.fMin);

  // Compute a little past tauMax so a peak sitting on the boundary still has
  // both neighbours available for interpolation.
  const f = nsdf(samples, Math.min(tauMax + 2, Math.floor(samples.length / 2)));
  const maxima = findKeyMaxima(f);

  const inBand = maxima.filter((m) => m.tau >= tauMin && m.tau <= tauMax);
  if (inBand.length === 0) {
    return { hz: 0, clarity: 0, tau: 0, ambiguous: false, reason: "no-peak-in-band" };
  }

  // Threshold against the strongest *in-band* peak, not the global one:
  // the global maximum may sit outside the band we are allowed to return.
  const strongest = inBand.reduce((a, b) => (b.value > a.value ? b : a));
  const cutoff = strongest.value * opts.peakThreshold;
  const chosen = inBand.find((m) => m.value >= cutoff) ?? strongest;

  const refined = refinePeak(f, chosen.tau);
  const clarity = Math.max(0, Math.min(1, refined.value));

  if (clarity < opts.clarityThreshold) {
    return {
      hz: 0,
      clarity,
      tau: refined.tau,
      ambiguous: false,
      reason: "below-clarity",
    };
  }

  // Flag, rather than silently resolve, a competing octave candidate. Showing
  // uncertainty as uncertainty beats a confident wrong number (RULES B4/D6).
  const ambiguous = inBand.some(
    (m) =>
      m.tau !== chosen.tau &&
      Math.abs(Math.log2(m.tau / chosen.tau)) > 0.8 &&
      Math.abs(Math.log2(m.tau / chosen.tau)) < 1.2 &&
      m.value >= chosen.value * 0.85,
  );

  return {
    hz: sampleRate / refined.tau,
    clarity,
    tau: refined.tau,
    ambiguous,
  };
}

/**
 * Survey-mode detection: search only within `centsWindow` of a known anchor
 * frequency. This is the structural octave guard (RULES B3) and the reason the
 * evenness survey can trust `Na` strokes at all.
 */
export function detectPitchNearAnchor(
  samples: Float32Array,
  sampleRate: number,
  anchorHz: number,
  centsWindow = 200,
  options: PitchOptions = {},
): PitchResult {
  const factor = Math.pow(2, centsWindow / 1200);
  return detectPitch(samples, sampleRate, {
    ...options,
    fMin: anchorHz / factor,
    fMax: anchorHz * factor,
  });
}
