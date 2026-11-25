import type { Word } from "../types";

/** The shape transformers.js returns for each word when `return_timestamps: "word"` is set. */
export interface WhisperChunk {
  text: string;
  timestamp: [number, number | null];
}

const NON_SPEECH = /^[\[(*♪].*[\])*♪]?$/;

/** Converts Whisper's word chunks into our Word list, repairing missing or out-of-order times. */
export function chunksToWords(chunks: WhisperChunk[]): Word[] {
  const words: Word[] = [];
  for (const chunk of chunks) {
    const text = chunk.text.trim();
    // Whisper labels non-speech audio with tags such as [BLANK_AUDIO] or (music). They are not words.
    if (!text || NON_SPEECH.test(text)) continue;
    const previousEnd = words.length ? words[words.length - 1].end : 0;
    const start = Math.max(chunk.timestamp[0] ?? previousEnd, previousEnd);
    const end = Math.max(chunk.timestamp[1] ?? start, start);
    words.push({ text, start, end });
  }
  return words;
}

/** Joins words into readable text: spaces between Latin words, none between Chinese characters. */
export function wordsToText(words: Word[]): string {
  const cjk = /[　-鿿＀-￯]/;
  let out = "";
  for (const w of words) {
    const needsSpace = out.length > 0 && !(cjk.test(out[out.length - 1]) && cjk.test(w.text[0]));
    out += (needsSpace ? " " : "") + w.text;
  }
  return out;
}
