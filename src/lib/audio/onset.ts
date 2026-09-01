/**
 * Strike detection.
 *
 * Isolated drum hits in a quiet room don't need spectral flux — a level
 * trigger against an adaptive noise floor is more robust and far easier to
 * reason about. What matters is the windowing discipline:
 *
 *  - skip the attack (RULES A3): the first 20-30 ms is broadband noise with
 *    no usable pitch, and feeding it to the detector poisons the estimate
 *  - one strike, one onset (RULES A4): without a refractory period a single
 *    `Na` registers three times and the auto-advance runs away
 */

export interface StrikeDetectorOptions {
  sampleRate: number;
  /** Discard this much after the trigger before analysing. */
  attackSkipMs?: number;
  /** Length of the decay tail handed to the pitch detector. */
  analysisMs?: number;
  /** Ignore further triggers for this long after one fires. */
  refractoryMs?: number;
  /** Level must exceed the running noise floor by this factor. */
  triggerRatio?: number;
  /** Level must also exceed this absolute RMS, to ignore a silent room. */
  absoluteFloor?: number;
}

type State = "idle" | "capturing" | "refractory";

function frameRms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

export class StrikeDetector {
  private readonly sampleRate: number;
  private readonly attackSkip: number;
  private readonly analysisLength: number;
  private readonly refractory: number;
  private readonly triggerRatio: number;
  private readonly absoluteFloor: number;

  private state: State = "idle";
  private capture: Float32Array;
  private captured = 0;
  private refractoryLeft = 0;

  /** Slow EMA of the quiet-room level. */
  private floor = 0.001;
  /** Most recent frame level, for a UI meter. */
  private lastLevel = 0;

  constructor(options: StrikeDetectorOptions) {
    const {
      sampleRate,
      attackSkipMs = 30,
      analysisMs = 500,
      refractoryMs = 250,
      triggerRatio = 4,
      absoluteFloor = 0.008,
    } = options;

    this.sampleRate = sampleRate;
    this.attackSkip = Math.round((attackSkipMs / 1000) * sampleRate);
    this.analysisLength = Math.round((analysisMs / 1000) * sampleRate);
    this.refractory = Math.round((refractoryMs / 1000) * sampleRate);
    this.triggerRatio = triggerRatio;
    this.absoluteFloor = absoluteFloor;

    this.capture = new Float32Array(this.attackSkip + this.analysisLength);
  }

  get level(): number {
    return this.lastLevel;
  }

  get noiseFloor(): number {
    return this.floor;
  }

  get threshold(): number {
    return Math.max(this.absoluteFloor, this.floor * this.triggerRatio);
  }

  reset(): void {
    this.state = "idle";
    this.captured = 0;
    this.refractoryLeft = 0;
  }

  /**
   * Feed one block of audio. Returns the analysis window when a strike has
   * finished being captured, otherwise null.
   */
  push(frame: Float32Array): Float32Array | null {
    const level = frameRms(frame);
    this.lastLevel = level;

    if (this.state === "refractory") {
      this.refractoryLeft -= frame.length;
      if (this.refractoryLeft <= 0) this.state = "idle";
      return null;
    }

    if (this.state === "capturing") {
      const room = this.capture.length - this.captured;
      const take = Math.min(room, frame.length);
      this.capture.set(frame.subarray(0, take), this.captured);
      this.captured += take;

      if (this.captured >= this.capture.length) {
        // Drop the attack; keep only the tonal decay.
        const window = this.capture.slice(this.attackSkip);
        this.state = "refractory";
        this.refractoryLeft = this.refractory;
        this.captured = 0;
        return window;
      }
      return null;
    }

    // Idle: track the room, and watch for a strike.
    if (level > this.threshold) {
      this.state = "capturing";
      this.captured = 0;
      // Include this frame — it holds the attack we are about to skip past.
      const take = Math.min(this.capture.length, frame.length);
      this.capture.set(frame.subarray(0, take), 0);
      this.captured = take;
      return null;
    }

    // Only adapt the floor while genuinely idle, so a strike never raises it.
    this.floor = this.floor * 0.95 + level * 0.05;
    return null;
  }
}

/**
 * Offline convenience: run the detector across a whole buffer.
 * Used in tests and for analysing recorded samples.
 */
export function detectStrikes(
  samples: Float32Array,
  options: StrikeDetectorOptions,
  blockSize = 1024,
): Float32Array[] {
  const detector = new StrikeDetector(options);
  const out: Float32Array[] = [];

  for (let i = 0; i + blockSize <= samples.length; i += blockSize) {
    const window = detector.push(samples.subarray(i, i + blockSize));
    if (window) out.push(window);
  }
  return out;
}
