import { SAMPLE_RATE } from "./recorder";

let context: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;

/**
 * Plays one stretch of the recording, given in seconds.
 * It plays from the decoded samples, which is exact. Seeking a live recording in an
 * audio element is unreliable in some browsers.
 */
export function playSegment(samples: Float32Array, start: number, end: number): void {
  context ??= new AudioContext();
  void context.resume();
  current?.stop();

  const from = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const to = Math.min(samples.length, Math.ceil(end * SAMPLE_RATE));
  if (to <= from) return;

  const buffer = context.createBuffer(1, to - from, SAMPLE_RATE);
  buffer.copyToChannel(samples.slice(from, to), 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  current = source;
}

/** Says a word with the browser's built-in English voice, slightly slowed, as a reference. */
export function speakReference(text: string): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  synth.speak(utterance);
}
