/** Sample rate Whisper expects. */
export const SAMPLE_RATE = 16000;

/** Input level above which we treat the speaker as having started talking. */
const SPEECH_LEVEL = 0.03;

export interface Recording {
  /** The original recording, for playback. */
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

  const recorder = new MediaRecorder(stream);
  const parts: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) parts.push(e.data);
  };

  // Level meter and first-voice detection.
  const meterContext = new AudioContext();
  // Browsers can create the context suspended. Without this the meter reads silence and the clock never starts.
  if (meterContext.state === "suspended") await meterContext.resume();
  const analyser = meterContext.createAnalyser();
  // About 85 ms of audio per reading, polled every 80 ms, so no sound falls between readings.
  analyser.fftSize = 4096;
  meterContext.createMediaStreamSource(stream).connect(analyser);
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

  const cleanup = () => {
    window.clearInterval(meter);
    stream.getTracks().forEach((t) => t.stop());
    void meterContext.close();
  };

  recorder.start(1000);

  return {
    stop() {
      return new Promise<Recording>((resolve, reject) => {
        recorder.onstop = async () => {
          cleanup();
          try {
            const blob = new Blob(parts, { type: recorder.mimeType });
            resolve({ blob, samples: await decodeToMono16k(blob) });
          } catch (err) {
            reject(err);
          }
        };
        recorder.stop();
      });
    },
    cancel() {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      cleanup();
    },
  };
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
