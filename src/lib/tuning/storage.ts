/**
 * Session persistence.
 *
 * localStorage only, no backend, no accounts (RULES E2). Every read and write
 * is guarded: private windows, cleared site data and blocked storage all throw
 * on access, and none of that should stop the tuner working.
 *
 * Hammer calibration is the thing most worth keeping — it is a property of his
 * hand and his hammer, so it should not be relearned every time the tab
 * closes.
 */

import type { Correction } from "./session";
import { DEFAULT_TOLERANCE } from "./session";
import { DEFAULT_NA_CLARITY } from "./classify";
import { A4_DEFAULT } from "@/lib/audio/cents";

const KEY = "tabla-tuner:v1";

export interface Settings {
  /** 0-11, or null if never chosen. */
  pitchClass: number | null;
  tolerance: number;
  a4: number;
  naClarity: number;
  droneEnabled: boolean;
  /** Has the headroom check been acknowledged this install? */
  headroomAcknowledged: boolean;
  corrections: Correction[];
}

export const DEFAULT_SETTINGS: Settings = {
  pitchClass: null,
  tolerance: DEFAULT_TOLERANCE,
  a4: A4_DEFAULT,
  naClarity: DEFAULT_NA_CLARITY,
  droneEnabled: false,
  headroomAcknowledged: false,
  corrections: [],
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable. The tuner works fine without it; calibration just
    // will not survive the tab closing.
  }
}

export function clearSettings(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
