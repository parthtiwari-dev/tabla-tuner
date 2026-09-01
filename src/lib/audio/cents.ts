/**
 * Pitch naming and cents arithmetic.
 *
 * Pure math, no Web Audio (RULES B6). Cents are the user-facing unit
 * everywhere; Hz appears only in diagnostics (RULES D4).
 */

export const A4_DEFAULT = 440;

export const WESTERN_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/**
 * Indian scale names, indexed the same as WESTERN_NAMES.
 * Source: docs/RESEARCH.md section 4.
 */
export const INDIAN_NAMES = [
  "Safed 1",
  "Kali 1",
  "Safed 2",
  "Kali 2",
  "Safed 3",
  "Safed 4",
  "Kali 3",
  "Safed 5",
  "Kali 4",
  "Safed 6",
  "Kali 5",
  "Safed 7",
] as const;

export function hzToMidi(hz: number, a4 = A4_DEFAULT): number {
  return 69 + 12 * Math.log2(hz / a4);
}

export function midiToHz(midi: number, a4 = A4_DEFAULT): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Signed cents from `from` up to `to`. Positive means `to` is sharper. */
export function centsBetween(from: number, to: number): number {
  return 1200 * Math.log2(to / from);
}

/** Move a frequency by a cents offset. */
export function shiftCents(hz: number, cents: number): number {
  return hz * Math.pow(2, cents / 1200);
}

export interface PitchName {
  /** Fractional MIDI number. */
  midi: number;
  /** Nearest semitone, as an integer MIDI number. */
  nearestMidi: number;
  /** 0-11, indexes WESTERN_NAMES / INDIAN_NAMES. */
  pitchClass: number;
  /** Scientific pitch notation octave: middle C is C4. */
  octave: number;
  western: string;
  indian: string;
  /** Deviation from the nearest semitone, -50..+50. */
  cents: number;
}

/**
 * Name a frequency in both systems at once. Never return one without the
 * other (RULES D5).
 */
export function describePitch(hz: number, a4 = A4_DEFAULT): PitchName {
  const midi = hzToMidi(hz, a4);
  const nearestMidi = Math.round(midi);
  const cents = (midi - nearestMidi) * 100;

  // Euclidean modulo: MIDI can go negative for very low frequencies.
  const pitchClass = ((nearestMidi % 12) + 12) % 12;
  const octave = Math.floor(nearestMidi / 12) - 1;

  return {
    midi,
    nearestMidi,
    pitchClass,
    octave,
    western: WESTERN_NAMES[pitchClass],
    indian: INDIAN_NAMES[pitchClass],
    cents,
  };
}

/** "C#4 · Kali 1" */
export function formatPitch(name: PitchName): string {
  return `${name.western}${name.octave} · ${name.indian}`;
}

/** "+12 cents" / "-4 cents" / "in tune" */
export function formatCents(cents: number, tolerance = 1): string {
  if (Math.abs(cents) < tolerance) return "in tune";
  const sign = cents > 0 ? "+" : "−";
  return `${sign}${Math.abs(cents).toFixed(0)} cents`;
}
