/**
 * AudioWorklet processor for microphone capture.
 * Converts Float32 audio to PCM16 and posts it to the main thread.
 * Runs on a dedicated audio thread — no main thread jank.
 */
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._muted = false;
    this.port.onmessage = (event) => {
      if (event.data.type === 'mute') {
        this._muted = event.data.muted;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const float32 = input[0];
    const pcm16 = new Int16Array(float32.length);

    if (this._muted) {
      // Send silence (all zeros) to keep VAD stream alive
    } else {
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
    }

    this.port.postMessage({ pcm16 }, [pcm16.buffer]);
    return true;
  }
}

registerProcessor('mic-processor', MicProcessor);
