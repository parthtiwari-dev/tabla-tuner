/**
 * Target-note selection.
 *
 * The player names a note; the octave is inferred from where the drum already
 * sits and is never asked about (D18). A dayan lives roughly D3-G4, so for any
 * given pitch class there is usually only one reachable answer.
 */

import { hzToMidi, midiToHz, A4_DEFAULT, WESTERN_NAMES } from "@/lib/audio/cents";
import { DAYAN_F_MIN, DAYAN_F_MAX } from "@/lib/audio/mpm";

export { WESTERN_NAMES as PITCH_CLASSES };

/**
 * The frequency of `pitchClass` closest to where the drum currently sits.
 *
 * `nearHz` is a measured reading from the drum itself, so the answer is always
 * something the head can actually reach.
 */
export function targetFor(pitchClass: number, nearHz: number, a4 = A4_DEFAULT): number {
  const nearMidi = hzToMidi(nearHz, a4);

  // Candidate MIDI numbers with this pitch class, in the octaves around the
  // drum's current pitch.
  const base = Math.round(nearMidi);
  const candidates: number[] = [];
  for (let octave = -2; octave <= 2; octave++) {
    const midi = base - (((base % 12) - pitchClass + 12) % 12) + octave * 12;
    candidates.push(midi);
  }

  let best = candidates[0];
  for (const midi of candidates) {
    if (Math.abs(midi - nearMidi) < Math.abs(best - nearMidi)) best = midi;
  }
  return midiToHz(best, a4);
}

/** Is this target something a dayan can physically reach? */
export function isReachable(hz: number): boolean {
  return hz >= DAYAN_F_MIN && hz <= DAYAN_F_MAX;
}

/**
 * The pitch classes worth offering, given where the drum sits. All twelve are
 * selectable, but ones that would land outside the dayan's range are flagged
 * so the interface can warn rather than silently suggest a head-splitting
 * target (RULES C1).
 */
export interface NoteOption {
  pitchClass: number;
  name: string;
  hz: number;
  reachable: boolean;
  /** Cents from the drum's current pitch to this target. */
  distanceCents: number;
}

export function noteOptions(currentHz: number, a4 = A4_DEFAULT): NoteOption[] {
  return WESTERN_NAMES.map((name, pitchClass) => {
    const hz = targetFor(pitchClass, currentHz, a4);
    return {
      pitchClass,
      name,
      hz,
      reachable: isReachable(hz),
      distanceCents: 1200 * Math.log2(hz / currentHz),
    };
  });
}

/** The note the drum is already closest to — the app's suggestion. */
export function suggestTarget(currentHz: number, a4 = A4_DEFAULT): NoteOption {
  const nearestMidi = Math.round(hzToMidi(currentHz, a4));
  const pitchClass = ((nearestMidi % 12) + 12) % 12;
  const hz = midiToHz(nearestMidi, a4);
  return {
    pitchClass,
    name: WESTERN_NAMES[pitchClass],
    hz,
    reachable: isReachable(hz),
    distanceCents: 1200 * Math.log2(hz / currentHz),
  };
}
