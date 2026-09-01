"use client";

import { TRAIL_LENGTH, type Strike } from "@/lib/tuning/session";

/** Full-scale deflection of the meter, in cents. */
export const SCALE = 50;

/** Map a cents deviation to a 0-100% position on the meter axis. */
export function position(cents: number): number {
  const clamped = Math.max(-SCALE, Math.min(SCALE, cents));
  return ((clamped + SCALE) / (2 * SCALE)) * 100;
}

/**
 * The meter and the trail share one axis.
 *
 * That is the whole idea of this component: the scatter of the last turn is
 * read directly against the target line, so evenness is visible as the dots
 * collapsing toward the middle — without the app knowing which ghar produced
 * which dot (D16).
 */
export function Meter({
  cents,
  trail,
  tolerance,
}: {
  cents: number | null;
  trail: Strike[];
  tolerance: number;
}) {
  const inTune = cents !== null && Math.abs(cents) <= tolerance;

  return (
    <div className="relative h-24 select-none">
      {/* tolerance band */}
      <div
        className="absolute top-0 h-12 bg-even/8"
        style={{
          left: `${position(-tolerance)}%`,
          width: `${position(tolerance) - position(-tolerance)}%`,
        }}
      />

      {/* axis */}
      <div className="absolute top-[24px] h-px w-full bg-line" />

      {/* centre */}
      <div className="absolute left-1/2 top-0 h-12 w-px -translate-x-1/2 bg-line" />

      {/* ticks at +/- 25 */}
      {[-25, 25].map((t) => (
        <div
          key={t}
          className="absolute top-[18px] h-2 w-px -translate-x-1/2 bg-line"
          style={{ left: `${position(t)}%` }}
        />
      ))}

      {/* current reading */}
      {cents !== null && (
        <div
          className={`absolute top-0 h-12 w-[3px] -translate-x-1/2 rounded-full transition-[left] duration-200 ease-out ${
            inTune ? "bg-even" : "bg-warn"
          }`}
          style={{ left: `${position(cents)}%` }}
        />
      )}

      {/* the trail: one turn of the drum, oldest faintest */}
      <div className="absolute top-16 h-6 w-full">
        {trail.map((strike, i) => (
          <div
            key={strike.id}
            className="absolute h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-body transition-[left] duration-200"
            style={{
              left: `${position(strike.cents)}%`,
              opacity: Math.max(0.1, 1 - (i / TRAIL_LENGTH) * 0.9),
            }}
          />
        ))}
      </div>

    </div>
  );
}

/**
 * Live evidence of what the microphone is deciding. Shown because the na/tap
 * split is a heuristic, and a heuristic the player can watch is one he can
 * correct for (or retune, in settings).
 */
export function EventStrip({
  pendingTaps,
  lastKind,
  centsPerTap,
}: {
  pendingTaps: number;
  lastKind: "na" | "tap" | null;
  centsPerTap: number | null;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-muted">
      <span className="flex items-center gap-1.5">
        {pendingTaps > 0 ? (
          <>
            <span className="tabular text-body">{pendingTaps}</span>
            <span>{pendingTaps === 1 ? "tap heard" : "taps heard"}</span>
          </>
        ) : (
          <span className="opacity-50">{lastKind === "na" ? "na" : "listening"}</span>
        )}
      </span>
      {centsPerTap !== null && (
        <span className="tabular">
          your taps ≈ <span className="text-body">{centsPerTap.toFixed(0)}</span> cents
        </span>
      )}
    </div>
  );
}

/**
 * Shown once. A drum whose blocks are already at the bottom has no travel
 * left; forcing it splits the head, and a lace out of range is a craftsman's
 * job, not a tuning session (D17).
 */
export function HeadroomCard({ onAcknowledge }: { onAcknowledge: () => void }) {
  return (
    <div className="flex min-h-[70dvh] flex-col justify-center gap-6">
      <h2 className="text-lg font-medium">Before you start — check the blocks</h2>
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        <p>
          Look at where the eight gattas sit on the lace. Driving them down raises tension and
          pitch, so their position is how much range you have left.
        </p>
        <p>
          <span className="text-body">High on the lace</span> — plenty of travel, you can tighten.
        </p>
        <p>
          <span className="text-body">Already near the bottom</span> — the drum is at its ceiling.
          It will not go higher, and hammering to force it risks splitting the head. A lace out of
          travel needs re-lacing by a craftsman; no tuner helps.
        </p>
      </div>
      <button
        onClick={onAcknowledge}
        className="self-start rounded-full border border-line px-8 py-4 transition hover:border-body"
      >
        Checked — continue
      </button>
      <p className="text-xs text-muted opacity-60">Shown once. Reachable again from settings.</p>
    </div>
  );
}

export function SettingsSheet({
  tolerance,
  naClarity,
  a4,
  onTolerance,
  onNaClarity,
  onA4,
  onReset,
  onShowHeadroom,
  onClose,
  calibrationCount,
}: {
  tolerance: number;
  naClarity: number;
  a4: number;
  onTolerance: (v: number) => void;
  onNaClarity: (v: number) => void;
  onA4: (v: number) => void;
  onReset: () => void;
  onShowHeadroom: () => void;
  onClose: () => void;
  calibrationCount: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 px-6 py-6 backdrop-blur">
      <div className="mx-auto w-full max-w-md">
        <button
          onClick={onClose}
          className="text-xs uppercase tracking-widest text-muted transition hover:text-body"
        >
          ← close
        </button>

        <h2 className="mt-8 text-lg font-medium">Settings</h2>

        <div className="mt-8 space-y-8">
          <Field
            label="Even enough"
            value={`${tolerance} cents`}
            hint="How close counts as in tune. Trust your ear over this number."
          >
            <input
              type="range"
              min={3}
              max={25}
              step={1}
              value={tolerance}
              onChange={(e) => onTolerance(Number(e.target.value))}
              className="w-full accent-[var(--color-even)]"
            />
          </Field>

          <Field
            label="Na sensitivity"
            value={naClarity.toFixed(2)}
            hint="How tonal a sound must be to count as na rather than a hammer tap. Raise it if taps are being read as na; lower it if your na strokes are being missed."
          >
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.01}
              value={naClarity}
              onChange={(e) => onNaClarity(Number(e.target.value))}
              className="w-full accent-[var(--color-even)]"
            />
          </Field>

          <Field
            label="Reference"
            value={`A = ${a4} Hz`}
            hint="Only change this if you are matching an instrument tuned away from 440."
          >
            <input
              type="range"
              min={415}
              max={455}
              step={1}
              value={a4}
              onChange={(e) => onA4(Number(e.target.value))}
              className="w-full accent-[var(--color-even)]"
            />
          </Field>
        </div>

        <div className="mt-10 space-y-3 border-t border-line pt-6 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Hammer calibration</span>
            <span className="tabular text-muted">
              {calibrationCount} {calibrationCount === 1 ? "correction" : "corrections"}
            </span>
          </div>
          <button
            onClick={onShowHeadroom}
            className="block text-muted transition hover:text-body"
          >
            Show the block check again
          </button>
          <button onClick={onReset} className="block text-warn transition hover:opacity-80">
            Reset everything
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm">{label}</span>
        <span className="tabular text-sm text-muted">{value}</span>
      </div>
      <div className="mt-3">{children}</div>
      <p className="mt-2 text-xs leading-relaxed text-muted opacity-70">{hint}</p>
    </div>
  );
}
