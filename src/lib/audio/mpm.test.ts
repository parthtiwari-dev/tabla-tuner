import { describe, it, expect } from "vitest";
import { detectPitch, detectPitchNearAnchor, nsdf, findKeyMaxima } from "./mpm";
import { centsBetween, shiftCents } from "./cents";
import {
  synthTun,
  synthNa,
  synthSilence,
  synthStroke,
} from "./__fixtures__/synth";

const SR = 48000;

/** Absolute cents error between a detected and a true frequency. */
function centsErr(detected: number, truth: number): number {
  return Math.abs(centsBetween(truth, detected));
}

describe("nsdf", () => {
  it("is 1 at lag 0", () => {
    const f = nsdf(synthTun(260, { sampleRate: SR }), 100);
    expect(f[0]).toBeCloseTo(1, 5);
  });

  it("peaks at the period of a pure sine", () => {
    const sr = 48000;
    const hz = 250;
    const n = 4096;
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = Math.sin((2 * Math.PI * hz * i) / sr);

    const f = nsdf(x, 400);
    const period = sr / hz; // 192 samples
    const maxima = findKeyMaxima(f);
    const first = maxima[0];

    expect(Math.abs(first.tau - period)).toBeLessThan(2);
    expect(first.value).toBeGreaterThan(0.95);
  });
});

describe("detectPitch on a Tun stroke", () => {
  // The easy case: a real fundamental is present.
  it.each([185, 220, 261.63, 277.18, 311.13, 330])(
    "finds %f Hz within 1 cent",
    (f0) => {
      const result = detectPitch(synthTun(f0, { sampleRate: SR }), SR);
      expect(result.hz).toBeGreaterThan(0);
      expect(centsErr(result.hz, f0)).toBeLessThan(1);
      expect(result.clarity).toBeGreaterThan(0.8);
    },
  );
});

describe("detectPitch on a Na stroke", () => {
  // THE test. Fundamental suppressed 20 dB, 3rd partial dominant. A detector
  // that reports ~3x here is the exact failure that makes generic tuners
  // useless on tabla (RESEARCH.md section 3).
  it.each([185, 220, 261.63, 277.18, 311.13, 330])(
    "finds %f Hz within 1 cent despite a suppressed fundamental",
    (f0) => {
      const result = detectPitch(synthNa(f0, { sampleRate: SR }), SR);
      expect(result.hz).toBeGreaterThan(0);
      expect(centsErr(result.hz, f0)).toBeLessThan(1);
    },
  );

  it("does not report the 3rd harmonic", () => {
    const f0 = 261.63;
    const result = detectPitch(synthNa(f0, { sampleRate: SR }), SR);
    expect(centsErr(result.hz, f0 * 3)).toBeGreaterThan(100);
  });

  it("survives an even more extreme fundamental suppression", () => {
    const f0 = 261.63;
    const samples = synthStroke({
      f0,
      sampleRate: SR,
      partialGains: [0.02, 0.3, 1.0, 0.5, 0.25], // -34 dB fundamental
    });
    const result = detectPitch(samples, SR);
    expect(centsErr(result.hz, f0)).toBeLessThan(2);
  });
});

describe("robustness", () => {
  it("tolerates attack noise and a background floor", () => {
    const f0 = 277.18;
    const samples = synthNa(f0, { sampleRate: SR, attackNoise: 0.8, noiseFloor: 0.02 });
    // Skip the first 30 ms, as the real pipeline does (RULES A3).
    const tail = samples.subarray(Math.round(0.03 * SR));
    const result = detectPitch(tail, SR);
    expect(centsErr(result.hz, f0)).toBeLessThan(5);
  });

  it("gives a usable absolute reading under inharmonicity", () => {
    // Real heads are not perfectly harmonic. With stretched partials there is
    // no single true period, so the estimate lands on a weighted compromise
    // and absolute accuracy degrades. ~20 cents is acceptable here because
    // absolute pitch is anchored on Tun, and evenness does not depend on it —
    // see the relative test below, which is the property we actually rely on.
    const f0 = 261.63;
    const samples = synthNa(f0, { sampleRate: SR, inharmonicityCents: 8 });
    const result = detectPitch(samples, SR);
    expect(result.hz).toBeGreaterThan(0);
    expect(centsErr(result.hz, f0)).toBeLessThan(25);
  });

  it("preserves RELATIVE differences under inharmonicity", () => {
    // This is the survey's core claim, and the reason the whole project works
    // (DECISIONS D3). The same drum carries the same partial stretch at every
    // ghar, so a bias that ruins absolute accuracy cancels almost exactly when
    // comparing ghar to ghar. Evenness is a relative measurement.
    const base = 261.63;
    const deviations = [0, 12, 27, -18, 41, -35]; // plausible per-ghar spread

    const readings = deviations.map((cents) => {
      const samples = synthNa(shiftCents(base, cents), {
        sampleRate: SR,
        inharmonicityCents: 8,
        noiseFloor: 0.02,
      });
      return detectPitch(samples, SR).hz;
    });

    expect(readings.every((r) => r > 0)).toBe(true);

    const reference = readings[0];
    deviations.forEach((expected, i) => {
      const measured = centsBetween(reference, readings[i]);
      expect(Math.abs(measured - expected)).toBeLessThan(3);
    });
  });

  it("works at 44.1 kHz as well as 48 kHz", () => {
    const f0 = 261.63;
    const sr = 44100;
    const result = detectPitch(synthNa(f0, { sampleRate: sr }), sr);
    expect(centsErr(result.hz, f0)).toBeLessThan(1);
  });

  it("is repeatable across different noise seeds within 5 cents", () => {
    // Mirrors the M1 go/no-go: ten strikes must agree within +/-5 cents.
    const f0 = 261.63;
    const readings = Array.from({ length: 10 }, (_, i) => {
      const s = synthNa(f0, { sampleRate: SR, noiseFloor: 0.03, attackNoise: 0.5, seed: i });
      return detectPitch(s.subarray(Math.round(0.03 * SR)), SR).hz;
    });

    expect(readings.every((r) => r > 0)).toBe(true);
    const spread = Math.abs(centsBetween(Math.min(...readings), Math.max(...readings)));
    expect(spread).toBeLessThan(5);
  });
});

describe("rejection", () => {
  it("returns nothing for silence rather than guessing", () => {
    const result = detectPitch(synthSilence(500, SR), SR);
    expect(result.hz).toBe(0);
    expect(result.reason).toBe("too-quiet");
  });

  it("rejects noise instead of reporting a confident wrong number", () => {
    const n = SR * 0.4;
    const noise = new Float32Array(n);
    for (let i = 0; i < n; i++) noise[i] = Math.random() * 2 - 1;

    const result = detectPitch(noise, SR);
    expect(result.hz).toBe(0);
  });

  it("reports a sub-multiple for a tone above the band, by design", () => {
    // Documents a real and unavoidable limitation. A harmonic tone at 880 Hz
    // has partials at 880/1760/2640, every one of which is also a multiple of
    // 293.33 Hz — so the signal genuinely IS periodic at 293.33, and a
    // band-limited detector is right to say so.
    //
    // This is the flip side of the property that solves the Na problem: the
    // band constraint asserts "the source is a dayan". Point it at something
    // else and you get a sub-multiple, not a rejection. Acceptable, because
    // the microphone is pointed at a dayan.
    const result = detectPitch(synthTun(880, { sampleRate: SR }), SR, {
      fMin: 150,
      fMax: 400,
    });
    expect(result.hz).toBeGreaterThan(0);
    expect(centsErr(result.hz, 880 / 3)).toBeLessThan(5);
  });
});

describe("detectPitchNearAnchor", () => {
  it("finds a pitch inside the anchor window", () => {
    const anchor = 261.63;
    const actual = 265; // ~22 cents sharp, a plausible ghar deviation
    const result = detectPitchNearAnchor(synthNa(actual, { sampleRate: SR }), SR, anchor, 200);
    expect(centsErr(result.hz, actual)).toBeLessThan(2);
  });

  it("makes the 3rd-harmonic error structurally impossible", () => {
    // Even a signal that is nearly a pure tone at 3*f0 cannot be reported as
    // 3*f0, because 3*f0 lies outside the anchor band (RULES B3).
    const f0 = 261.63;
    const nearlyPureThird = synthStroke({
      f0,
      sampleRate: SR,
      partialGains: [0.0, 0.0, 1.0, 0.0, 0.0],
    });
    const result = detectPitchNearAnchor(nearlyPureThird, SR, f0, 200);
    if (result.hz > 0) {
      expect(centsErr(result.hz, f0 * 3)).toBeGreaterThan(100);
    }
  });

  it("collapses an exact octave onto the anchor, by design", () => {
    // Same sub-multiple property as above: a harmonic tone an octave up is
    // also periodic at the anchor. Harmless in practice — a drum does not
    // jump an octave between strikes — and irrelevant to evenness, which is
    // measured relative to the anchor either way.
    const anchor = 261.63;
    const result = detectPitchNearAnchor(
      synthTun(anchor * 2, { sampleRate: SR }),
      SR,
      anchor,
      200,
    );
    expect(centsErr(result.hz, anchor)).toBeLessThan(5);
  });

  it("rejects a reading genuinely outside the anchor window", () => {
    // A minor third up is not a sub-multiple of anything in band, so there is
    // no peak to find and the detector correctly declines to answer.
    const anchor = 261.63;
    const result = detectPitchNearAnchor(
      synthTun(shiftCents(anchor, 300), { sampleRate: SR }),
      SR,
      anchor,
      100,
    );
    expect(result.hz).toBe(0);
  });
});
