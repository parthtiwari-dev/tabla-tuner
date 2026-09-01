/**
 * Synthetic tabla strokes for testing without a drum in the room (RULES E4).
 *
 * The dayan's syahi mass-loads the membrane so the partials land on a near
 * integer series, 1:2:3:4:5 (RESEARCH.md section 3). That is what these model.
 * The two presets differ only in partial *balance*:
 *
 *   tun - strong fundamental, weaker upper partials
 *   na  - fundamental suppressed ~20 dB, 3rd partial dominant
 *
 * The `na` preset is the important one. A detector that passes `tun` but fails
 * `na` is the exact failure mode that makes generic tuners useless on tabla.
 */

export interface StrokeOptions {
  sampleRate?: number;
  f0: number;
  durationMs?: number;
  /** Linear gain per partial, index 0 is the fundamental. */
  partialGains?: number[];
  /** Base decay in seconds; higher partials decay faster. */
  decaySeconds?: number;
  /** Broadband attack noise, as a fraction of peak amplitude. */
  attackNoise?: number;
  /** Steady background hiss, as a fraction of peak amplitude. */
  noiseFloor?: number;
  /** Slight stretch of upper partials, in cents per harmonic. Real heads are not perfect. */
  inharmonicityCents?: number;
  seed?: number;
}

export const TUN_GAINS = [1.0, 0.55, 0.35, 0.2, 0.12];

/** Fundamental at 0.1 (-20 dB) against a dominant 3rd partial. */
export const NA_GAINS = [0.1, 0.45, 1.0, 0.4, 0.18];

/** Deterministic PRNG so fixtures are reproducible across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function synthStroke(options: StrokeOptions): Float32Array {
  const {
    sampleRate = 48000,
    f0,
    durationMs = 600,
    partialGains = TUN_GAINS,
    decaySeconds = 0.45,
    attackNoise = 0,
    noiseFloor = 0,
    inharmonicityCents = 0,
    seed = 12345,
  } = options;

  const n = Math.round((durationMs / 1000) * sampleRate);
  const out = new Float32Array(n);
  const rand = mulberry32(seed);

  // Fixed phase offsets per partial: a real strike is not phase-aligned, and
  // an all-cosine stack is an unrealistically easy signal to analyse.
  const phases = partialGains.map((_, i) => (i * 1.7) % (2 * Math.PI));

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (let p = 0; p < partialGains.length; p++) {
      const k = p + 1;
      const stretch = Math.pow(2, (inharmonicityCents * p) / 1200);
      const freq = f0 * k * stretch;
      if (freq >= sampleRate / 2) continue;

      // Higher partials die away faster, as on a real membrane.
      const decay = Math.exp(-t / (decaySeconds / Math.sqrt(k)));
      sample += partialGains[p] * decay * Math.sin(2 * Math.PI * freq * t + phases[p]);
    }

    if (attackNoise > 0) {
      // Short broadband burst, gone within ~15 ms.
      const burst = Math.exp(-t / 0.006);
      sample += attackNoise * burst * (rand() * 2 - 1);
    }
    if (noiseFloor > 0) {
      sample += noiseFloor * (rand() * 2 - 1);
    }

    out[i] = sample;
  }

  // Normalise so tests are amplitude-independent.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) {
    for (let i = 0; i < n; i++) out[i] /= peak;
  }

  return out;
}

export function synthTun(f0: number, opts: Partial<StrokeOptions> = {}): Float32Array {
  return synthStroke({ f0, partialGains: TUN_GAINS, ...opts });
}

export function synthNa(f0: number, opts: Partial<StrokeOptions> = {}): Float32Array {
  return synthStroke({ f0, partialGains: NA_GAINS, decaySeconds: 0.3, ...opts });
}

/** A silent buffer, for testing rejection paths. */
export function synthSilence(durationMs = 500, sampleRate = 48000): Float32Array {
  return new Float32Array(Math.round((durationMs / 1000) * sampleRate));
}

/**
 * A sequence of strikes separated by silence, for onset-detection tests.
 * Returns the buffer and the sample index where each strike begins.
 */
export function synthStrikeSequence(
  count: number,
  f0: number,
  gapMs = 700,
  sampleRate = 48000,
): { samples: Float32Array; onsets: number[] } {
  const gap = Math.round((gapMs / 1000) * sampleRate);
  const strikes = Array.from({ length: count }, (_, i) =>
    synthNa(f0, { sampleRate, attackNoise: 0.6, seed: 1000 + i }),
  );

  const leadIn = Math.round(0.1 * sampleRate);
  const total = leadIn + strikes.reduce((s, x) => s + x.length, 0) + gap * count;
  const samples = new Float32Array(total);
  const onsets: number[] = [];

  let pos = leadIn;
  for (const strike of strikes) {
    onsets.push(pos);
    samples.set(strike, pos);
    pos += strike.length + gap;
  }

  return { samples, onsets };
}
