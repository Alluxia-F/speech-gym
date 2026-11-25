import { useEffect, useRef, useState } from "react";
import { playSegment, speakReference } from "../audio/playback";
import { SAMPLE_RATE, startRecording, type RecorderHandle } from "../audio/recorder";
import { compareToScript } from "../clarity/clarity";
import { REPS_TO_COMPLETE, type Drill } from "../practice/drills";
import { wordsToText } from "../stt/chunks";
import { transcribe } from "../stt/whisper";

interface Props {
  drills: Drill[];
  whisperModel: string;
  /** True while the Coach is still writing, so more drills may arrive. */
  coachPending: boolean;
  onBack: () => void;
}

interface DrillProgress {
  clearReps: number;
  attempts: number;
  last?: { heard: string; clear: boolean; samples: Float32Array };
}

type Activity = { drill: string; phase: "starting" | "listening" | "checking" } | null;

/** Scaled input level above which the speaker counts as talking. */
const TALKING_LEVEL = 0.12;
/** Recording stops this long after the speaker goes quiet. */
const SILENCE_MS = 1300;

export function PracticeScreen({ drills, whisperModel, coachPending, onBack }: Props) {
  const [progress, setProgress] = useState<Record<string, DrillProgress>>({});
  const [activity, setActivity] = useState<Activity>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const handle = useRef<RecorderHandle | null>(null);
  const watcher = useRef<number | null>(null);
  /** Whether the speaker's voice was picked up during the current recording. */
  const spokeRef = useRef(false);

  const stopWatching = () => {
    if (watcher.current !== null) window.clearInterval(watcher.current);
    watcher.current = null;
  };

  useEffect(
    () => () => {
      stopWatching();
      handle.current?.cancel();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  const finish = async (drill: Drill) => {
    const h = handle.current;
    if (!h) return;
    handle.current = null;
    stopWatching();
    setActivity({ drill: drill.text, phase: "checking" });
    try {
      const recording = await h.stop();
      // On silence the recognizer tends to invent a word such as "you", so do not ask it.
      if (!spokeRef.current) {
        setError("No voice was picked up on that try. Check that the right microphone is selected, then record again.");
        return;
      }
      const words = await transcribe(recording.samples, { model: whisperModel, language: "english" });
      const result = compareToScript(drill.text, words);
      const clear = result.words.length > 0 && result.words.every((w) => w.status === "clear");
      setProgress((all) => {
        const before = all[drill.text] ?? { clearReps: 0, attempts: 0 };
        return {
          ...all,
          [drill.text]: {
            clearReps: before.clearReps + (clear ? 1 : 0),
            attempts: before.attempts + 1,
            last: { heard: wordsToText(words), clear, samples: recording.samples },
          },
        };
      });
    } catch (err) {
      setError(`Could not check that attempt: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActivity(null);
    }
  };

  const record = async (drill: Drill) => {
    setError(null);
    window.speechSynthesis?.cancel();
    // The microphone takes a moment to open. Speaking before it is ready clips the first sound.
    setActivity({ drill: drill.text, phase: "starting" });
    try {
      spokeRef.current = false;
      let lastLoud = 0;
      handle.current = await startRecording({
        onLevel: (value) => {
          setLevel(value);
          if (value > TALKING_LEVEL) {
            spokeRef.current = true;
            lastLoud = performance.now();
          }
        },
      });
      const startedAt = performance.now();
      lastLoud = startedAt;
      setActivity({ drill: drill.text, phase: "listening" });
      // Longer drills get more time. Recording also ends on its own once the speaker goes quiet.
      const wordCount = drill.text.split(/\s+/).length;
      const maxMs = Math.min(20000, 5000 + wordCount * 700);
      watcher.current = window.setInterval(() => {
        const now = performance.now();
        if ((spokeRef.current && now - lastLoud > SILENCE_MS) || now - startedAt > maxMs) void finish(drill);
      }, 100);
    } catch (err) {
      setActivity(null);
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      setError(
        denied
          ? "Microphone access was blocked. Allow it in your browser's site settings and try again."
          : `Could not start the microphone: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  /** Lets the speaker overrule the listener, which misjudges some correct attempts, mostly single words. */
  const countLastTry = (drill: Drill) => {
    setProgress((all) => {
      const state = all[drill.text];
      if (!state?.last || state.last.clear) return all;
      return { ...all, [drill.text]: { ...state, clearReps: state.clearReps + 1, last: { ...state.last, clear: true } } };
    });
  };

  const done = drills.filter((d) => (progress[d.text]?.clearReps ?? 0) >= REPS_TO_COMPLETE).length;

  return (
    <>
      <section className="card ink">
        <p className="eyebrow">Drill session</p>
        <h2>Practice your sounds</h2>
        <p className="muted">
          Say each drill until the listener hears it clearly {REPS_TO_COMPLETE} times. Listen to the reference first,
          then record. Wait for "Speak now" before you start. Recording stops by itself when you finish speaking.
        </p>
        <p className="muted small">
          The listener is a speech recognizer, and it misjudges some correct attempts, most often with single words.
          Compare your last try with the reference, and choose "I said it right" when you disagree with it.
        </p>
        <div className="drill-total">
          <strong>
            {done} / {drills.length}
          </strong>
          <span>drills complete</span>
        </div>
        {coachPending && <p className="muted small">The Coach is still writing. More drills may appear.</p>}
      </section>

      {error && (
        <p className="error banner" role="alert">
          {error}
        </p>
      )}

      {drills.map((drill) => {
        const state = progress[drill.text] ?? { clearReps: 0, attempts: 0 };
        const complete = state.clearReps >= REPS_TO_COMPLETE;
        const mine = activity?.drill === drill.text ? activity.phase : null;
        const busyElsewhere = activity !== null && !mine;
        return (
          <section key={drill.text} className={`card drill${complete ? " drill-done" : ""}`}>
            <div className="drill-head">
              <p className="drill-text">{drill.text}</p>
              <div
                className="reps"
                role="img"
                aria-label={`${Math.min(state.clearReps, REPS_TO_COMPLETE)} of ${REPS_TO_COMPLETE} clear repetitions`}
              >
                {Array.from({ length: REPS_TO_COMPLETE }, (_, i) => (
                  <i key={i} className={i < state.clearReps ? "on" : undefined} />
                ))}
              </div>
            </div>
            {drill.focus && <p className="muted small drill-focus">{drill.focus}</p>}

            {mine === "starting" && (
              <p className="drill-cue" role="status">
                Get ready
              </p>
            )}
            {mine === "listening" && (
              <p className="drill-cue go" role="status">
                Speak now
              </p>
            )}
            {mine === "listening" && (
              <div className="level" aria-hidden="true">
                {[0.5, 0.8, 1.1, 1.4, 1.1, 0.8, 0.5].map((weight, i) => (
                  <span key={i} style={{ height: `${Math.max(14, Math.min(100, level * weight * 100))}%` }} />
                ))}
              </div>
            )}

            {state.last && !mine && (
              <p className={state.last.clear ? "drill-result clear" : "drill-result unclear"} role="status">
                {state.last.clear ? "Clear. " : "Not yet. "}
                Heard: <strong>{state.last.heard || "nothing"}</strong>
              </p>
            )}

            <div className="actions">
              {mine === "listening" ? (
                <button className="primary" onClick={() => void finish(drill)}>
                  Stop
                </button>
              ) : (
                <button className="primary" disabled={mine !== null || busyElsewhere} onClick={() => void record(drill)}>
                  {mine === "checking" ? "Checking" : mine === "starting" ? "Starting" : complete ? "Say it again" : "Record"}
                </button>
              )}
              <button disabled={activity !== null} onClick={() => speakReference(drill.text)}>
                Reference
              </button>
              {state.last && (
                <button
                  disabled={activity !== null}
                  onClick={() => playSegment(state.last!.samples, 0, state.last!.samples.length / SAMPLE_RATE)}
                >
                  Hear your last try
                </button>
              )}
              {state.last && !state.last.clear && (
                <button disabled={activity !== null} onClick={() => countLastTry(drill)} title="Count this try as clear">
                  I said it right
                </button>
              )}
              {state.attempts > 0 && (
                <span className="muted small">
                  {state.attempts} {state.attempts === 1 ? "try" : "tries"}
                  {complete && ", complete"}
                </span>
              )}
            </div>
          </section>
        );
      })}

      <div className="actions center">
        <button onClick={onBack}>Back to results</button>
      </div>
    </>
  );
}
