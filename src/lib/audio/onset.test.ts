import { describe, it, expect } from "vitest";
import { detectStrikes, StrikeDetector } from "./onset";
import { detectPitch } from "./mpm";
import { centsBetween } from "./cents";
import { synthStrikeSequence, synthSilence, synthNa } from "./__fixtures__/synth";

const SR = 48000;

describe("StrikeDetector", () => {
  it("finds one window per strike", () => {
    const { samples, onsets } = synthStrikeSequence(5, 261.63, 700, SR);
    const windows = detectStrikes(samples, { sampleRate: SR });
    expect(windows.length).toBe(onsets.length);
  });

  it("does not double-trigger on a single strike", () => {
    // RULES A4. Without a refractory period one Na registers several times
    // and the survey's auto-advance runs away.
    const { samples } = synthStrikeSequence(1, 261.63, 900, SR);
    const windows = detectStrikes(samples, { sampleRate: SR });
    expect(windows.length).toBe(1);
  });

  it("emits nothing for silence", () => {
    const windows = detectStrikes(synthSilence(2000, SR), { sampleRate: SR });
    expect(windows).toHaveLength(0);
  });

  it("hands back a window the pitch detector can actually use", () => {
    // The integration that matters: capture -> detect, end to end.
    const f0 = 277.18;
    const { samples } = synthStrikeSequence(3, f0, 700, SR);
    const windows = detectStrikes(samples, { sampleRate: SR });

    expect(windows.length).toBe(3);
    for (const window of windows) {
      const result = detectPitch(window, SR);
      expect(result.hz).toBeGreaterThan(0);
      expect(Math.abs(centsBetween(f0, result.hz))).toBeLessThan(5);
    }
  });

  it("skips the attack transient", () => {
    const detector = new StrikeDetector({
      sampleRate: SR,
      attackSkipMs: 30,
      analysisMs: 400,
    });

    const strike = synthNa(261.63, { sampleRate: SR, attackNoise: 1.0, durationMs: 800 });
    let window: Float32Array | null = null;
    for (let i = 0; i + 1024 <= strike.length && !window; i += 1024) {
      window = detector.push(strike.subarray(i, i + 1024));
    }

    expect(window).not.toBeNull();
    expect(window!.length).toBe(Math.round(0.4 * SR));
  });

  it("adapts its floor to a noisy room without triggering", () => {
    const n = SR * 2;
    const hiss = new Float32Array(n);
    for (let i = 0; i < n; i++) hiss[i] = (Math.random() * 2 - 1) * 0.004;

    const windows = detectStrikes(hiss, { sampleRate: SR });
    expect(windows).toHaveLength(0);
  });
});
