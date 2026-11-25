import type { Settings } from "../settings";
import { createAnthropicProvider } from "./anthropic";
import { createOllamaProvider } from "./ollama";

export interface TextRequest {
  system: string;
  user: string;
  /** Called with each piece of text as it arrives. */
  onText?: (delta: string) => void;
  signal?: AbortSignal;
}

/** A language model that any AI role can use. Each provider implements this one method. */
export interface LlmProvider {
  /** Display name, e.g. "Claude Opus 5.5". */
  name: string;
  /** Streams a reply and resolves with the full text. Rejects with a user-readable Error. */
  generate(request: TextRequest): Promise<string>;
}

export function createProvider(settings: Settings): LlmProvider {
  return settings.provider === "ollama"
    ? createOllamaProvider(settings.ollamaUrl, settings.ollamaModel)
    : createAnthropicProvider(settings.anthropicKey, settings.anthropicModel);
}
