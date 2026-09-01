"use client";

/**
 * M1 diagnostic bench. Deliberately raw — this is the instrument we use to
 * decide whether the detector survives a real drum, not a piece of the
 * finished tuner (PLAN.md M1).
 *
 * The number that matters is Spread. Strike one ghar ten times without
 * touching the tabla; if spread exceeds 5 cents, stop and diagnose before
 * building anything on top.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { startCapture, MicPermissionError, type CaptureHandle } from "@/lib/audio/capture";
import { StrikeDetector } from "@/lib/audio/onset";
import { detectPitch, detectPitchNearAnchor, DAYAN_F_MIN, DAYAN_F_MAX } from "@/lib/audio/mpm";
import { analyseHarmonics, type HarmonicProfile } from "@/lib/audio/harmonics";
import {
  describePitch,
  formatPitch,
  formatCents,
  centsBetween,
  type PitchName,
} from "@/lib/audio/cents";

type Mode = "anchor" | "survey";

interface Reading {
  id: number;
  hz: number;
  clarity: number;
  ambiguous: boolean;
  name: PitchName;
  harmonics: HarmonicProfile;
  mode: Mode;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function DiagnosticsPage() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleRate, setSampleRate] = useState(0);
  const [level, setLevel] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("anchor");
  const [rejected, setRejected] = useState(0);

  const captureRef = useRef<CaptureHandle | null>(null);
  const detectorRef = useRef<StrikeDetector | null>(null);
  const anchorRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>("anchor");
  const levelRef = useRef(0);
  const thresholdRef = useRef(0);
  const nextId = useRef(1);

  useEffect(() => {
    anchorRef.current = anchor;
  }, [anchor]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Meter at animation rate rather than per audio block: ~47 setState calls a
  // second would be pure waste.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      setLevel(levelRef.current);
      setThreshold(thresholdRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const handleStrike = useCallback((window: Float32Array, sr: number) => {
    const currentAnchor = anchorRef.current;
    const currentMode = modeRef.current;

    const result =
      currentMode === "survey" && currentAnchor
        ? detectPitchNearAnchor(window, sr, currentAnchor, 200)
        : detectPitch(window, sr, { fMin: DAYAN_F_MIN, fMax: DAYAN_F_MAX });

    // A rejected reading is a correct outcome, not a failure to hide
    // (RULES B4). Count it so a bad mic position is visible.
    if (result.hz <= 0) {
      setRejected((n) => n + 1);
      return;
    }

    const reading: Reading = {
      id: nextId.current++,
      hz: result.hz,
      clarity: result.clarity,
      ambiguous: result.ambiguous,
      name: describePitch(result.hz),
      harmonics: analyseHarmonics(window, sr, result.hz),
      mode: currentMode,
    };
    setReadings((prev) => [reading, ...prev].slice(0, 40));
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      let sr = 0;
      const handle = await startCapture((block) => {
        const detector = detectorRef.current;
        if (!detector) return;
        const window = detector.push(block);
        levelRef.current = detector.level;
        thresholdRef.current = detector.threshold;
        if (window) handleStrike(window, sr);
      });

      sr = handle.sampleRate;
      captureRef.current = handle;
      detectorRef.current = new StrikeDetector({ sampleRate: handle.sampleRate });
      setSampleRate(handle.sampleRate);
      setRunning(true);
    } catch (err) {
      setError(
        err instanceof MicPermissionError
          ? err.message
          : `Could not start audio: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [handleStrike]);

  const stop = useCallback(async () => {
    await captureRef.current?.stop();
    captureRef.current = null;
    detectorRef.current = null;
    levelRef.current = 0;
    setRunning(false);
    setLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      void captureRef.current?.stop();
    };
  }, []);

  const sameMode = readings.filter((r) => r.mode === mode);
  const hzValues = sameMode.map((r) => r.hz);
  const medianHz = median(hzValues);
  const spread = hzValues.length > 1 ? centsBetween(Math.min(...hzValues), Math.max(...hzValues)) : 0;
  const latest = readings[0];

  const meterPct = Math.min(100, (level / 0.25) * 100);
  const thresholdPct = Math.min(100, (threshold / 0.25) * 100);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Diagnostics</h1>
        <Link href="/" className="text-sm text-muted hover:text-body">
          ← Home
        </Link>
      </header>

      {error && (
        <p className="mt-4 rounded-md border border-warn/40 bg-warn/10 p-4 text-sm leading-relaxed text-warn">
          {error}
        </p>
      )}

      {/* Transport */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={running ? stop : start}
          className={`rounded-md px-6 py-3 font-medium transition ${
            running ? "bg-warn text-ink" : "bg-even text-ink"
          } hover:opacity-90`}
        >
          {running ? "Stop" : "Start listening"}
        </button>

        <button
          onClick={() => {
            setReadings([]);
            setRejected(0);
          }}
          className="rounded-md border border-line px-4 py-3 text-sm text-muted transition hover:text-body"
        >
          Clear
        </button>

        {sampleRate > 0 && (
          <span className="tabular text-sm text-muted">{sampleRate} Hz</span>
        )}
      </div>

      {/* Level meter — the M0 check, and how you spot a bad mic position */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between text-xs uppercase tracking-wider text-muted">
          <span>Input level</span>
          <span className="tabular">
            {level.toFixed(4)} · trigger {threshold.toFixed(4)}
          </span>
        </div>
        <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-muted transition-[width] duration-75"
            style={{ width: `${meterPct}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-warn"
            style={{ left: `${thresholdPct}%` }}
            title="Strike threshold"
          />
        </div>
      </section>

      {/* Mode */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-2">
          {(["anchor", "survey"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={m === "survey" && !anchor}
              className={`rounded-md border px-4 py-2 text-sm transition ${
                mode === m
                  ? "border-body bg-raised text-body"
                  : "border-line text-muted hover:text-body"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {m === "anchor" ? "Anchor · Tun" : "Survey · Na"}
            </button>
          ))}

          <button
            onClick={() => setAnchor(medianHz || null)}
            disabled={!medianHz || mode !== "anchor"}
            className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:text-body disabled:cursor-not-allowed disabled:opacity-40"
          >
            Set anchor from median
          </button>

          {anchor && (
            <span className="tabular text-sm text-even">
              anchor {anchor.toFixed(2)} Hz · {formatPitch(describePitch(anchor))}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {mode === "anchor"
            ? `Unconstrained search, ${DAYAN_F_MIN}–${DAYAN_F_MAX} Hz. Play Tun — it has a real fundamental, so this is where absolute pitch comes from.`
            : "Search limited to ±200 cents around the anchor. Play Na around the rim; the band makes a 3rd-harmonic error structurally impossible."}
        </p>
      </section>

      {/* Latest reading */}
      <section className="mt-8 rounded-lg border border-line bg-surface p-6">
        {latest ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-4xl font-semibold tracking-tight">
                {formatPitch(latest.name)}
              </span>
              <span
                className={`tabular text-2xl ${
                  Math.abs(latest.name.cents) < 5
                    ? "text-even"
                    : latest.name.cents > 0
                      ? "text-warn"
                      : "text-muted"
                }`}
              >
                {formatCents(latest.name.cents, 5)}
              </span>
            </div>
            <div className="tabular mt-2 text-sm text-muted">
              {latest.hz.toFixed(2)} Hz · clarity {latest.clarity.toFixed(3)}
              {latest.ambiguous && (
                <span className="ml-2 text-warn">· octave ambiguous</span>
              )}
            </div>

            {/* Partial structure: this is how Tun and Na look different */}
            <div className="mt-5">
              <div className="text-xs uppercase tracking-wider text-muted">
                Partials · inharmonicity {latest.harmonics.inharmonicityCents.toFixed(1)}¢ ·
                dominant {latest.harmonics.dominantPartial}
              </div>
              <div className="mt-3 space-y-1.5">
                {latest.harmonics.partials.map((p) => (
                  <div key={p.k} className="flex items-center gap-3 text-xs">
                    <span className="tabular w-6 text-muted">{p.k}×</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised">
                      <div
                        className="h-full rounded-full bg-muted"
                        style={{ width: `${p.relative * 100}%` }}
                      />
                    </div>
                    <span className="tabular w-28 text-right text-muted">
                      {p.measuredHz.toFixed(0)} Hz · {p.deviationCents >= 0 ? "+" : ""}
                      {p.deviationCents.toFixed(0)}¢
                    </span>
                  </div>
                ))}
              </div>
              {latest.harmonics.fundamentalStrength < 0.5 && (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Fundamental is{" "}
                  <span className="text-body">
                    {(latest.harmonics.fundamentalStrength * 100).toFixed(0)}%
                  </span>{" "}
                  of the strongest partial — a suppressed fundamental, as expected from Na.
                  The detector found the pitch anyway.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted">
            {running ? "Listening. Strike the drum." : "Press start, then strike the drum."}
          </p>
        )}
      </section>

      {/* The go/no-go number */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Strikes" value={String(sameMode.length)} />
        <Stat label="Median" value={medianHz ? `${medianHz.toFixed(2)} Hz` : "—"} />
        <Stat
          label="Spread"
          value={sameMode.length > 1 ? `${spread.toFixed(1)}¢` : "—"}
          tone={sameMode.length > 1 ? (spread <= 5 ? "good" : "bad") : undefined}
        />
        <Stat label="Rejected" value={String(rejected)} />
      </section>

      {sameMode.length > 1 && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {spread <= 5
            ? "Spread is within ±5 cents. If these are ten strikes on one untouched ghar, M1 passes."
            : "Spread exceeds 5 cents. Before smoothing anything: check that browser audio processing is off (RULES A1), that the decay tail is being analysed rather than the attack (A3), and that the syahi is sound."}
        </p>
      )}

      {/* Log */}
      {readings.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-muted">Readings</h2>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {readings.map((r) => {
              const reference = anchor ?? medianHz;
              const delta = reference ? centsBetween(reference, r.hz) : 0;
              return (
                <li
                  key={r.id}
                  className="tabular flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                >
                  <span className="w-8 text-muted">#{r.id}</span>
                  <span className="flex-1">{formatPitch(r.name)}</span>
                  <span className="w-24 text-right text-muted">{r.hz.toFixed(2)} Hz</span>
                  <span
                    className={`w-20 text-right ${
                      Math.abs(delta) < 5 ? "text-even" : delta > 0 ? "text-warn" : "text-muted"
                    }`}
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}¢
                  </span>
                  <span className="w-14 text-right text-muted">{r.clarity.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Deviation is measured against {anchor ? "the anchor" : "the running median"}.
          </p>
        </section>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const color = tone === "good" ? "text-even" : tone === "bad" ? "text-warn" : "text-body";
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`tabular mt-1 text-lg font-medium ${color}`}>{value}</div>
    </div>
  );
}
