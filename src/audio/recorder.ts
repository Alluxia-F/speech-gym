/** Sample rate Whisper expects. */
export const SAMPLE_RATE = 16000;

/** Input level above which we treat the speaker as having started talking. */
const SPEECH_LEVEL = 0.03;

export interface Recording {
  /** The recording as a WAV file, for playback. */
  blob: Blob;
  /** Mono samples at 16 kHz, for transcription. */
  samples: Float32Array;
}

export interface RecorderHandle {
  stop(): Promise<Recording>;
  cancel(): void;
}

export interface RecorderCallbacks {
  /** Called about twelve times a second with the input level, 0 to 1. */
  onLevel?: (level: number) => void;
  /** Called once, the first time the speaker's voice is detected. */
  onSpeechStart?: () => void;
}

export async function startRecording(callbacks: RecorderCallbacks = {}): Promise<RecorderHandle> {
  // Noise suppression and echo cancellation are tuned for calls. They thin out quiet consonants
  // such as "th", "s", and "f", which are exactly the sounds a pronunciation check needs to hear.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
  });

  // Level meter and first-voice detection.
  const meterContext = new AudioContext();
  // Browsers can create the context suspended. Without this the meter reads silence and the clock never starts.
  if (meterContext.state === "suspended") await meterContext.resume();
  const analyser = meterContext.createAnalyser();
  // About 85 ms of audio per reading, polled every 80 ms, so no sound falls between readings.
  analyser.fftSize = 4096;
  const source = meterContext.createMediaStreamSource(stream);
  source.connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);
  let speechStarted = false;
  const meter = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (const v of buffer) sum += v * v;
    const level = Math.sqrt(sum / buffer.length);
    callbacks.onLevel?.(Math.min(1, level * 4));
    if (!speechStarted && level > SPEECH_LEVEL) {
      speechStarted = true;
      callbacks.onSpeechStart?.();
    }
  }, 80);

  // Raw samples are collected directly from the microphone. Recording to a compressed file and
  // decoding it afterward fails in some browsers with "Unable to decode audio data".
  await meterContext.audioWorklet.addModule(captureModuleUrl());
  const capture = new AudioWorkletNode(meterContext, "pcm-capture", { numberOfInputs: 1, numberOfOutputs: 0 });
  const parts: Float32Array[] = [];
  capture.port.onmessage = (e: MessageEvent<Float32Array>) => parts.push(e.data);
  source.connect(capture);

  const cleanup = () => {
    window.clearInterval(meter);
    capture.port.onmessage = null;
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void meterContext.close();
  };

  return {
    async stop() {
      const rate = meterContext.sampleRate;
      cleanup();
      const length = parts.reduce((n, p) => n + p.length, 0);
      if (length < rate * 0.2) throw new Error("No audio was captured. Check that the right microphone is selected.");
      const native = new Float32Array(length);
      let offset = 0;
      for (const p of parts) {
        native.set(p, offset);
        offset += p.length;
      }
      return { blob: encodeWav(native, rate), samples: await resample(native, rate, SAMPLE_RATE) };
    },
    cancel() {
      cleanup();
    },
  };
}

let captureUrl: string | null = null;

/** A tiny audio worklet that passes each block of microphone samples to the page. */
function captureModuleUrl(): string {
  const code = `
    class PcmCapture extends AudioWorkletProcessor {
      process(inputs) {
        const channel = inputs[0] && inputs[0][0];
        if (channel) this.port.postMessage(channel.slice());
        return true;
      }
    }
    registerProcessor("pcm-capture", PcmCapture);`;
  captureUrl ??= URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
  return captureUrl;
}

async function resample(samples: Float32Array, from: number, to: number): Promise<Float32Array> {
  if (from === to) return samples;
  const offline = new OfflineAudioContext(1, Math.ceil((samples.length * to) / from), to);
  const buffer = offline.createBuffer(1, samples.length, from);
  buffer.getChannelData(0).set(samples);
  const node = offline.createBufferSource();
  node.buffer = buffer;
  node.connect(offline.destination);
  node.start();
  return (await offline.startRendering()).getChannelData(0).slice();
}

/** Packs mono samples into a 16-bit WAV file, which every browser can play back. */
function encodeWav(samples: Float32Array, rate: number): Blob {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

/** Decodes any audio the browser can play into mono 16 kHz samples. */
export async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (decoded.numberOfChannels === 1) return decoded.getChannelData(0).slice();
    const mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const channel = decoded.getChannelData(c);
      for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels;
    }
    return mono;
  } finally {
    void context.close();
  }
}
