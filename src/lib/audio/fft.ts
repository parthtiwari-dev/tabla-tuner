/**
 * Minimal radix-2 FFT and spectrum helpers.
 *
 * Used for harmonic analysis (harmonics.ts), not for pitch detection —
 * pitch comes from the time-domain NSDF in mpm.ts, which handles the
 * missing-fundamental case that a spectral peak-picker cannot.
 */

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * In-place iterative Cooley-Tukey FFT. `re` and `im` must be the same
 * power-of-two length.
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length) throw new Error("fft: re and im length mismatch");
  if (!isPowerOfTwo(n)) throw new Error(`fft: length ${n} is not a power of two`);

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;

        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + len / 2] = aRe - bRe;
        im[i + k + len / 2] = aIm - bIm;

        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** Periodic Hann window. */
export function hann(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / n));
  }
  return w;
}

/**
 * Magnitude spectrum of `samples`, zero-padded to the next power of two.
 * Returns bins 0..size/2 (inclusive of Nyquist).
 */
export function magnitudeSpectrum(
  samples: Float32Array,
  fftSize = nextPowerOfTwo(samples.length),
): Float64Array {
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const w = hann(Math.min(samples.length, fftSize));

  const n = Math.min(samples.length, fftSize);
  for (let i = 0; i < n; i++) re[i] = samples[i] * w[i];

  fft(re, im);

  const half = fftSize / 2;
  const mag = new Float64Array(half + 1);
  for (let i = 0; i <= half; i++) {
    mag[i] = Math.hypot(re[i], im[i]);
  }
  return mag;
}

/** Frequency of bin `i` for a given FFT size and sample rate. */
export function binToHz(bin: number, fftSize: number, sampleRate: number): number {
  return (bin * sampleRate) / fftSize;
}

export function hzToBin(hz: number, fftSize: number, sampleRate: number): number {
  return (hz * fftSize) / sampleRate;
}
