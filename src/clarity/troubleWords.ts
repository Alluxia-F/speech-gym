import { comparable, displayWord, type ClarityIssue } from "./clarity";

/** A word the listener has failed to hear correctly, tracked across sessions. */
export interface TroubleWord {
  word: string;
  /** How many sessions this word was unclear in. */
  count: number;
  /** What it was heard as most recently, or null if it was not heard at all. */
  lastHeard: string | null;
}

const STORAGE_KEY = "speech-gym-trouble-words";

function read(): Record<string, TroubleWord> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, TroubleWord>;
  } catch {
    return {};
  }
}

/** Adds this session's unclear words to the saved list and returns the full list, most frequent first. */
export function recordTroubleWords(issues: ClarityIssue[]): TroubleWord[] {
  const all = read();
  const seenThisSession = new Set<string>();
  for (const issue of issues) {
    const key = comparable(issue.expected);
    if (!key || seenThisSession.has(key)) continue;
    seenThisSession.add(key);
    const existing = all[key];
    all[key] = {
      word: displayWord(issue.expected).toLowerCase(),
      count: (existing?.count ?? 0) + 1,
      lastHeard: issue.heard ? displayWord(issue.heard) : null,
    };
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage can be unavailable in private windows. The list then covers this session only.
  }
  return Object.values(all).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export function clearTroubleWords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
