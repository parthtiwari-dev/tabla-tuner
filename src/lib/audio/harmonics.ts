/**
 * Harmonic content analysis.
 *
 * Two jobs:
 *
 * 1. Diagnostics — seeing the partial structure is how we tell a healthy
 *    `Tun` from a fundamental-suppressed `Na`.
 * 2. The Na/Tun comparison (DECISIONS D12). On a healthy dayan the syahi's
 *    mass-loading puts the partials at 1:2:3:4:5 and both strokes read the
 *    same note. A persistent mismatch points at the instrument — a wrong
 *    thickness ratio between syahi and edge — not at the tuning
 *    (RESEARCH.md section 3). Reported as a hint, never a diagnosis.
 */

import { magnitudeSpectrum, nextPowerOfTwo, hzToBin } from "./fft";

export interface Partial {
  /** Harmonic number, 1-based. */
  k: number;
  /** Ideal frequency, k * f0. */
  expectedHz: number;
  /** Where the actual local peak was found. */
  measuredHz: number;
  /** Peak magnitude, linear. */
  magnitude: number;
  /** Magnitude relative to the strongest partial found, 0..1. */
  relative: number;
  /** Cents between expected and measured. Inharmonicity of this partial. */
  deviationCents: number;
}

export interface HarmonicProfile {
  f0: number;
  partials: Partial[];
  /**
   * Mean absolute deviation of partials 2..n from ideal integer multiples,
   * in cents. Low means the drum really is behaving harmonically.
   */
  inharmonicityCents: number;
  /**
   * Magnitude of the fundamental relative to the strongest partial.
   * Near 1 is `Tun`-like; well below 1 is `Na`-like.
   */
  fundamentalStrength: number;
  /** Which partial dominates. For `Na` this is typically 3. */
  dominantPartial: number;
}

/**
 * Find the strongest bin within a window around `hz`, and interpolate its true
 * position parabolically.
 */
function peakNear(
  mag: Float64Array,
  hz: number,
  fftSize: number,
  sampleRate: number,
  searchCents: number,
): { hz: number; magnitude: number } {
  const factor = Math.pow(2, searchCents / 1200);
  const lo = Math.max(1, Math.floor(hzToBin(hz / factor, fftSize, sampleRate)));
  const hi = Math.min(mag.length - 2, Math.ceil(hzToBin(hz * factor, fftSize, sampleRate)));

  if (lo > hi) return { hz, magnitude: 0 };

  let bestBin = lo;
  for (let i = lo; i <= hi; i++) {
    if (mag[i] > mag[bestBin]) bestBin = i;
  }

  // Parabolic refinement in the log-magnitude domain.
  const y0 = Math.log(mag[bestBin - 1] + 1e-12);
  const y1 = Math.log(mag[bestBin] + 1e-12);
  const y2 = Math.log(mag[bestBin + 1] + 1e-12);
  const denom = y0 - 2 * y1 + y2;
  const delta = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  const refinedBin = bestBin + (Math.abs(delta) <= 1 ? delta : 0);

  return {
    hz: (refinedBin * sampleRate) / fftSize,
    magnitude: mag[bestBin],
  };
}

export function analyseHarmonics(
  samples: Float32Array,
  sampleRate: number,
  f0: number,
  count = 5,
  searchCents = 60,
): HarmonicProfile {
  // Generous zero-padding: bin spacing must be fine enough to separate
  // partials that sit only tens of cents apart.
  const fftSize = Math.max(8192, nextPowerOfTwo(samples.length) * 2);
  const mag = magnitudeSpectrum(samples, fftSize);

  const raw: Omit<Partial, "relative">[] = [];
  for (let k = 1; k <= count; k++) {
    const expectedHz = f0 * k;
    if (expectedHz >= sampleRate / 2) break;

    const found = peakNear(mag, expectedHz, fftSize, sampleRate, searchCents);
    raw.push({
      k,
      expectedHz,
      measuredHz: found.hz,
      magnitude: found.magnitude,
      deviationCents: found.magnitude > 0 ? 1200 * Math.log2(found.hz / expectedHz) : 0,
    });
  }

  const peak = Math.max(...raw.map((p) => p.magnitude), 1e-12);
  const partials: Partial[] = raw.map((p) => ({ ...p, relative: p.magnitude / peak }));

  const upper = partials.filter((p) => p.k > 1 && p.magnitude > peak * 0.05);
  const inharmonicityCents = upper.length
    ? upper.reduce((s, p) => s + Math.abs(p.deviationCents), 0) / upper.length
    : 0;

  const dominant = partials.reduce((a, b) => (b.magnitude > a.magnitude ? b : a), partials[0]);

  return {
    f0,
    partials,
    inharmonicityCents,
    fundamentalStrength: partials[0] ? partials[0].relative : 0,
    dominantPartial: dominant ? dominant.k : 0,
  };
}

/**
 * Compare a `Na` reading against a `Tun` reading.
 *
 * A mismatch beyond `toleranceCents` on an otherwise evenly tuned drum
 * suggests the syahi-to-edge thickness relationship is off. This is a hint to
 * show the player, not a verdict (RULES C4/C5).
 */
export interface StrokeComparison {
  tunHz: number;
  naHz: number;
  differenceCents: number;
  matched: boolean;
}

export function compareStrokes(
  tunHz: number,
  naHz: number,
  toleranceCents = 25,
): StrokeComparison {
  const differenceCents = 1200 * Math.log2(naHz / tunHz);
  return {
    tunHz,
    naHz,
    differenceCents,
    matched: Math.abs(differenceCents) <= toleranceCents,
  };
}
