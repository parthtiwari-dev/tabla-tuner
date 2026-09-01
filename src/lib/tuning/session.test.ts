import { describe, it, expect } from "vitest";
import {
  TuningSession,
  spread,
  displayCents,
  centsPerTap,
  TRAIL_LENGTH,
  type Strike,
  type Correction,
} from "./session";
import { classifyOnset } from "./classify";
import { targetFor, suggestTarget, noteOptions, isReachable } from "./notes";
import { shiftCents, midiToHz } from "@/lib/audio/cents";
import { synthNa, synthStroke } from "@/lib/audio/__fixtures__/synth";

const TARGET = 277.18; // C#4
const SR = 48000;

function strikesAt(cents: number[]): Strike[] {
  return cents.map((c, i) => ({
    id: i,
    hz: shiftCents(TARGET, c),
    cents: c,
    clarity: 0.9,
    at: i,
  }));
}

/** Feed the session a na at a given deviation from target. */
function na(session: TuningSession, cents: number, clarity = 0.9) {
  session.observe({ kind: "na", hz: shiftCents(TARGET, cents), clarity });
}

describe("spread", () => {
  it("is the gap between flattest and sharpest", () => {
    expect(spread(strikesAt([-14, 3, 8, -2]))).toBeCloseTo(22, 6);
  });

  it("ignores which position produced which reading", () => {
    // The point of D16: evenness needs no position identity.
    expect(spread(strikesAt([-14, 3, 8, -2]))).toBeCloseTo(
      spread(strikesAt([8, -2, -14, 3])),
      10,
    );
  });
});

describe("displayCents", () => {
  it("is the latest reading when there is only one", () => {
    expect(displayCents(strikesAt([12]))).toBeCloseTo(12, 6);
  });

  it("medians away a single outlier on one spot", () => {
    // The complaint: same place, same stroke, one reading jumps. The median
    // of three ignores it instead of showing it.
    expect(displayCents(strikesAt([4, -6, -5]))).toBeCloseTo(-5, 6);
  });

  it("follows you immediately when you move to a different spot", () => {
    // A median across two different places describes nowhere, so a wide
    // spread means show the latest.
    expect(displayCents(strikesAt([40, -8, -6]))).toBeCloseTo(40, 6);
  });

  it("stays smooth while readings cluster", () => {
    expect(displayCents(strikesAt([-12, -10, -11]))).toBeCloseTo(-11, 6);
  });

  it("is null with nothing to show", () => {
    expect(displayCents([])).toBeNull();
  });
});

describe("automatic tap counting", () => {
  it("books a correction from na, taps, na — with nothing pressed", () => {
    const session = new TuningSession(TARGET);
    na(session, -20);
    session.observe({ kind: "tap" });
    session.observe({ kind: "tap" });
    na(session, -6);

    const corrections = session.allCorrections;
    expect(corrections).toHaveLength(1);
    expect(corrections[0].taps).toBe(2);
    expect(corrections[0].before).toBeCloseTo(-20, 4);
    expect(corrections[0].after).toBeCloseTo(-6, 4);
  });

  it("does not book a correction when no taps happened", () => {
    // Just going round the drum playing na must not look like corrections.
    const session = new TuningSession(TARGET);
    na(session, -20);
    na(session, -6);
    na(session, 4);
    expect(session.allCorrections).toHaveLength(0);
  });

  it("ignores a run of taps too long to be one correction", () => {
    // A pause, a conversation, the drum being set down.
    const session = new TuningSession(TARGET);
    na(session, -20);
    for (let i = 0; i < 12; i++) session.observe({ kind: "tap" });
    na(session, -6);
    expect(session.allCorrections).toHaveLength(0);
  });

  it("ignores movement too small to distinguish from noise", () => {
    const session = new TuningSession(TARGET);
    na(session, -20);
    session.observe({ kind: "tap" });
    na(session, -19.5);
    expect(session.allCorrections).toHaveLength(0);
  });

  it("resets the tap count after each na", () => {
    const session = new TuningSession(TARGET);
    na(session, -20);
    session.observe({ kind: "tap" });
    na(session, -13);
    session.observe({ kind: "tap" });
    session.observe({ kind: "tap" });
    na(session, 1);

    const corrections = session.allCorrections;
    expect(corrections).toHaveLength(2);
    expect(corrections[0].taps).toBe(2); // newest first
    expect(corrections[1].taps).toBe(1);
  });

  it("exposes pending taps live", () => {
    const session = new TuningSession(TARGET);
    na(session, -20);
    session.observe({ kind: "tap" });
    session.observe({ kind: "tap" });
    expect(session.snapshot().pendingTaps).toBe(2);
    na(session, -6);
    expect(session.snapshot().pendingTaps).toBe(0);
  });
});

describe("centsPerTap", () => {
  it("returns null until there is enough evidence", () => {
    expect(centsPerTap([{ before: -20, after: -6, taps: 2 }])).toBeNull();
  });

  it("learns the hammer end to end through the session", () => {
    const session = new TuningSession(TARGET);
    // Four corrections, each 7 cents per tap.
    const steps: Array<[number, number, number]> = [
      [-28, -14, 2],
      [-14, 0, 2],
      [-21, 0, 3],
      [-7, 0, 1],
    ];
    for (const [before, after, taps] of steps) {
      na(session, before);
      for (let i = 0; i < taps; i++) session.observe({ kind: "tap" });
      na(session, after);
    }
    expect(session.snapshot().centsPerTap).toBeCloseTo(7, 5);
  });

  it("uses the median so one slipped hammer does not skew it", () => {
    const corrections: Correction[] = [
      { before: -14, after: 0, taps: 2 }, // 7
      { before: -21, after: 0, taps: 3 }, // 7
      { before: -80, after: 0, taps: 1 }, // 80 — a mis-hit
      { before: -7, after: 0, taps: 1 }, // 7
    ];
    expect(centsPerTap(corrections)).toBeCloseTo(7, 5);
  });
});

describe("TuningSession", () => {
  it("records deviation from the target", () => {
    const session = new TuningSession(TARGET);
    na(session, -14);
    expect(session.snapshot().latest!.cents).toBeCloseTo(-14, 4);
  });

  it("keeps a rolling trail of one turn", () => {
    const session = new TuningSession(TARGET);
    for (let i = 0; i < 25; i++) na(session, i);
    expect(session.trail.length).toBe(TRAIL_LENGTH);
    expect(session.all.length).toBe(25);
  });

  it("undoes a mis-hit", () => {
    const session = new TuningSession(TARGET);
    na(session, 5);
    na(session, 200);
    session.undo();
    expect(session.snapshot().latest!.cents).toBeCloseTo(5, 4);
  });

  it("exposes a smoothed value, not the raw latest", () => {
    const session = new TuningSession(TARGET);
    na(session, -6);
    na(session, -5);
    na(session, 4); // outlier
    expect(session.snapshot().latest!.cents).toBeCloseTo(4, 4);
    expect(session.snapshot().cents).toBeCloseTo(-5, 4);
  });

  it("keeps calibration but drops readings when the target changes", () => {
    const session = new TuningSession(TARGET);
    na(session, -20);
    session.observe({ kind: "tap" });
    na(session, -6);
    session.observe({ kind: "tap" });
    na(session, 2);
    session.observe({ kind: "tap" });
    na(session, 10);

    const before = session.allCorrections.length;
    session.retarget(293.66);
    expect(session.trail).toHaveLength(0);
    expect(session.allCorrections).toHaveLength(before);
  });

  it("carries calibration in from a previous session", () => {
    const prior: Correction[] = [
      { before: -14, after: 0, taps: 2 },
      { before: -21, after: 0, taps: 3 },
      { before: -7, after: 0, taps: 1 },
    ];
    const session = new TuningSession(TARGET, 10, prior);
    expect(session.snapshot().centsPerTap).toBeCloseTo(7, 5);
  });
});

describe("classifyOnset", () => {
  it("calls a clean na a na", () => {
    const result = classifyOnset(synthNa(TARGET, { sampleRate: SR }), SR, {
      targetHz: TARGET,
    });
    expect(result.onset?.kind).toBe("na");
  });

  it("calls a noisy inharmonic click a tap", () => {
    // Stand-in for a hammer blow on the gajra: short, hard, no clean periodic
    // decay, so the NSDF clarity stays low.
    const n = Math.round(0.25 * SR);
    const click = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      click[i] = (Math.random() * 2 - 1) * Math.exp(-i / (0.01 * SR));
    }
    const result = classifyOnset(click, SR, { targetHz: TARGET });
    expect(result.onset?.kind).toBe("tap");
  });

  it("still classifies a na correctly with no target yet", () => {
    const result = classifyOnset(synthNa(TARGET, { sampleRate: SR }), SR);
    expect(result.onset?.kind).toBe("na");
    expect(result.hz).toBeCloseTo(TARGET, 0);
  });

  it("reports clarity even for a rejected onset, so it can be shown", () => {
    const weak = synthStroke({
      f0: TARGET,
      sampleRate: SR,
      partialGains: [1, 0.5, 0.3, 0.2, 0.1],
      noiseFloor: 0.9,
    });
    const result = classifyOnset(weak, SR, { targetHz: TARGET });
    expect(result.clarity).toBeGreaterThanOrEqual(0);
    expect(result.clarity).toBeLessThanOrEqual(1);
  });
});

describe("target notes", () => {
  it("picks the octave nearest the drum", () => {
    expect(targetFor(1, 275)).toBeCloseTo(277.18, 1);
  });

  it("does not jump an octave for a distant pitch class", () => {
    expect(targetFor(11, 277.18)).toBeCloseTo(246.94, 1);
  });

  it("suggests the note the drum is already closest to", () => {
    const suggestion = suggestTarget(shiftCents(277.18, 12));
    expect(suggestion.name).toBe("C#");
    expect(suggestion.distanceCents).toBeCloseTo(-12, 0);
  });

  it("flags targets outside what a dayan can reach", () => {
    expect(isReachable(midiToHz(48))).toBe(false); // C3 — too low
    expect(isReachable(277.18)).toBe(true);
  });

  it("offers all twelve", () => {
    expect(noteOptions(277.18)).toHaveLength(12);
  });
});
