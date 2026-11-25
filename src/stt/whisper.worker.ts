/// <reference lib="webworker" />
import { pipeline } from "@huggingface/transformers";
import type { WhisperChunk } from "./chunks";

export interface TranscribeRequest {
  samples: Float32Array;
  model: string;
  /** Whisper language name such as "english", or undefined to auto-detect. */
  language?: string;
}

export type WorkerMessage =
  | { type: "status"; message: string }
  | { type: "download"; file: string; progress: number }
  | { type: "result"; chunks: WhisperChunk[] }
  | { type: "error"; message: string };

type Transcriber = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string; chunks?: WhisperChunk[] }>;

let loaded: { model: string; transcriber: Transcriber } | null = null;

const post = (message: WorkerMessage) => self.postMessage(message);

async function getTranscriber(model: string): Promise<Transcriber> {
  if (loaded?.model === model) return loaded.transcriber;

  const webgpu = "gpu" in navigator;
  post({ type: "status", message: `Loading ${model} (${webgpu ? "WebGPU" : "WASM"})` });

  const transcriber = (await pipeline("automatic-speech-recognition", model, {
    device: webgpu ? "webgpu" : "wasm",
    // The large model's full-precision encoder is 2.5 GB, so it uses half precision.
    dtype: webgpu
      ? { encoder_model: model.includes("large") ? "fp16" : "fp32", decoder_model_merged: "q4" }
      : "q8",
    progress_callback: (p: { status: string; file?: string; progress?: number }) => {
      if (p.status === "progress" && p.file) {
        post({ type: "download", file: p.file, progress: p.progress ?? 0 });
      }
    },
  })) as unknown as Transcriber;

  loaded = { model, transcriber };
  return transcriber;
}

self.onmessage = async (event: MessageEvent<TranscribeRequest>) => {
  const { samples, model, language } = event.data;
  try {
    const transcriber = await getTranscriber(model);
    post({ type: "status", message: "Transcribing" });
    const output = await transcriber(samples, {
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
      task: "transcribe",
      ...(language ? { language } : {}),
    });
    post({ type: "result", chunks: output.chunks ?? [] });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
