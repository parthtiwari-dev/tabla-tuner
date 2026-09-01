/**
 * Optional reference tone at the target note.
 *
 * Off by default; the measurement is the truth (D18). This exists because it
 * is what a harmonium was doing in the room, and because hearing the target
 * while seeing the number is how an ear gets trained.
 *
 * It must duck itself around strikes: a sustained tone in the microphone will
 * dominate the autocorrelation and the detector would happily report the drone
 * instead of the drum.
 */

const PARTIAL_GAINS = [1, 0.4, 0.18, 0.08];

export class Drone {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private duckTimer: ReturnType<typeof setTimeout> | null = null;
  private level = 0.09;

  get playing(): boolean {
    return this.context !== null;
  }

  async start(hz: number): Promise<void> {
    if (this.context) this.stop();

    const context = new AudioContext();
    if (context.state === "suspended") await context.resume();

    const master = context.createGain();
    master.gain.value = this.level;
    master.connect(context.destination);

    // A few harmonics rather than a bare sine — closer to a tanpura, and much
    // easier to hear against a drum than a pure tone.
    this.oscillators = PARTIAL_GAINS.map((gain, i) => {
      const osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz * (i + 1);

      const g = context.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(master);
      osc.start();
      return osc;
    });

    this.context = context;
    this.master = master;
  }

  /**
   * Silence the tone briefly so a strike can be measured cleanly, then fade
   * back. Called on every detected onset.
   */
  duck(ms = 700): void {
    if (!this.context || !this.master) return;

    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0, now);

    if (this.duckTimer) clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      if (!this.context || !this.master) return;
      const t = this.context.currentTime;
      this.master.gain.setValueAtTime(0, t);
      this.master.gain.linearRampToValueAtTime(this.level, t + 0.25);
    }, ms);
  }

  setFrequency(hz: number): void {
    if (!this.context) return;
    this.oscillators.forEach((osc, i) => {
      osc.frequency.setValueAtTime(hz * (i + 1), this.context!.currentTime);
    });
  }

  stop(): void {
    if (this.duckTimer) clearTimeout(this.duckTimer);
    this.duckTimer = null;
    for (const osc of this.oscillators) {
      try {
        osc.stop();
      } catch {
        // Already stopped; nothing to do.
      }
    }
    this.oscillators = [];
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
