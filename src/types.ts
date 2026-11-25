/** One transcribed word (or, for Chinese, one short run of characters) with its timing in seconds. */
export interface Word {
  text: string;
  start: number;
  end: number;
}

export type Language = "auto" | "english" | "chinese";

/** What the speaker enters before speaking. */
export interface SpeechSetup {
  title: string;
  minMinutes: number;
  maxMinutes: number;
  goals: string[];
  /** The text the speaker plans to say. When present, the app checks pronunciation clarity against it. */
  script: string;
}

export type FillerCategory = "sound" | "phrase" | "connector" | "repeat";

export interface FillerHit {
  category: FillerCategory;
  /** The normalized filler, e.g. "um" or "you know". */
  filler: string;
  /** Index of the first word of the hit in the word list. */
  wordIndex: number;
  /** How many words the hit spans. */
  length: number;
  time: number;
}

export interface Pause {
  /** Index of the word the pause comes after. */
  afterWordIndex: number;
  start: number;
  duration: number;
}

export interface SpeechMetrics {
  /** Seconds from the first word to the last. */
  durationSeconds: number;
  /** Words for English; characters count individually for Chinese. */
  unitCount: number;
  unitsPerMinute: number;
  fillers: FillerHit[];
  fillerCounts: Record<FillerCategory, number>;
  fillersPerMinute: number;
  topFiller: { filler: string; count: number } | null;
  pauses: Pause[];
}

export type PacerSignal = "none" | "green" | "yellow" | "red";
