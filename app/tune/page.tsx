"use client";

/**
 * The tuner.
 *
 * It listens continuously and never asks for a button press while both hands
 * are busy. It does not say which way to hit — he has ten years of that and
 * does not need telling (D19). It supplies the two things he cannot supply
 * himself: reliable perception of the error, and memory of what the last few
 * minutes of hammering actually did.
 *
 * Design brief: quiet and instrument-like. Dark, few colours, large type,
 * legible at arm's length at an angle (RULES D1).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { startCapture, MicPermissionError, type CaptureHandle } from "@/lib/audio/capture";
import { StrikeDetector } from "@/lib/audio/onset";
import { Drone } from "@/lib/audio/drone";
import { TuningSession, type SessionSnapshot, type Correction } from "@/lib/tuning/session";
import { classifyOnset } from "@/lib/tuning/classify";
import { noteOptions, suggestTarget, targetFor, type NoteOption } from "@/lib/tuning/notes";
import {
  loadSettings,
  saveSettings,
  clearSettings,
  DEFAULT_SETTINGS,
  type Settings,
} from "@/lib/tuning/storage";
import {
  Meter,
  TrendLine,
  EventStrip,
  HeadroomCard,
  SettingsSheet,
} from "./components";

type Phase = "off" | "headroom" | "finding" | "tuning";

const EMPTY: SessionSnapshot = {
  latest: null,
  trail: [],
  spread: 0,
  trend: "unknown",
  pendingTaps: 0,
  centsPerTap: null,
  even: false,
  corrections: 0,
};

export default function TunePage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>("off");
  const [error, setError] = useState<string | null>(null);

  const [target, setTarget] = useState<NoteOption | null>(null);
  const [heard, setHeard] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(EMPTY);
  const [lastKind, setLastKind] = useState<"na" | "tap" | null>(null);
  const [droneOn, setDroneOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const captureRef = useRef<CaptureHandle | null>(null);
  const detectorRef = useRef<StrikeDetector | null>(null);
  const sessionRef = useRef<TuningSession | null>(null);
  const droneRef = useRef<Drone | null>(null);
  const targetRef = useRef<NoteOption | null>(null);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);

  // Settings load client-side only; localStorage is unavailable during SSR.
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    settingsRef.current = loaded;
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  const persist = useCallback((next: Partial<Settings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      settingsRef.current = merged;
      saveSettings(merged);
      return merged;
    });
  }, []);

  // ---- audio -------------------------------------------------------------

  const onOnset = useCallback((window: Float32Array, sampleRate: number) => {
    droneRef.current?.duck();

    const current = targetRef.current;
    const { onset } = classifyOnset(window, sampleRate, {
      targetHz: current?.hz,
      naClarity: settingsRef.current.naClarity,
    });

    setLastKind(onset.kind);

    // Before a target exists we are only listening for where the drum sits.
    if (!current) {
      if (onset.kind === "na") setHeard(onset.hz);
      return;
    }

    const session = sessionRef.current;
    if (!session) return;

    const before = session.allCorrections.length;
    session.observe(onset);
    setSnapshot(session.snapshot());

    // Calibration is a property of his hand and hammer, so it outlives the
    // session. Persist as soon as a new correction is booked.
    if (session.allCorrections.length !== before) {
      persist({ corrections: session.allCorrections.slice(0, 60) });
    }
  }, [persist]);

  const start = useCallback(async () => {
    setError(null);
    try {
      let sampleRate = 0;
      const handle = await startCapture((block) => {
        const detector = detectorRef.current;
        if (!detector) return;
        const window = detector.push(block);
        if (window) onOnset(window, sampleRate);
      });
      sampleRate = handle.sampleRate;
      captureRef.current = handle;
      detectorRef.current = new StrikeDetector({ sampleRate });
      setPhase(settingsRef.current.headroomAcknowledged ? "finding" : "headroom");
    } catch (err) {
      setError(
        err instanceof MicPermissionError
          ? err.message
          : `Could not start audio: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [onOnset]);

  const stop = useCallback(async () => {
    droneRef.current?.stop();
    droneRef.current = null;
    setDroneOn(false);
    await captureRef.current?.stop();
    captureRef.current = null;
    detectorRef.current = null;
    sessionRef.current = null;
    targetRef.current = null;
    setPhase("off");
    setTarget(null);
    setHeard(null);
    setSnapshot(EMPTY);
    setLastKind(null);
  }, []);

  useEffect(() => () => void captureRef.current?.stop(), []);

  // ---- actions -----------------------------------------------------------

  const choose = useCallback(
    (option: NoteOption) => {
      setTarget(option);
      targetRef.current = option;
      sessionRef.current = new TuningSession(
        option.hz,
        settingsRef.current.tolerance,
        settingsRef.current.corrections as Correction[],
      );
      setSnapshot(sessionRef.current.snapshot());
      droneRef.current?.setFrequency(option.hz);
      persist({ pitchClass: option.pitchClass });
      setPhase("tuning");
    },
    [persist],
  );

  const toggleDrone = useCallback(async () => {
    if (droneOn) {
      droneRef.current?.stop();
      droneRef.current = null;
      setDroneOn(false);
      persist({ droneEnabled: false });
      return;
    }
    if (!target) return;
    const drone = new Drone();
    await drone.start(target.hz);
    droneRef.current = drone;
    setDroneOn(true);
    persist({ droneEnabled: true });
  }, [droneOn, target, persist]);

  const undo = useCallback(() => {
    sessionRef.current?.undo();
    if (sessionRef.current) setSnapshot(sessionRef.current.snapshot());
  }, []);

  const clearTrail = useCallback(() => {
    sessionRef.current?.clearTrail();
    if (sessionRef.current) setSnapshot(sessionRef.current.snapshot());
  }, []);

  const changeNote = useCallback(() => {
    setTarget(null);
    targetRef.current = null;
    setHeard(null);
    setPhase("finding");
  }, []);

  const resetAll = useCallback(() => {
    clearSettings();
    setSettings(DEFAULT_SETTINGS);
    settingsRef.current = DEFAULT_SETTINGS;
    setShowSettings(false);
    void stop();
  }, [stop]);

  // Tolerance changes mid-session should take effect immediately.
  useEffect(() => {
    if (sessionRef.current) {
      sessionRef.current.tolerance = settings.tolerance;
      setSnapshot(sessionRef.current.snapshot());
    }
  }, [settings.tolerance]);

  // ---- screens -----------------------------------------------------------

  if (phase === "off") {
    return (
      <Shell>
        <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-10 text-center">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Tabla Tuner</h1>
            <p className="mx-auto mt-4 max-w-[16rem] text-sm leading-relaxed text-muted">
              Play <span className="text-body">na</span> at the kinar and it listens. Hammer,
              play again, rotate. It tells you whether you are getting closer.
            </p>
          </div>
          <button
            onClick={start}
            className="rounded-full border border-line bg-raised px-12 py-5 text-lg transition hover:border-body"
          >
            Begin
          </button>
          {error && <p className="max-w-xs text-sm leading-relaxed text-warn">{error}</p>}
          <p className="text-xs text-muted opacity-50">
            Runs entirely on your device. Nothing is recorded or sent.
          </p>
        </div>
      </Shell>
    );
  }

  if (phase === "headroom") {
    return (
      <Shell onStop={stop}>
        <HeadroomCard
          onAcknowledge={() => {
            persist({ headroomAcknowledged: true });
            setPhase("finding");
          }}
        />
      </Shell>
    );
  }

  if (phase === "finding") {
    const suggestion = heard !== null ? suggestTarget(heard, settings.a4) : null;
    const options = heard !== null ? noteOptions(heard, settings.a4) : [];
    const remembered =
      settings.pitchClass !== null && heard !== null
        ? {
            ...suggestion!,
            pitchClass: settings.pitchClass,
            name: options[settings.pitchClass].name,
            hz: targetFor(settings.pitchClass, heard, settings.a4),
          }
        : null;

    return (
      <Shell onStop={stop}>
        <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-8 text-center">
          {heard === null ? (
            <>
              <p className="text-xl">Play na</p>
              <p className="max-w-[15rem] text-sm leading-relaxed text-muted">
                Once, so it can hear where your drum is sitting.
              </p>
              <div className="h-1 w-1 animate-pulse rounded-full bg-muted" />
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.25em] text-muted">Your drum is near</p>
              <button
                onClick={() => choose(suggestion!)}
                className="text-8xl font-extralight leading-none tracking-tight transition hover:text-even"
              >
                {suggestion!.name}
              </button>

              {remembered && remembered.pitchClass !== suggestion!.pitchClass && (
                <button
                  onClick={() => choose(remembered)}
                  className="text-sm text-muted underline-offset-4 transition hover:text-body hover:underline"
                >
                  Last time you tuned to {remembered.name}
                </button>
              )}

              <p className="text-xs text-muted">Tap to accept, or choose another</p>
              <div className="grid w-full max-w-[20rem] grid-cols-6 gap-1.5">
                {options.map((option) => (
                  <button
                    key={option.pitchClass}
                    onClick={() => choose(option)}
                    disabled={!option.reachable}
                    className={`tabular rounded border py-3 text-sm transition disabled:opacity-20 ${
                      option.pitchClass === suggestion!.pitchClass
                        ? "border-body"
                        : "border-line hover:border-muted"
                    }`}
                    title={option.reachable ? undefined : "Outside this drum's range"}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Shell>
    );
  }

  // ---- tuning ------------------------------------------------------------

  const { latest, trail, spread, trend, pendingTaps, centsPerTap, even } = snapshot;
  const cents = latest?.cents ?? null;
  const inTune = cents !== null && Math.abs(cents) <= settings.tolerance;

  return (
    <Shell onStop={stop}>
      {showSettings && (
        <SettingsSheet
          tolerance={settings.tolerance}
          naClarity={settings.naClarity}
          a4={settings.a4}
          calibrationCount={settings.corrections.length}
          onTolerance={(v) => persist({ tolerance: v })}
          onNaClarity={(v) => persist({ naClarity: v })}
          onA4={(v) => persist({ a4: v })}
          onReset={resetAll}
          onShowHeadroom={() => {
            setShowSettings(false);
            setPhase("headroom");
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* target — small, top, out of the way */}
      <div className="flex items-center justify-between text-sm">
        <button onClick={changeNote} className="tabular transition hover:text-even">
          <span className="text-body">{target?.name}</span>
          <span className="ml-2 text-muted opacity-60">{target?.hz.toFixed(1)} Hz</span>
        </button>
        <div className="flex items-center gap-4 text-xs uppercase tracking-widest text-muted">
          <button
            onClick={toggleDrone}
            className={`transition hover:text-body ${droneOn ? "text-body" : ""}`}
          >
            tone
          </button>
          <button onClick={() => setShowSettings(true)} className="transition hover:text-body">
            settings
          </button>
        </div>
      </div>

      {/* the number */}
      <div className="mt-16 text-center">
        {cents !== null ? (
          <>
            <div
              className={`tabular text-[6.5rem] font-extralight leading-none tracking-tighter transition-colors ${
                inTune ? "text-even" : "text-warn"
              }`}
            >
              {inTune ? "0" : `${cents > 0 ? "+" : "−"}${Math.abs(cents).toFixed(0)}`}
            </div>
            <div className="mt-4 text-xs uppercase tracking-[0.35em] text-muted">
              {inTune ? "on it" : cents < 0 ? "flat" : "sharp"}
            </div>
          </>
        ) : (
          <div className="py-14 text-lg text-muted">Play na</div>
        )}
      </div>

      <div className="mt-14">
        <Meter cents={cents} trail={trail} tolerance={settings.tolerance} />
        <TrendLine
          spread={spread}
          count={trail.length}
          trend={trend}
          tolerance={settings.tolerance}
        />
      </div>

      <div className="mt-6">
        <EventStrip pendingTaps={pendingTaps} lastKind={lastKind} centsPerTap={centsPerTap} />
      </div>

      {even && (
        <p className="mt-10 text-center text-sm text-even">
          Every strike of the last turn is within {settings.tolerance} cents. Trust your ear over
          this.
        </p>
      )}

      <div className="mt-12 flex justify-center gap-6 text-xs uppercase tracking-widest text-muted">
        <button onClick={undo} className="transition hover:text-body">
          undo
        </button>
        <button onClick={clearTrail} className="transition hover:text-body">
          clear trail
        </button>
        <Link href="/diagnostics" className="transition hover:text-body">
          diagnostics
        </Link>
      </div>
    </Shell>
  );
}

function Shell({ children, onStop }: { children: React.ReactNode; onStop?: () => void }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-6 py-6">
      {onStop && (
        <button
          onClick={onStop}
          className="mb-4 text-xs uppercase tracking-widest text-muted transition hover:text-body"
        >
          ← stop
        </button>
      )}
      {children}
    </main>
  );
}
