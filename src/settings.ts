import { DEFAULT_WHISPER_MODEL } from "./stt/whisper";
import type { Language } from "./types";

export type ProviderId = "anthropic" | "ollama";

/** "none" adds no extra section. */
export type AnalysisLanguage = "none" | "chinese";

export interface Settings {
  provider: ProviderId;
  /** The user's own key. Stored only in this browser's localStorage. */
  anthropicKey: string;
  anthropicModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  whisperModel: string;
  language: Language;
  /** Language for the extra analysis the Coach adds for people practicing a second language. */
  analysisLanguage: AnalysisLanguage;
}

export const ANTHROPIC_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (recommended)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (faster, lower cost)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (fastest, lowest cost)" },
  { id: "claude-fable-5-2", label: "Claude Fable 5.2 (most capable, highest cost)" },
] as const;

export const DEFAULT_SETTINGS: Settings = {
  provider: "anthropic",
  anthropicKey: "",
  anthropicModel: "claude-opus-5-5",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama3.1",
  whisperModel: DEFAULT_WHISPER_MODEL,
  language: "auto",
  // People whose browser is in Chinese get the Chinese analysis without having to find the setting.
  analysisLanguage: typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("zh") ? "chinese" : "none",
};

const STORAGE_KEY = "speech-gym-settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in private windows. The settings then last for this page only.
  }
}

/** Why the Coach cannot run with these settings, or null when it can. */
export function coachUnavailableReason(settings: Settings): string | null {
  if (settings.provider === "anthropic" && !settings.anthropicKey.trim()) {
    return "Add your Anthropic API key in Settings, or switch to a local Ollama model.";
  }
  if (settings.provider === "ollama" && !settings.ollamaModel.trim()) {
    return "Enter the name of an Ollama model in Settings.";
  }
  return null;
}
