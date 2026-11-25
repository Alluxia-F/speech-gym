import type { PacerSignal } from "../types";

/**
 * The Pacer's signal for a given elapsed time.
 * Green at the minimum, yellow halfway through the range, red at the maximum.
 */
export function pacerSignal(elapsedSeconds: number, minMinutes: number, maxMinutes: number): PacerSignal {
  const min = minMinutes * 60;
  const max = maxMinutes * 60;
  if (elapsedSeconds >= max) return "red";
  if (elapsedSeconds >= (min + max) / 2) return "yellow";
  if (elapsedSeconds >= min) return "green";
  return "none";
}

export type TimingResult = "under" | "within" | "over";

export function timingResult(durationSeconds: number, minMinutes: number, maxMinutes: number): TimingResult {
  if (durationSeconds < minMinutes * 60) return "under";
  if (durationSeconds > maxMinutes * 60) return "over";
  return "within";
}
