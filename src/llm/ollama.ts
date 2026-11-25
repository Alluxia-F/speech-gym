import type { LlmProvider, TextRequest } from "./provider";

/** Talks to a local Ollama server. No API key, and nothing leaves the machine. */
export function createOllamaProvider(baseUrl: string, model: string): LlmProvider {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/chat`;

  return {
    name: `${model} (Ollama)`,
    async generate({ system, user, onText, signal }: TextRequest): Promise<string> {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            model,
            stream: true,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        });
      } catch {
        throw new Error(`Could not reach Ollama at ${baseUrl}. Check that Ollama is running.`);
      }
      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Ollama returned ${response.status}. ${detail}`.trim());
      }

      // Ollama streams one JSON object per line.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      let text = "";
      const handleLine = (line: string) => {
        if (!line.trim()) return;
        const data = JSON.parse(line) as { message?: { content?: string }; error?: string };
        if (data.error) throw new Error(`Ollama error: ${data.error}`);
        const delta = data.message?.content ?? "";
        if (delta) {
          text += delta;
          onText?.(delta);
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";
        lines.forEach(handleLine);
      }
      handleLine(buffered);
      return text;
    },
  };
}
