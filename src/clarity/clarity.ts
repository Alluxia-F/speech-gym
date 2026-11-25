import type { Word } from "../types";

export type ClarityStatus =
  /** The listener heard the word as written. */
  | "clear"
  /** The listener heard a different word. */
  | "misheard"
  /** The listener heard nothing where this word should be. */
  | "missed"
  /** The speaker stopped before reaching this word. It does not count against the score. */
  | "unreached";

export interface ScriptWord {
  /** The word as written in the script, with its punctuation. */
  text: string;
  status: ClarityStatus;
  /** What the listener heard instead, for misheard words. */
  heard?: string;
  /** Index of the matching word in the transcript, used to play back that moment. */
  wordIndex?: number;
}

export interface ClarityResult {
  words: ScriptWord[];
  /** Script words the speaker reached. */
  spokenCount: number;
  clearCount: number;
  /** Share of reached words heard correctly, 0 to 1. */
  score: number;
}

const NUMBER_WORDS: Record<string, string> = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "10": "ten",
  "11": "eleven",
  "12": "twelve",
  "1st": "first",
  "2nd": "second",
  "3rd": "third",
};

/** Spellings that sound the same, so a difference between them says nothing about pronunciation. */
const SAME_SOUND: Record<string, string> = {
  ok: "okay",
  alright: "allright",
  gonna: "goingto",
  wanna: "wantto",
  "&": "and",
};

/** Reduces a word to the form used for comparison. */
export function comparable(text: string): string {
  const clean = text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}'&]/gu, "")
    .replace(/^'+|'+$/g, "");
  return NUMBER_WORDS[clean] ?? SAME_SOUND[clean] ?? clean;
}

/**
 * Compares what the speech recognizer heard against the script the speaker meant to say.
 * Words the recognizer got wrong are the ones most likely to have been unclear.
 *
 * Uses a standard edit-distance alignment. Extra words in the transcript, such as fillers
 * and ad-libs, are ignored: they are not pronunciation problems.
 */
export function compareToScript(script: string, transcript: Word[]): ClarityResult {
  const scriptTokens = script.split(/\s+/).filter((t) => comparable(t));
  const expected = scriptTokens.map(comparable);
  const heard = transcript.map((w) => comparable(w.text));

  const n = expected.length;
  const m = heard.length;
  // cost[i][j]: fewest edits to align the first i script words with the first j heard words.
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) cost[i][0] = i;
  for (let j = 0; j <= m; j++) cost[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = expected[i - 1] === heard[j - 1] && heard[j - 1] !== "";
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] + (same ? 0 : 1),
        cost[i - 1][j] + 1,
        cost[i][j - 1] + 1,
      );
    }
  }

  const words: ScriptWord[] = scriptTokens.map((text) => ({ text, status: "missed" as ClarityStatus }));
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const same = expected[i - 1] === heard[j - 1] && heard[j - 1] !== "";
    if (cost[i][j] === cost[i - 1][j - 1] + (same ? 0 : 1)) {
      words[i - 1] = same
        ? { text: scriptTokens[i - 1], status: "clear", wordIndex: j - 1 }
        : { text: scriptTokens[i - 1], status: "misheard", heard: transcript[j - 1].text, wordIndex: j - 1 };
      i--;
      j--;
    } else if (cost[i][j] === cost[i - 1][j] + 1) {
      i--;
    } else {
      j--;
    }
  }

  // Script words after the last one the speaker reached were never attempted.
  let lastReached = -1;
  words.forEach((w, index) => {
    if (w.status !== "missed") lastReached = index;
  });
  for (let k = lastReached + 1; k < words.length; k++) words[k].status = "unreached";

  const spokenCount = lastReached + 1;
  const clearCount = words.filter((w) => w.status === "clear").length;
  return { words, spokenCount, clearCount, score: spokenCount > 0 ? clearCount / spokenCount : 0 };
}

export interface ClarityIssue {
  expected: string;
  /** What was heard, or null when nothing was heard. */
  heard: string | null;
  scriptIndex: number;
  wordIndex?: number;
}

export function clarityIssues(result: ClarityResult): ClarityIssue[] {
  const issues: ClarityIssue[] = [];
  result.words.forEach((w, scriptIndex) => {
    if (w.status === "misheard") {
      issues.push({ expected: w.text, heard: w.heard ?? null, scriptIndex, wordIndex: w.wordIndex });
    } else if (w.status === "missed") {
      issues.push({ expected: w.text, heard: null, scriptIndex });
    }
  });
  return issues;
}

/** Strips surrounding punctuation for display, keeping the word's own capitalization. */
export function displayWord(text: string): string {
  return text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}
