/**
 * The tuning session: convergence tracking and hammer calibration.
 *
 * This is the part that makes the tool worth building. The player's own
 * account of the problem is not "I can't tell what note it is" — it is *"when
 * I am on my own I just mess it all up."* The drum is good and the goal is
 * known; what fails is the loop. Overshooting, breaking a neighbour while
 * fixing a spot, losing track, and being unable to tell convergence from
 * divergence until it is far too late.
 *
 * So the job here is not measurement. It is memory and feedback:
 *
 *   - is the drum getting more even, or less?           -> spread over a trail
 *   - did those last few taps help or hurt?             -> regression detection
 *   - how hard does THIS player hit THIS drum?          -> cents per tap
 *
 * Pure functions and plain data, no Web Audio and no React (RULES B6).
 */

import { centsBetween } from "@/lib/audio/cents";

/** How many recent strikes make up the rolling picture — one turn of the drum. */
export const TRAIL_LENGTH = 16;

/** Default "even enough" threshold, in cents. Calibrate against the ear. */
export const DEFAULT_TOLERANCE = 10;

export interface Strike {
  id: number;
  hz: number;
  /** Deviation from the session target, in cents. Signed; + is sharp. */
  cents: number;
  clarity: number;
  at: number;
}

export interface Correction {
  /** Deviation before the taps, in cents. */
  before: number;
  /** Deviation after the taps, in cents. */
  after: number;
  /** Number of hammer taps applied. */
  taps: number;
  /** Down on the gajra raises pitch; up from underneath lowers it. */
  direction: "up" | "down";
}

export type Trend = "converging" | "diverging" | "steady" | "unknown";

/**
 * Spread of a set of readings, in cents: the gap between the flattest and the
 * sharpest. This is the evenness number, and it needs no knowledge of which
 * ghar produced which reading (D16).
 */
export function spread(strikes: Strike[]): number {
  if (strikes.length < 2) return 0;
  const cents = strikes.map((s) => s.cents);
  return Math.max(...cents) - Math.min(...cents);
}

/** Mean absolute deviation from target — how far off the drum is overall. */
export function meanOffset(strikes: Strike[]): number {
  if (!strikes.length) return 0;
  return strikes.reduce((sum, s) => sum + s.cents, 0) / strikes.length;
}

/**
 * Compare the most recent half of the trail against the older half.
 *
 * Deliberately blunt. The player needs "better or worse", not a statistic, and
 * a confident wrong verdict here would send them hammering in the wrong
 * direction — so anything short of a clear signal returns "steady".
 */
export function trend(strikes: Strike[], minPerHalf = 4): Trend {
  if (strikes.length < minPerHalf * 2) return "unknown";

  const mid = Math.floor(strikes.length / 2);
  // strikes are newest-first
  const recent = strikes.slice(0, mid);
  const older = strikes.slice(mid);

  const recentSpread = spread(recent);
  const olderSpread = spread(older);
  const delta = recentSpread - olderSpread;

  // A few cents either way is noise, not a trend.
  if (Math.abs(delta) < 3) return "steady";
  return delta < 0 ? "converging" : "diverging";
}

/**
 * Cents moved per hammer tap, learned from this player's own corrections.
 *
 * The direct answer to overshooting, and the one thing that cannot be derived
 * from theory — it depends on the hand, the hammer and the drum. Returns null
 * until there is enough evidence to be worth showing.
 */
export function centsPerTap(corrections: Correction[], minSamples = 4): number | null {
  const usable = corrections.filter((c) => c.taps > 0);
  if (usable.length < minSamples) return null;

  const perTap = usable.map((c) => Math.abs(c.after - c.before) / c.taps);

  // Median, not mean: one mis-hit or a slipped hammer should not skew the
  // advice we then give about how hard to hit (RULES B5).
  const sorted = [...perTap].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface TapAdvice {
  taps: number | null;
  direction: "up" | "down";
  /** True once we are advising from measured data rather than guessing. */
  calibrated: boolean;
}

/**
 * How many taps, and which way, to bring a reading onto target.
 *
 * Before calibration this returns no count at all rather than a guess —
 * "light taps, then re-measure" is honest; an invented number is not
 * (RULES C3/C4).
 */
export function adviseTaps(
  offsetCents: number,
  corrections: Correction[],
  tolerance = DEFAULT_TOLERANCE,
): TapAdvice | null {
  if (Math.abs(offsetCents) <= tolerance) return null;

  // Flat means the pitch must come up: strike down on the gajra.
  const direction: "up" | "down" = offsetCents < 0 ? "down" : "up";
  const perTap = centsPerTap(corrections);

  if (perTap === null || perTap <= 0) {
    return { taps: null, direction, calibrated: false };
  }

  // Deliberately under-shoot: approaching the target in small steps is both
  // safer for the head and more accurate than trying to land it in one go.
  const ideal = Math.abs(offsetCents) / perTap;
  return {
    taps: Math.max(1, Math.floor(ideal * 0.7)),
    direction,
    calibrated: true,
  };
}

/** Rolling state for one tuning session. */
export class TuningSession {
  readonly targetHz: number;
  readonly tolerance: number;

  private strikes: Strike[] = [];
  private corrections: Correction[] = [];
  private nextId = 1;

  constructor(targetHz: number, tolerance = DEFAULT_TOLERANCE) {
    this.targetHz = targetHz;
    this.tolerance = tolerance;
  }

  /** Record a strike. Returns it, newest-first ordering maintained internally. */
  add(hz: number, clarity: number): Strike {
    const strike: Strike = {
      id: this.nextId++,
      hz,
      cents: centsBetween(this.targetHz, hz),
      clarity,
      at: Date.now(),
    };
    this.strikes = [strike, ...this.strikes];
    return strike;
  }

  /** Drop the most recent strike — a mis-hit, or the mic caught something else. */
  undo(): void {
    this.strikes = this.strikes.slice(1);
  }

  recordCorrection(correction: Correction): void {
    this.corrections = [correction, ...this.corrections];
  }

  /** The rolling window: one turn of the drum. */
  get trail(): Strike[] {
    return this.strikes.slice(0, TRAIL_LENGTH);
  }

  get all(): Strike[] {
    return this.strikes;
  }

  get latest(): Strike | undefined {
    return this.strikes[0];
  }

  get spread(): number {
    return spread(this.trail);
  }

  get trend(): Trend {
    return trend(this.trail);
  }

  get even(): boolean {
    return this.trail.length >= TRAIL_LENGTH && this.spread <= this.tolerance;
  }

  get centsPerTap(): number | null {
    return centsPerTap(this.corrections);
  }

  advise(): TapAdvice | null {
    const latest = this.latest;
    if (!latest) return null;
    return adviseTaps(latest.cents, this.corrections, this.tolerance);
  }
}
