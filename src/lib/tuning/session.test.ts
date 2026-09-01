import { describe, it, expect } from "vitest";
import {
  TuningSession,
  spread,
  trend,
  centsPerTap,
  adviseTaps,
  TRAIL_LENGTH,
  type Strike,
  type Correction,
} from "./session";
import { targetFor, suggestTarget, noteOptions, isReachable } from "./notes";
import { shiftCents, midiToHz } from "@/lib/audio/cents";

const TARGET = 277.18; // C#4

function strikesAt(cents: number[]): Strike[] {
  // Newest-first, as the session stores them.
  return cents.map((c, i) => ({
    id: i,
    hz: shiftCents(TARGET, c),
    cents: c,
    clarity: 0.9,
    at: i,
  }));
}

describe("spread", () => {
  it("is zero for a single reading", () => {
    expect(spread(strikesAt([12]))).toBe(0);
  });

  it("is the gap between flattest and sharpest", () => {
    expect(spread(strikesAt([-14, 3, 8, -2]))).toBeCloseTo(22, 6);
  });

  it("ignores which position produced which reading", () => {
    // The whole point of D16: evenness needs no position identity.
    const a = spread(strikesAt([-14, 3, 8, -2]));
    const b = spread(strikesAt([8, -2, -14, 3]));
    expect(a).toBeCloseTo(b, 10);
  });
});

describe("trend", () => {
  it("says unknown without enough data", () => {
    expect(trend(strikesAt([1, 2, 3]))).toBe("unknown");
  });

  it("detects converging", () => {
    // Newest-first: the recent half is tight, the older half was scattered.
    const s = strikesAt([1, -1, 2, 0, 18, -15, 12, -20]);
    expect(trend(s)).toBe("converging");
  });

  it("detects diverging — the case that matters most", () => {
    // "Those last taps made it worse." Without this the player keeps hammering.
    const s = strikesAt([22, -19, 17, -25, 2, -1, 3, 0]);
    expect(trend(s)).toBe("diverging");
  });

  it("calls small changes steady rather than guessing", () => {
    const s = strikesAt([5, -4, 6, -5, 5, -5, 6, -4]);
    expect(trend(s)).toBe("steady");
  });
});

describe("centsPerTap", () => {
  it("returns null until there is enough evidence", () => {
    const few: Correction[] = [{ before: -20, after: -6, taps: 2, direction: "down" }];
    expect(centsPerTap(few)).toBeNull();
  });

  it("learns the player's hammer from their own corrections", () => {
    const corrections: Correction[] = [
      { before: -20, after: -6, taps: 2, direction: "down" }, // 7.0 per tap
      { before: -14, after: 0, taps: 2, direction: "down" }, // 7.0
      { before: -21, after: 0, taps: 3, direction: "down" }, // 7.0
      { before: -8, after: 6, taps: 2, direction: "down" }, // 7.0
    ];
    expect(centsPerTap(corrections)).toBeCloseTo(7, 5);
  });

  it("uses the median so one slipped hammer does not skew the advice", () => {
    const corrections: Correction[] = [
      { before: -14, after: 0, taps: 2, direction: "down" }, // 7
      { before: -21, after: 0, taps: 3, direction: "down" }, // 7
      { before: -80, after: 0, taps: 1, direction: "down" }, // 80, a mis-hit
      { before: -7, after: 0, taps: 1, direction: "down" }, // 7
    ];
    expect(centsPerTap(corrections)).toBeCloseTo(7, 5);
  });
});

describe("adviseTaps", () => {
  const calibrated: Correction[] = [
    { before: -14, after: 0, taps: 2, direction: "down" },
    { before: -21, after: 0, taps: 3, direction: "down" },
    { before: -7, after: 0, taps: 1, direction: "down" },
    { before: -14, after: 0, taps: 2, direction: "down" },
  ];

  it("says nothing when the reading is already within tolerance", () => {
    expect(adviseTaps(4, calibrated)).toBeNull();
  });

  it("strikes down to raise a flat reading", () => {
    expect(adviseTaps(-20, calibrated)?.direction).toBe("down");
  });

  it("strikes up to lower a sharp reading", () => {
    expect(adviseTaps(20, calibrated)?.direction).toBe("up");
  });

  it("gives no tap count before calibration rather than inventing one", () => {
    // RULES C4: if we don't know, say we don't know.
    const advice = adviseTaps(-20, []);
    expect(advice?.calibrated).toBe(false);
    expect(advice?.taps).toBeNull();
  });

  it("under-shoots deliberately once calibrated", () => {
    // 28 cents at 7 per tap is 4 ideal taps; we advise fewer, because
    // approaching in small steps is safer for the head than landing it in one.
    const advice = adviseTaps(-28, calibrated);
    expect(advice?.calibrated).toBe(true);
    expect(advice!.taps!).toBeGreaterThanOrEqual(1);
    expect(advice!.taps!).toBeLessThan(4);
  });

  it("never advises zero taps for an out-of-tolerance reading", () => {
    const advice = adviseTaps(-11, calibrated);
    expect(advice!.taps!).toBeGreaterThanOrEqual(1);
  });
});

describe("TuningSession", () => {
  it("records deviation from the target", () => {
    const session = new TuningSession(TARGET);
    session.add(shiftCents(TARGET, -14), 0.9);
    expect(session.latest!.cents).toBeCloseTo(-14, 4);
  });

  it("keeps a rolling trail of one turn", () => {
    const session = new TuningSession(TARGET);
    for (let i = 0; i < 25; i++) session.add(shiftCents(TARGET, i), 0.9);
    expect(session.trail.length).toBe(TRAIL_LENGTH);
    expect(session.all.length).toBe(25);
  });

  it("undoes a mis-hit", () => {
    const session = new TuningSession(TARGET);
    session.add(shiftCents(TARGET, 5), 0.9);
    session.add(shiftCents(TARGET, 200), 0.4);
    session.undo();
    expect(session.latest!.cents).toBeCloseTo(5, 4);
  });

  it("is not even until a full turn has been measured", () => {
    const session = new TuningSession(TARGET);
    // Three perfect readings do not make a tuned drum.
    for (let i = 0; i < 3; i++) session.add(TARGET, 0.9);
    expect(session.even).toBe(false);
  });

  it("reports even once a full tight turn is in", () => {
    const session = new TuningSession(TARGET);
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      session.add(shiftCents(TARGET, i % 2 ? 3 : -3), 0.9);
    }
    expect(session.spread).toBeCloseTo(6, 4);
    expect(session.even).toBe(true);
  });
});

describe("target notes", () => {
  it("picks the octave nearest the drum", () => {
    // Drum near C#4; asking for C# should give C#4, not C#3 or C#5.
    const target = targetFor(1, 275);
    expect(target).toBeCloseTo(277.18, 1);
  });

  it("does not jump an octave for a distant pitch class", () => {
    // Drum at C#4 asking for B should give B3 (246.9), the nearer B.
    const target = targetFor(11, 277.18);
    expect(target).toBeCloseTo(246.94, 1);
  });

  it("suggests the note the drum is already closest to", () => {
    const suggestion = suggestTarget(shiftCents(277.18, 12));
    expect(suggestion.name).toBe("C#");
    expect(suggestion.distanceCents).toBeCloseTo(-12, 0);
  });

  it("flags targets outside what a dayan can reach", () => {
    expect(isReachable(midiToHz(48))).toBe(false); // C3, 130 Hz — too low
    expect(isReachable(277.18)).toBe(true);
  });

  it("offers all twelve, marking which are reachable", () => {
    const options = noteOptions(277.18);
    expect(options).toHaveLength(12);
    expect(options.every((o) => o.reachable)).toBe(true);
  });
});
