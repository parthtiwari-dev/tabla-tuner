import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Tabla Tuner</h1>

      <p className="mt-4 text-muted leading-relaxed">
        A tuner that measures whether a dayan is tuned{" "}
        <em className="text-body not-italic">evenly all the way around</em> — not just at
        one spot on the rim.
      </p>

      <div className="mt-10 rounded-lg border border-line bg-surface p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Milestone 1
        </h2>
        <p className="mt-3 leading-relaxed">
          The pitch detector exists and passes its synthetic tests. Next it has to
          survive a real drum: strike one ghar ten times without touching the tabla,
          and the readings must agree within{" "}
          <span className="tabular font-medium text-body">±5 cents</span>.
        </p>
        <Link
          href="/diagnostics"
          className="mt-6 inline-flex items-center rounded-md bg-even px-5 py-3 font-medium text-ink transition hover:opacity-90"
        >
          Open diagnostics
        </Link>
      </div>

      <p className="mt-8 text-sm leading-relaxed text-muted">
        Everything runs in your browser. Audio never leaves the device and nothing is
        recorded.
      </p>
    </main>
  );
}
