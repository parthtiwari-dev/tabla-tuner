/**
 * Microphone capture.
 *
 * The only file that touches Web Audio. Everything downstream works on plain
 * Float32Arrays so it stays testable without a browser (RULES B6).
 */

export interface CaptureHandle {
  sampleRate: number;
  stop: () => Promise<void>;
}

/**
 * Browser audio processing is tuned for speech and destroys percussive
 * transients — echo cancellation and noise suppression mangle the attack,
 * auto gain fights the decay envelope we measure.
 *
 * These default to `true`, so they must be turned off explicitly. If pitch
 * readings are ever inexplicably unstable, check this first (RULES A1).
 */
export const RAW_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
};

export class MicPermissionError extends Error {
  constructor(cause: unknown) {
    super(
      "Microphone access was refused or is unavailable. The tuner needs the mic " +
        "to hear the drum; nothing is recorded or sent anywhere.",
    );
    this.name = "MicPermissionError";
    this.cause = cause;
  }
}

/**
 * Start capturing. `onBlock` receives fixed-size blocks of mono audio.
 * Must be called from a user gesture (RULES A5).
 */
export async function startCapture(
  onBlock: (block: Float32Array) => void,
  blockSize = 1024,
): Promise<CaptureHandle> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: RAW_AUDIO_CONSTRAINTS });
  } catch (err) {
    throw new MicPermissionError(err);
  }

  const context = new AudioContext();
  // Autoplay policy can leave a fresh context suspended.
  if (context.state === "suspended") await context.resume();

  await context.audioWorklet.addModule("/worklets/capture-processor.js");

  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, "capture-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    processorOptions: { blockSize },
  });

  node.port.onmessage = (event: MessageEvent<Float32Array>) => onBlock(event.data);
  source.connect(node);

  return {
    // Never assume 44100 — cents maths is sample-rate-relative (RULES A2).
    sampleRate: context.sampleRate,
    stop: async () => {
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      for (const track of stream.getTracks()) track.stop();
      await context.close();
    },
  };
}
