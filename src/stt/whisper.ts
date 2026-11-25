import type { Language, Word } from "../types";
import { chunksToWords } from "./chunks";
import type { TranscribeRequest, WorkerMessage } from "./whisper.worker";

export const WHISPER_MODELS = [
  { id: "onnx-community/whisper-tiny_timestamped", label: "Tiny (fastest, least accurate)" },
  { id: "onnx-community/whisper-base_timestamped", label: "Base (balanced)" },
  { id: "onnx-community/whisper-small_timestamped", label: "Small (more accurate, 600 MB download)" },
  {
    id: "onnx-community/whisper-large-v3-turbo_timestamped",
    label: "Large v3 Turbo (most accurate, 1.6 GB download, for Apple silicon Macs or PCs with a recent graphics card)",
  },
] as const;

export const DEFAULT_WHISPER_MODEL = WHISPER_MODELS[2].id;

let worker: Worker | null = null;

function getWorker(): Worker {
  worker ??= new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

/**
 * Transcribes 16 kHz mono audio in the browser and returns words with timestamps.
 * The model is downloaded on first use and cached by the browser afterward.
 */
export function transcribe(
  samples: Float32Array,
  options: { model: string; language: Language; onStatus?: (message: string) => void },
): Promise<Word[]> {
  const w = getWorker();
  return new Promise<Word[]>((resolve, reject) => {
    w.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      switch (message.type) {
        case "status":
          options.onStatus?.(message.message);
          break;
        case "download":
          options.onStatus?.(`Downloading speech model: ${Math.round(message.progress)}%`);
          break;
        case "result":
          resolve(chunksToWords(message.chunks));
          break;
        case "error":
          reject(new Error(message.message));
          break;
      }
    };
    w.onerror = (event) => reject(new Error(event.message || "The transcription worker failed to start."));
    const request: TranscribeRequest = {
      samples,
      model: options.model,
      language: options.language === "auto" ? undefined : options.language,
    };
    w.postMessage(request);
  });
}
