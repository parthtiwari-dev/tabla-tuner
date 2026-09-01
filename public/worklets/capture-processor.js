/**
 * Buffers raw mic input into fixed-size blocks and posts them to the main
 * thread. Deliberately does no analysis — all DSP stays in pure, testable
 * functions off the audio thread (RULES B6).
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.blockSize = opts.blockSize || 1024;
    this.buffer = new Float32Array(this.blockSize);
    this.filled = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.filled++] = channel[i];
      if (this.filled === this.blockSize) {
        // slice() copies; the buffer is reused immediately.
        this.port.postMessage(this.buffer.slice(0));
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
