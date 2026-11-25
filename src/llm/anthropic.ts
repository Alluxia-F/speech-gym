import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, TextRequest } from "./provider";

/**
 * Models that support server-side refusal fallback. If one of these declines a request,
 * the API re-runs it on a fallback model inside the same call.
 */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-2"]);

export function createAnthropicProvider(apiKey: string, model: string): LlmProvider {
  // The key belongs to the person using the app and never leaves their browser except
  // to call the API, so calling from the browser is the intended setup here.
  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });

  return {
    name: model,
    async generate({ system, user, onText, signal }: TextRequest): Promise<string> {
      try {
        const useFallback = FALLBACK_MODELS.has(model);
        const stream = client.beta.messages.stream(
          {
            model,
            max_tokens: 16000,
            system,
            messages: [{ role: "user", content: user }],
            output_config: { effort: "high" },
            ...(useFallback
              ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
              : {}),
          },
          { signal },
        );
        if (onText) stream.on("text", onText);

        const message = await stream.finalMessage();
        if (message.stop_reason === "refusal") {
          throw new Error("The model declined to evaluate this speech. Try a different model in Settings.");
        }

        const text = message.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("");
        if (message.stop_reason === "max_tokens") {
          return `${text}\n\n(The evaluation was cut off because it reached the length limit.)`;
        }
        return text;
      } catch (err) {
        throw toReadableError(err);
      }
    },
  };
}

function toReadableError(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError) {
    return new Error("The Anthropic API key was rejected. Check the key in Settings.");
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new Error("This API key does not have access to the selected model.");
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new Error("The selected model was not found. Choose another model in Settings.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new Error("Anthropic rate limit reached. Wait a moment and try again.");
  }
  if (err instanceof Anthropic.APIUserAbortError) {
    return new Error("The evaluation was cancelled.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new Error("Could not reach the Anthropic API. Check your internet connection.");
  }
  if (err instanceof Anthropic.APIError) {
    return new Error(`Anthropic API error ${err.status ?? ""}: ${err.message}`);
  }
  return err instanceof Error ? err : new Error(String(err));
}
