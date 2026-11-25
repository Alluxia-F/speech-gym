import { useRef, useState } from "react";
import type { SpeechSetup } from "../types";

/** Common target lengths in minutes: a quick test, a short talk, and a standard speech. */
const PRESETS: [number, number][] = [
  [1, 2],
  [3, 5],
  [5, 7],
];

interface Props {
  initial: SpeechSetup;
  onStart: (setup: SpeechSetup) => void;
  onUpload: (setup: SpeechSetup, file: File) => void;
}

export function SetupScreen({ initial, onStart, onUpload }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [minMinutes, setMinMinutes] = useState(initial.minMinutes);
  const [maxMinutes, setMaxMinutes] = useState(initial.maxMinutes);
  const [goals, setGoals] = useState<string[]>([...initial.goals, "", "", ""].slice(0, 3));
  const [script, setScript] = useState(initial.script);
  const fileInput = useRef<HTMLInputElement>(null);

  const rangeValid = minMinutes > 0 && maxMinutes > minMinutes;
  const setup = (): SpeechSetup => ({
    title: title.trim(),
    minMinutes,
    maxMinutes,
    goals: goals.map((g) => g.trim()).filter(Boolean),
    script: script.trim(),
  });

  return (
    <section className="card">
      <p className="eyebrow">Today's workout</p>
      <h2>Prepared speech</h2>
      <p className="muted">
        Tell the Coach about your speech and what you want to work on. Then speak, and get an evaluation.
      </p>

      <label>
        Speech title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The day I learned to listen" />
      </label>

      <div role="group" aria-label="Target length">
        <span className="small" style={{ fontWeight: 600 }}>
          Target length
        </span>
        <div className="chips">
          {PRESETS.map(([min, max]) => (
            <button
              key={min}
              type="button"
              className="chip"
              aria-pressed={minMinutes === min && maxMinutes === max}
              onClick={() => {
                setMinMinutes(min);
                setMaxMinutes(max);
              }}
            >
              {min} to {max} min
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <label>
          Minimum minutes
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={minMinutes}
            onChange={(e) => setMinMinutes(Number(e.target.value))}
          />
        </label>
        <label>
          Maximum minutes
          <input
            type="number"
            min={1}
            step={0.5}
            value={maxMinutes}
            onChange={(e) => setMaxMinutes(Number(e.target.value))}
          />
        </label>
      </div>
      {!rangeValid && <p className="error">The maximum must be greater than the minimum.</p>}

      <fieldset>
        <legend>Goals for this attempt (up to three)</legend>
        {goals.map((goal, i) => (
          <div className="goal" key={i}>
            <span className="goal-number" aria-hidden="true">
              {i + 1}
            </span>
            <input
              value={goal}
              aria-label={`Goal ${i + 1}`}
              onChange={(e) => setGoals(goals.map((g, k) => (k === i ? e.target.value : g)))}
              placeholder={["Fewer filler words", "A stronger opening", "Finish on time"][i]}
            />
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>Clarity check (optional)</legend>
        <label>
          Your script
          <textarea
            rows={5}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste the text you are going to say. The app will show which words a listener could not make out."
          />
        </label>
        <p className="muted small">
          For pronunciation practice in English. Read the script as written. Leave this empty for a free speech.
        </p>
      </fieldset>

      <div className="actions">
        <button className="primary" disabled={!rangeValid} onClick={() => onStart(setup())}>
          Start speaking
        </button>
        <button disabled={!rangeValid} onClick={() => fileInput.current?.click()}>
          Use an audio file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,video/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(setup(), file);
            e.target.value = "";
          }}
        />
      </div>
      <p className="muted small">
        Your microphone audio is transcribed in this browser. Only the transcript is sent to the Coach's language model.
      </p>
    </section>
  );
}
