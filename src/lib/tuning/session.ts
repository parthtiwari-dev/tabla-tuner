/**
 * The tuning session: continuous listening, convergence, hammer calibration.
 *
 * The player's own account of the problem: the drum is good, a teacher can
 * tune it to any scale, *"but when I am on my own I just mess it all up."*
 *
 * He has the hammer skill. What he lacks is **perception** of the error and
 * **memory** of what he just did. So this supplies those two things and stays
 * out of the way otherwise. It does not tell him which way to hit — he knows
 * (D19).
 *
 * Everything here is pure: plain data in, plain data out, no Web Audio and no
 * React (RULES B6).
 */

import { centsBetween } from "@/lib/audio/cents";

/** Recent strikes making up the rolling picture — about one turn of the drum. */
export const TRAIL_LENGTH = 16;

/** Default "even enough" threshold, in cents. Calibrate against the ear. */
export const DEFAULT_TOLERANCE = 10;

/**
 * More consecutive taps than this and we assume the gap was something else —
 * a pause, a conversation, the drum being put down — rather than one
 * correction. Not counted toward calibration.
 */
const MAX_TAPS_PER_CORRECTION = 8;

/** Below this much movement, a "correction" is indistinguishable from noise. */
const MIN_CORRECTION_CENTS = 2;

/**
 * An onset the app heard. The microphone is always listening, so it must
 * decide what each sound was: a pitched `na`, or a hammer blow on the gajra.
 */
export type Onset =
  | { kind: "na"; hz: number; clarity: number }
  | { kind: "tap" };

export interface Strike {
  id: number;
  hz: number;
  /** Deviation from the session target, in cents. Signed; + is sharp. */
  cents: number;
  clarity: number;
  at: number;
}

export interface Correction {
  before: number;
  after: number;
  taps: number;
}

export type Trend = "converging" | "diverging" | "steady" | "unknown";

/**
 * Spread: the gap between the flattest and sharpest reading, in cents.
 *
 * This is the evenness number, and it needs no knowledge of which ghar
 * produced which reading (D16). He is looking at the drum; the app is not.
 */
export function spread(strikes: Strike[]): number {
  if (strikes.length < 2) return 0;
  const cents = strikes.map((s) => s.cents);
  return Math.max(...cents) - Math.min(...cents);
}

export function meanOffset(strikes: Strike[]): number {
  if (!strikes.length) return 0;
  return strikes.reduce((sum, s) => sum + s.cents, 0) / strikes.length;
}

/**
 * Better or worse? Compares the recent half of the trail against the older
 * half.
 *
 * Deliberately blunt, and biased toward saying nothing. A confident wrong
 * verdict here would send him hammering in the wrong direction, which is
 * precisely the failure the whole tool exists to prevent — so anything short
 * of a clear signal returns "steady".
 */
export function trend(strikes: Strike[], minPerHalf = 4): Trend {
  if (strikes.length < minPerHalf * 2) return "unknown";

  const mid = Math.floor(strikes.length / 2);
  const recent = strikes.slice(0, mid); // strikes are newest-first
  const older = strikes.slice(mid);

  const delta = spread(recent) - spread(older);
  if (Math.abs(delta) < 3) return "steady";
  return delta < 0 ? "converging" : "diverging";
}

/**
 * Cents moved per hammer tap, learned from this player's own corrections.
 *
 * Cannot be derived from theory — it depends on the hand, the hammer and the
 * drum. Returns null until there is enough evidence to be worth showing
 * (RULES C4).
 */
export function centsPerTap(corrections: Correction[], minSamples = 3): number | null {
  const usable = corrections.filter((c) => c.taps > 0);
  if (usable.length < minSamples) return null;

  const perTap = usable.map((c) => Math.abs(c.after - c.before) / c.taps);

  // Median, not mean: one slipped hammer or a misheard tap should not skew
  // the figure we show him (RULES B5).
  const sorted = [...perTap].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface SessionSnapshot {
  latest: Strike | null;
  trail: Strike[];
  spread: number;
  trend: Trend;
  pendingTaps: number;
  centsPerTap: number | null;
  even: boolean;
  corrections: number;
}

export class TuningSession {
  targetHz: number;
  tolerance: number;

  private strikes: Strike[] = [];
  private corrections: Correction[] = [];
  private taps = 0;
  private nextId = 1;

  constructor(targetHz: number, tolerance = DEFAULT_TOLERANCE, priorCorrections: Correction[] = []) {
    this.targetHz = targetHz;
    this.tolerance = tolerance;
    // Calibration carries across sessions — it is a property of his hand and
    // his hammer, not of today's tuning.
    this.corrections = [...priorCorrections];
  }

  /**
   * Feed one onset. The session works out whether a correction just completed
   * and books it, so nothing has to be pressed while both hands are busy.
   */
  observe(onset: Onset): void {
    if (onset.kind === "tap") {
      this.taps++;
      return;
    }

    const previous = this.strikes[0];
    const strike: Strike = {
      id: this.nextId++,
      hz: onset.hz,
      cents: centsBetween(this.targetHz, onset.hz),
      clarity: onset.clarity,
      at: Date.now(),
    };

    // A na, following taps, following an earlier na, is a completed
    // correction: we know what those blows achieved.
    if (previous && this.taps > 0 && this.taps <= MAX_TAPS_PER_CORRECTION) {
      const moved = Math.abs(strike.cents - previous.cents);
      if (moved >= MIN_CORRECTION_CENTS) {
        this.corrections = [
          { before: previous.cents, after: strike.cents, taps: this.taps },
          ...this.corrections,
        ];
      }
    }

    this.taps = 0;
    this.strikes = [strike, ...this.strikes];
  }

  /** Drop the most recent strike — a mis-hit, or the mic caught something else. */
  undo(): void {
    this.strikes = this.strikes.slice(1);
    this.taps = 0;
  }

  /** Start the picture over without losing hammer calibration. */
  clearTrail(): void {
    this.strikes = [];
    this.taps = 0;
  }

  retarget(hz: number): void {
    this.targetHz = hz;
    // Old readings were measured against a different target; they would
    // misrepresent the drum if kept.
    this.strikes = [];
    this.taps = 0;
  }

  get trail(): Strike[] {
    return this.strikes.slice(0, TRAIL_LENGTH);
  }

  get all(): Strike[] {
    return this.strikes;
  }

  get allCorrections(): Correction[] {
    return this.corrections;
  }

  snapshot(): SessionSnapshot {
    const trail = this.trail;
    return {
      latest: this.strikes[0] ?? null,
      trail,
      spread: spread(trail),
      trend: trend(trail),
      pendingTaps: this.taps,
      centsPerTap: centsPerTap(this.corrections),
      even: trail.length >= TRAIL_LENGTH && spread(trail) <= this.tolerance,
      corrections: this.corrections.length,
    };
  }
}
