import { describe, it, expect } from "vitest";
import {
  hzToMidi,
  midiToHz,
  centsBetween,
  shiftCents,
  describePitch,
  formatPitch,
  formatCents,
} from "./cents";

describe("midi conversion", () => {
  it("puts A4 at midi 69", () => {
    expect(hzToMidi(440)).toBeCloseTo(69, 10);
    expect(midiToHz(69)).toBeCloseTo(440, 10);
  });

  it("puts middle C at midi 60", () => {
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3);
  });

  it("round-trips", () => {
    for (const hz of [150, 185, 261.63, 300, 400]) {
      expect(midiToHz(hzToMidi(hz))).toBeCloseTo(hz, 8);
    }
  });

  it("honours a non-440 reference", () => {
    expect(hzToMidi(432, 432)).toBeCloseTo(69, 10);
  });
});

describe("cents", () => {
  it("makes an octave 1200 cents", () => {
    expect(centsBetween(220, 440)).toBeCloseTo(1200, 10);
  });

  it("makes a semitone 100 cents", () => {
    expect(centsBetween(261.6256, 277.1826)).toBeCloseTo(100, 2);
  });

  it("is signed", () => {
    expect(centsBetween(440, 220)).toBeCloseTo(-1200, 10);
  });

  it("round-trips through shiftCents", () => {
    expect(centsBetween(261.63, shiftCents(261.63, 37))).toBeCloseTo(37, 8);
  });
});

describe("describePitch", () => {
  it("names C#4 as Kali 1", () => {
    const p = describePitch(277.1826);
    expect(p.western).toBe("C#");
    expect(p.indian).toBe("Kali 1");
    expect(p.octave).toBe(4);
    expect(p.cents).toBeCloseTo(0, 2);
  });

  it("names C4 as Safed 1", () => {
    const p = describePitch(261.6256);
    expect(p.western).toBe("C");
    expect(p.indian).toBe("Safed 1");
    expect(p.octave).toBe(4);
  });

  it("names E3 as Safed 3", () => {
    const p = describePitch(midiToHz(52));
    expect(p.western).toBe("E");
    expect(p.indian).toBe("Safed 3");
    expect(p.octave).toBe(3);
  });

  it("reports deviation from the nearest semitone", () => {
    const p = describePitch(shiftCents(261.6256, 24));
    expect(p.western).toBe("C");
    expect(p.cents).toBeCloseTo(24, 1);
  });

  it("rounds up to the next note past the midpoint", () => {
    const p = describePitch(shiftCents(261.6256, 62));
    expect(p.western).toBe("C#");
    expect(p.cents).toBeCloseTo(-38, 1);
  });

  it("keeps cents within +/-50", () => {
    for (let c = -49; c <= 49; c += 7) {
      const p = describePitch(shiftCents(261.6256, c));
      expect(Math.abs(p.cents)).toBeLessThanOrEqual(50);
    }
  });
});

describe("formatting", () => {
  it("shows both naming systems together", () => {
    // RULES D5: never one without the other.
    expect(formatPitch(describePitch(277.1826))).toBe("C#4 · Kali 1");
  });

  it("formats cents with a sign", () => {
    expect(formatCents(12)).toBe("+12 cents");
    expect(formatCents(-4)).toBe("−4 cents");
    expect(formatCents(0.2)).toBe("in tune");
  });
});
