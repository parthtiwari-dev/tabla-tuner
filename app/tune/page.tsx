"use client";

/**
 * The tuning screen.
 *
 * One screen, one number. No ghar numbering, no position tracking, no survey
 * phase (D16). You are looking at the drum; the app is not. It reads `Na`,
 * tells you how far off you are, and — the part that matters — shows whether
 * you are converging or making it worse.
 *
 * Design brief: quiet and instrument-like. Dark, restrained, few colours,
 * large type, legible at arm's length at an angle (RULES D1).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { startCapture, MicPermissionError, type CaptureHandle } from "@/lib/audio/capture";
import { StrikeDetector } from "@/lib/audio/onset";
import { detectPitch, detectPitchNearAnchor, DAYAN_F_MIN, DAYAN_F_MAX } from "@/lib/audio/mpm";
import { Drone } from "@/lib/audio/drone";
import { describePitch } from "@/lib/audio/cents";
import { noteOptions, suggestTarget, type NoteOption } from "@/lib/tuning/notes";
import { TuningSession, TRAIL_LENGTH, type Strike, type Trend } from "@/lib/tuning/session";

type Phase = "off" | "finding" | "tuning";

/** Full-scale deflection of the meter, in cents. */
const SCALE = 50;

export default function TunePage() {
  const [phase, setPhase] = useState<Phase>("off");
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<NoteOption | null>(null);
  const [options, setOptions] = useState<NoteOption[]>([]);
  const [heard, setHeard] = useState<number | null>(null);

  const [latest, setLatest] = useState<Strike | null>(null);
  const [trail, setTrail] = useState<Strike[]>([]);
  const [spread, setSpread] = useState(0);
  const [trend, setTrend] = useState<Trend>("unknown");
  const [perTap, setPerTap] = useState<number | null>(null);
  const [droneOn, setDroneOn] = useState(false);

  const captureRef = useRef<CaptureHandle | null>(null);
  const detectorRef = useRef<StrikeDetector | null>(null);
  const sessionRef = useRef<TuningSession | null>(null);
  const droneRef = useRef<Drone | null>(null);
  const targetRef = useRef<NoteOption | null>(null);
  const pendingTap = useRef<{ before: number; taps: number } | null>(null);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  const refresh = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    setLatest(session.latest ?? null);
    setTrail(session.trail);
    setSpread(session.spread);
    setTrend(session.trend);
    setPerTap(session.centsPerTap);
  }, []);

  const onStrike = useCallback(
    (window: Float32Array, sampleRate: number) => {
      droneRef.current?.duck();
      const current = targetRef.current;

      // Before a target exists, search the whole dayan range. After, stay
      // within a fifth of the target: wide enough to show a badly-off drum,
      // far too narrow for a 3rd-harmonic error to slip through (RULES B3).
      const result = current
        ? detectPitchNearAnchor(window, sampleRate, current.hz, 500)
        : detectPitch(window, sampleRate, { fMin: DAYAN_F_MIN, fMax: DAYAN_F_MAX });

      if (result.hz <= 0) return;

      if (!current) {
        setHeard(result.hz);
        setOptions(noteOptions(result.hz));
        return;
      }

      const session = sessionRef.current;
      if (!session) return;

      const strike = session.add(result.hz, result.clarity);

      // Close out a pending correction: we now know what those taps achieved,
      // which is how the hammer gets calibrated.
      const pending = pendingTap.current;
      if (pending) {
        session.recordCorrection({
          before: pending.before,
          after: strike.cents,
          taps: pending.taps,
          direction: pending.before < 0 ? "down" : "up",
        });
        pendingTap.current = null;
      }

      refresh();
    },
    [refresh],
  );

  const start = useCallback(async () => {
    setError(null);
    try {
      let sampleRate = 0;
      const handle = await startCapture((block) => {
        const detector = detectorRef.current;
        if (!detector) return;
        const window = detector.push(block);
        if (window) onStrike(window, sampleRate);
      });
      sampleRate = handle.sampleRate;
      captureRef.current = handle;
      detectorRef.current = new StrikeDetector({ sampleRate });
      setPhase("finding");
    } catch (err) {
      setError(
        err instanceof MicPermissionError
          ? err.message
          : `Could not start audio: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [onStrike]);

  const stop = useCallback(async () => {
    droneRef.current?.stop();
    droneRef.current = null;
    setDroneOn(false);
    await captureRef.current?.stop();
    captureRef.current = null;
    detectorRef.current = null;
    sessionRef.current = null;
    setPhase("off");
    setTarget(null);
    setHeard(null);
    setLatest(null);
    setTrail([]);
  }, []);

  useEffect(() => () => void captureRef.current?.stop(), []);

  const choose = useCallback((option: NoteOption) => {
    setTarget(option);
    targetRef.current = option;
    sessionRef.current = new TuningSession(option.hz);
    droneRef.current?.setFrequency(option.hz);
    setPhase("tuning");
  }, []);

  const toggleDrone = useCallback(async () => {
    if (droneOn) {
      droneRef.current?.stop();
      droneRef.current = null;
      setDroneOn(false);
      return;
    }
    if (!target) return;
    const drone = new Drone();
    await drone.start(target.hz);
    droneRef.current = drone;
    setDroneOn(true);
  }, [droneOn, target]);

  const recordTaps = useCallback(
    (taps: number) => {
      const session = sessionRef.current;
      if (!session?.latest) return;
      pendingTap.current = { before: session.latest.cents, taps };
      refresh();
    },
    [refresh],
  );

  const undo = useCallback(() => {
    sessionRef.current?.undo();
    pendingTap.current = null;
    refresh();
  }, [refresh]);

  // ---- rendering ---------------------------------------------------------

  if (phase === "off") {
    return (
      <Shell>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-8 text-center">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Tabla Tuner</h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              Play <span className="text-body">na</span> at the kinar. Hammer, strike again,
              rotate. It watches whether you are getting closer.
            </p>
          </div>
          <button
            onClick={start}
            className="rounded-full border border-line bg-raised px-10 py-5 text-lg font-medium transition hover:border-body"
          >
            Begin
          </button>
          {error && <p className="max-w-xs text-sm leading-relaxed text-warn">{error}</p>}
        </div>
      </Shell>
    );
  }

  if (phase === "finding") {
    return (
      <Shell onStop={stop}>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-10 text-center">
          {heard === null ? (
            <>
              <p className="text-lg text-muted">Play na</p>
              <p className="max-w-xs text-sm leading-relaxed text-muted">
                Once, so it can hear where your drum sits.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm uppercase tracking-widest text-muted">Your drum is near</p>
              <button
                onClick={() => choose(suggestTarget(heard))}
                className="text-7xl font-light tracking-tight transition hover:text-even"
              >
                {suggestTarget(heard).name}
              </button>
              <p className="text-sm text-muted">Tap to tune to it, or choose another</p>
              <div className="grid max-w-sm grid-cols-6 gap-2">
                {options.map((option) => (
                  <button
                    key={option.pitchClass}
                    onClick={() => choose(option)}
                    disabled={!option.reachable}
                    className="tabular rounded-md border border-line py-3 text-sm transition hover:border-body disabled:opacity-25"
                    title={option.reachable ? undefined : "Out of range for this drum"}
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

  const cents = latest?.cents ?? 0;
  const inTune = latest ? Math.abs(cents) <= 5 : false;
  const advice = sessionRef.current?.advise() ?? null;

  return (
    <Shell onStop={stop}>
      {/* Target — small, top, out of the way */}
      <div className="flex items-baseline justify-between text-sm text-muted">
        <span className="tabular">
          <span className="text-body">{target?.name}</span>
          <span className="ml-2 opacity-60">{target?.hz.toFixed(1)} Hz</span>
        </span>
        <button
          onClick={toggleDrone}
          className={`rounded px-2 py-1 text-xs uppercase tracking-widest transition ${
            droneOn ? "text-body" : "text-muted hover:text-body"
          }`}
        >
          {droneOn ? "tone on" : "tone off"}
        </button>
      </div>

      {/* The number */}
      <div className="mt-14 text-center">
        {latest ? (
          <>
            <div
              className={`tabular text-8xl font-extralight leading-none tracking-tighter transition-colors ${
                inTune ? "text-even" : "text-warn"
              }`}
            >
              {inTune ? "0" : `${cents > 0 ? "+" : "−"}${Math.abs(cents).toFixed(0)}`}
            </div>
            <div className="mt-3 text-sm uppercase tracking-[0.3em] text-muted">
              {inTune ? "on it" : cents < 0 ? "flat" : "sharp"}
            </div>
          </>
        ) : (
          <div className="py-12 text-lg text-muted">Play na</div>
        )}
      </div>

      {/* Meter and trail share one axis, so scatter reads directly against target */}
      <div className="mt-12">
        <div className="relative h-20">
          {/* centre line */}
          <div className="absolute left-1/2 top-0 h-10 w-px -translate-x-1/2 bg-line" />
          <div className="absolute left-0 top-[19px] h-px w-full bg-line/40" />

          {/* current reading */}
          {latest && (
            <div
              className={`absolute top-1 h-8 w-1 -translate-x-1/2 rounded-full transition-[left] duration-150 ${
                inTune ? "bg-even" : "bg-warn"
              }`}
              style={{ left: `${position(cents)}%` }}
            />
          )}

          {/* trail: one turn of the drum, oldest faintest */}
          <div className="absolute top-12 h-6 w-full">
            {trail.map((strike, i) => (
              <div
                key={strike.id}
                className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-body"
                style={{
                  left: `${position(strike.cents)}%`,
                  opacity: Math.max(0.12, 1 - i / TRAIL_LENGTH),
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-baseline justify-between text-xs text-muted">
          <span className="tabular">
            spread <span className="text-body">{spread.toFixed(0)}</span> cents
            <span className="ml-1 opacity-60">
              · {trail.length}/{TRAIL_LENGTH}
            </span>
          </span>
          <span className={trendTone(trend)}>{trendLabel(trend)}</span>
        </div>
      </div>

      {/* What to do */}
      <div className="mt-10 min-h-16 text-center">
        {advice ? (
          <>
            <p className="text-lg">
              Tap <span className="font-medium">{advice.direction}</span> on the gajra
            </p>
            <p className="mt-1 text-sm text-muted">
              {advice.calibrated
                ? `about ${advice.taps} ${advice.taps === 1 ? "tap" : "taps"}`
                : "light taps, then strike again"}
            </p>
          </>
        ) : latest ? (
          <p className="text-lg text-even">Leave this one. Rotate.</p>
        ) : null}
      </div>

      {/* Tap counter — how the hammer gets learned */}
      {latest && (
        <div className="mt-10">
          <div className="text-center text-xs uppercase tracking-widest text-muted">
            {pendingTap.current ? "recorded — now strike again" : "how many taps did you give it?"}
          </div>
          <div className="mt-3 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => recordTaps(n)}
                className="tabular h-12 w-12 rounded-full border border-line text-base transition hover:border-body"
              >
                {n}
              </button>
            ))}
          </div>
          {perTap !== null && (
            <p className="mt-3 text-center text-xs text-muted">
              your taps move about{" "}
              <span className="tabular text-body">{perTap.toFixed(0)} cents</span> each
            </p>
          )}
        </div>
      )}

      <div className="mt-10 flex justify-center gap-6 text-sm text-muted">
        <button onClick={undo} className="transition hover:text-body">
          Undo last
        </button>
        <Link href="/diagnostics" className="transition hover:text-body">
          Diagnostics
        </Link>
      </div>
    </Shell>
  );
}

/** Map a cents deviation to a 0-100% position on the meter. */
function position(cents: number): number {
  const clamped = Math.max(-SCALE, Math.min(SCALE, cents));
  return ((clamped + SCALE) / (2 * SCALE)) * 100;
}

function trendLabel(trend: Trend): string {
  switch (trend) {
    case "converging":
      return "getting better";
    case "diverging":
      return "getting worse";
    case "steady":
      return "holding";
    default:
      return "";
  }
}

function trendTone(trend: Trend): string {
  if (trend === "converging") return "text-even";
  if (trend === "diverging") return "text-warn";
  return "text-muted";
}

function Shell({ children, onStop }: { children: React.ReactNode; onStop?: () => void }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-6 py-6">
      {onStop && (
        <button
          onClick={onStop}
          className="mb-2 text-xs uppercase tracking-widest text-muted transition hover:text-body"
        >
          ← stop
        </button>
      )}
      {children}
    </main>
  );
}
