import type { FillerCategory, FillerHit, Pause, SpeechMetrics, Word } from "../types";

/** A silence between two words longer than this counts as a long pause. */
export const LONG_PAUSE_SECONDS = 2;

const FILLER_SOUNDS = new Set(["um", "umm", "uh", "uhh", "uhm", "ah", "er", "erm", "hmm", "mm", "嗯", "呃", "额"]);

/** Multi-word crutch phrases, as normalized word sequences. Longest first so they win over shorter ones. */
const CRUTCH_PHRASES: string[][] = [
  ["you", "know", "what", "i", "mean"],
  ["you", "know"],
  ["i", "mean"],
  ["kind", "of"],
  ["sort", "of"],
  ["basically"],
  ["literally"],
];

/** Chinese crutch phrases, matched against the joined text. Longest first. */
const CHINESE_PHRASES = ["就是说", "那个", "就是", "然后"];

/** Words counted only when they are used as a stall: opening a sentence, or doubled. */
const CONNECTORS = new Set(["and", "so", "but"]);

const CJK = /[㐀-鿿]/;
const SENTENCE_END = /[.?!。？！]["')\]]?$/;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']/gu, "")
    .trim();
}

/** Speaking units in one transcribed word: 1 for a Latin word, 1 per character for Chinese. */
export function countUnits(text: string): number {
  const clean = normalize(text);
  if (!clean) return 0;
  const cjkChars = [...clean].filter((c) => CJK.test(c)).length;
  const hasLatin = /[a-z0-9]/.test(clean);
  return cjkChars + (hasLatin ? 1 : 0);
}

/**
 * The longest a word plausibly takes to say. Whisper often stretches the end time of the
 * word before a silence to cover the silence, so a word's end time cannot be trusted alone.
 */
function maxSpokenSeconds(text: string): number {
  const clean = normalize(text);
  const cjkChars = [...clean].filter((c) => CJK.test(c)).length;
  const latinChars = clean.length - cjkChars;
  return Math.min(1.5, 0.3 + 0.08 * latinChars + 0.35 * cjkChars);
}

export function findPauses(words: Word[], thresholdSeconds = LONG_PAUSE_SECONDS): Pause[] {
  const pauses: Pause[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const spokenEnd = Math.min(words[i].end, words[i].start + maxSpokenSeconds(words[i].text));
    const gap = words[i + 1].start - spokenEnd;
    if (gap >= thresholdSeconds) {
      pauses.push({ afterWordIndex: i, start: spokenEnd, duration: gap });
    }
  }
  return pauses;
}

export function findFillers(words: Word[]): FillerHit[] {
  const norm = words.map((w) => normalize(w.text));
  const hits: FillerHit[] = [];
  const taken = new Array<boolean>(words.length).fill(false);

  const add = (category: FillerCategory, filler: string, wordIndex: number, length: number) => {
    for (let k = wordIndex; k < wordIndex + length; k++) taken[k] = true;
    hits.push({ category, filler, wordIndex, length, time: words[wordIndex].start });
  };

  // Crutch phrases first, so "you know" is not also read as two plain words.
  for (let i = 0; i < norm.length; i++) {
    if (taken[i]) continue;
    for (const phrase of CRUTCH_PHRASES) {
      const matches = phrase.every((p, k) => norm[i + k] === p && !taken[i + k]);
      if (matches) {
        add("phrase", phrase.join(" "), i, phrase.length);
        break;
      }
    }
  }

  for (let i = 0; i < norm.length; i++) {
    if (taken[i] || !norm[i]) continue;
    const word = norm[i];

    if (FILLER_SOUNDS.has(word)) {
      add("sound", word, i, 1);
      continue;
    }

    // Chinese transcripts arrive as short runs of characters, so look inside each run.
    if (CJK.test(word)) {
      let rest = word;
      for (const phrase of CHINESE_PHRASES) {
        while (rest.includes(phrase)) {
          hits.push({ category: "phrase", filler: phrase, wordIndex: i, length: 1, time: words[i].start });
          rest = rest.replace(phrase, " ");
        }
      }
      for (const char of rest) {
        if (FILLER_SOUNDS.has(char)) {
          hits.push({ category: "sound", filler: char, wordIndex: i, length: 1, time: words[i].start });
        }
      }
      continue;
    }

    // Immediate repetition: "I I think", "and, and".
    if (i > 0 && norm[i - 1] === word) {
      const category: FillerCategory = CONNECTORS.has(word) ? "connector" : "repeat";
      add(category, `${word} ${word}`, i, 1);
      continue;
    }

    // A connector opening a sentence is treated as a stall. The first word of the speech is not.
    if (CONNECTORS.has(word) && i > 0 && SENTENCE_END.test(words[i - 1].text.trim())) {
      add("connector", word, i, 1);
    }
  }

  return hits.sort((a, b) => a.wordIndex - b.wordIndex);
}

export function computeMetrics(words: Word[]): SpeechMetrics {
  const fillerCounts: Record<FillerCategory, number> = { sound: 0, phrase: 0, connector: 0, repeat: 0 };
  if (words.length === 0) {
    return {
      durationSeconds: 0,
      unitCount: 0,
      unitsPerMinute: 0,
      fillers: [],
      fillerCounts,
      fillersPerMinute: 0,
      topFiller: null,
      pauses: [],
    };
  }

  const durationSeconds = Math.max(0, words[words.length - 1].end - words[0].start);
  const minutes = durationSeconds / 60;
  const unitCount = words.reduce((sum, w) => sum + countUnits(w.text), 0);
  const fillers = findFillers(words);

  const byFiller = new Map<string, number>();
  for (const hit of fillers) {
    fillerCounts[hit.category]++;
    byFiller.set(hit.filler, (byFiller.get(hit.filler) ?? 0) + 1);
  }
  let topFiller: SpeechMetrics["topFiller"] = null;
  for (const [filler, count] of byFiller) {
    if (!topFiller || count > topFiller.count) topFiller = { filler, count };
  }

  return {
    durationSeconds,
    unitCount,
    unitsPerMinute: minutes > 0 ? unitCount / minutes : 0,
    fillers,
    fillerCounts,
    fillersPerMinute: minutes > 0 ? fillers.length / minutes : 0,
    topFiller,
    pauses: findPauses(words),
  };
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
