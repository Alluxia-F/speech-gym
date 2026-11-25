import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatTime } from "../analysis/metrics";
import { pacerSignal } from "../analysis/pacer";
import { startRecording, type Recording, type RecorderHandle } from "../audio/recorder";
import type { SpeechSetup } from "../types";

interface Props {
  setup: SpeechSetup;
  onDone: (recording: Recording) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

const SIGNAL_TEXT = {
  none: "Keep going",
  green: "Green: minimum reached",
  yellow: "Yellow: head for your close",
  red: "Red: wrap up now",
} as const;

const RING_RADIUS = 106;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
/** Relative heights of the input-level bars, so the meter reads as a small waveform. */
const LEVEL_BARS = [0.5, 0.8, 1.1, 1.4, 1.1, 0.8, 0.5];

export function RecordingScreen({ setup, onDone, onCancel, onError }: Props) {
  const handle = useRef<RecorderHandle | null>(null);
  const speechStartedAt = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startRecording({
      onLevel: setLevel,
      onSpeechStart: () => {
        speechStartedAt.current = performance.now();
      },
    })
      .then((h) => {
        if (cancelled) h.cancel();
        else {
          handle.current = h;
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        onError(
          denied
            ? "Microphone access was blocked. Allow it in your browser's site settings and try again."
            : `Could not start the microphone: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    // The clock runs from the speaker's first word, not from when recording starts.
    const tick = window.setInterval(() => {
      if (speechStartedAt.current !== null) {
        setElapsed((performance.now() - speechStartedAt.current) / 1000);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      handle.current?.cancel();
      handle.current = null;
    };
    // Runs once per recording screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = async () => {
    const h = handle.current;
    if (!h) return;
    handle.current = null;
    setStopping(true);
    try {
      onDone(await h.stop());
    } catch (err) {
      onError(`Could not read the recording: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const signal = pacerSignal(elapsed, setup.minMinutes, setup.maxMinutes);
  const started = speechStartedAt.current !== null;
  const minSeconds = setup.minMinutes * 60;
  const maxSeconds = setup.maxMinutes * 60;
  const progress = Math.min(1, elapsed / maxSeconds);
  const lights = [
    { name: "green", at: minSeconds, color: "var(--green)" },
    { name: "yellow", at: (minSeconds + maxSeconds) / 2, color: "var(--yellow)" },
    { name: "red", at: maxSeconds, color: "var(--red)" },
  ];

  return (
    <section className={`card ink stage signal-${signal}`}>
      <p className="eyebrow">Now speaking</p>
      <h2>{setup.title || "Untitled speech"}</h2>

      <div className="ring">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <circle className="ring-track" cx="120" cy="120" r={RING_RADIUS} />
          <circle
            className="ring-progress"
            cx="120"
            cy="120"
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - progress)}
          />
        </svg>
        <div className="ring-center">
          <div className="clock" aria-live="off">
            {formatTime(elapsed)}
          </div>
          <div className="ring-target">
            Target {setup.minMinutes} to {setup.maxMinutes} min
          </div>
        </div>
      </div>

      <p className="signal" role="status">
        {!ready ? "Starting microphone" : started ? SIGNAL_TEXT[signal] : "The clock starts when you speak"}
      </p>

      <ul className="lights" aria-label="Pacer signals">
        {lights.map((light) => (
          <li
            key={light.name}
            className={elapsed >= light.at ? "on" : undefined}
            style={{ "--light": light.color } as CSSProperties}
          >
            <i aria-hidden="true" /> {formatTime(light.at)}
          </li>
        ))}
      </ul>

      <div className="level" aria-hidden="true">
        {LEVEL_BARS.map((weight, i) => (
          <span key={i} style={{ height: `${Math.max(14, Math.min(100, level * weight * 100))}%` }} />
        ))}
      </div>

      <div className="actions center">
        <button className="primary" disabled={!ready || stopping} onClick={stop}>
          {stopping ? "Finishing" : "Finish speech"}
        </button>
        <button disabled={stopping} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
