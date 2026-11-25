import { useEffect, useMemo, useRef, useState } from "react";
import { computeMetrics } from "./analysis/metrics";
import { decodeToMono16k, type Recording } from "./audio/recorder";
import { clarityIssues, compareToScript, type ClarityResult } from "./clarity/clarity";
import { recordTroubleWords, type TroubleWord } from "./clarity/troubleWords";
import { buildCoachMessage, COACH_SYSTEM_PROMPT } from "./coach/prompt";
import { createProvider } from "./llm/provider";
import { buildDrills } from "./practice/drills";
import { coachUnavailableReason, loadSettings, saveSettings, type Settings } from "./settings";
import { transcribe } from "./stt/whisper";
import type { SpeechMetrics, SpeechSetup, Word } from "./types";
import { PracticeScreen } from "./ui/PracticeScreen";
import { RecordingScreen } from "./ui/RecordingScreen";
import { ResultsScreen, type CoachState } from "./ui/ResultsScreen";
import { SettingsPanel } from "./ui/SettingsPanel";
import { SetupScreen } from "./ui/SetupScreen";

type Stage =
  | { name: "setup" }
  | { name: "recording" }
  | { name: "processing"; status: string }
  | { name: "results"; words: Word[]; metrics: SpeechMetrics; clarity: ClarityResult | null };

const DEFAULT_SETUP: SpeechSetup = { title: "", minMinutes: 5, maxMinutes: 7, goals: [], script: "" };
const IDLE_COACH: CoachState = { status: "idle", text: "" };
const STEPS = ["Set up", "Speak", "Review", "Drill"];

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [setup, setSetup] = useState<SpeechSetup>(DEFAULT_SETUP);
  const [stage, setStage] = useState<Stage>({ name: "setup" });
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [coach, setCoach] = useState<CoachState>(IDLE_COACH);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [troubleWords, setTroubleWords] = useState<TroubleWord[]>([]);
  const [practicing, setPracticing] = useState(false);
  const coachAbort = useRef<AbortController | null>(null);

  const drills = useMemo(
    () => (stage.name === "results" ? buildDrills(stage.clarity, setup.script, coach.text) : []),
    [stage, setup.script, coach.text],
  );

  // Release the previous recording when a new one replaces it.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const runCoach = async (
    speech: SpeechSetup,
    words: Word[],
    metrics: SpeechMetrics,
    clarity: ClarityResult | null,
    current: Settings,
  ) => {
    if (coachUnavailableReason(current) || words.length === 0) return;
    coachAbort.current?.abort();
    const abort = new AbortController();
    coachAbort.current = abort;

    const provider = createProvider(current);
    setCoach({ status: "running", text: "", providerName: provider.name });
    try {
      const text = await provider.generate({
        system: COACH_SYSTEM_PROMPT,
        user: buildCoachMessage(speech, words, metrics, clarity, current.analysisLanguage),
        signal: abort.signal,
        onText: (delta) => setCoach((c) => ({ ...c, text: c.text + delta })),
      });
      if (!abort.signal.aborted) setCoach({ status: "done", text, providerName: provider.name });
    } catch (err) {
      if (abort.signal.aborted) return;
      setCoach((c) => ({ ...c, status: "error", error: err instanceof Error ? err.message : String(err) }));
    }
  };

  const process = async (speech: SpeechSetup, audio: Float32Array, blob: Blob) => {
    setError(null);
    setPracticing(false);
    setSamples(audio);
    setAudioUrl(URL.createObjectURL(blob));
    setCoach(IDLE_COACH);
    setStage({ name: "processing", status: "Preparing the speech-to-text model" });
    try {
      // A script in Latin letters means English practice, so skip language detection.
      const scriptIsEnglish = speech.script !== "" && !/[\u3400-\u9fff]/.test(speech.script);
      const words = await transcribe(audio, {
        model: settings.whisperModel,
        language: scriptIsEnglish ? "english" : settings.language,
        onStatus: (status) => setStage({ name: "processing", status }),
      });
      const metrics = computeMetrics(words);
      const clarity = speech.script ? compareToScript(speech.script, words) : null;
      if (clarity) setTroubleWords(recordTroubleWords(clarityIssues(clarity)));
      setStage({ name: "results", words, metrics, clarity });
      void runCoach(speech, words, metrics, clarity, settings);
    } catch (err) {
      setError(`Transcription failed: ${err instanceof Error ? err.message : String(err)}`);
      setStage({ name: "setup" });
    }
  };

  const handleUpload = async (speech: SpeechSetup, file: File) => {
    setSetup(speech);
    setError(null);
    setStage({ name: "processing", status: "Reading the audio file" });
    try {
      await process(speech, await decodeToMono16k(file), file);
    } catch (err) {
      setError(`Could not read that file as audio: ${err instanceof Error ? err.message : String(err)}`);
      setStage({ name: "setup" });
    }
  };

  const restart = () => {
    coachAbort.current?.abort();
    setCoach(IDLE_COACH);
    setPracticing(false);
    setStage({ name: "setup" });
  };

  const stepIndex = stage.name === "setup" ? 0 : stage.name !== "results" ? 1 : practicing ? 3 : 2;

  return (
    <main>
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M3 9v6M6.5 6.5v11M17.5 6.5v11M21 9v6M6.5 12h11" />
            </svg>
          </span>
          <span>
            Speech<em>Gym</em>
          </span>
        </h1>
        <button onClick={() => setShowSettings(!showSettings)} aria-expanded={showSettings}>
          {showSettings ? "Close settings" : "Settings"}
        </button>
      </header>

      {!showSettings && (
        <ol className="steps" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={i === stepIndex ? "active" : i < stepIndex ? "done" : undefined}
              aria-current={i === stepIndex ? "step" : undefined}
            >
              <span>0{i + 1}</span> {label}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p className="error banner" role="alert">
          {error}
        </p>
      )}

      {showSettings ? (
        <SettingsPanel
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(next) => {
            setSettings(next);
            saveSettings(next);
          }}
        />
      ) : (
        <>
          {stage.name === "setup" && (
            <SetupScreen
              initial={setup}
              onStart={(speech) => {
                setSetup(speech);
                setError(null);
                setStage({ name: "recording" });
              }}
              onUpload={handleUpload}
            />
          )}

          {stage.name === "recording" && (
            <RecordingScreen
              setup={setup}
              onDone={(recording: Recording) => void process(setup, recording.samples, recording.blob)}
              onCancel={() => setStage({ name: "setup" })}
              onError={(message) => {
                setError(message);
                setStage({ name: "setup" });
              }}
            />
          )}

          {stage.name === "processing" && (
            <section className="card ink center">
              <div className="loader" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <h2>Processing your speech</h2>
              <p role="status">{stage.status}</p>
              <p className="muted small">
                The first run downloads the speech model, which can take a minute. Later runs start right away.
              </p>
            </section>
          )}

          {stage.name === "results" && practicing && (
            <PracticeScreen
              drills={drills}
              whisperModel={settings.whisperModel}
              coachPending={coach.status === "running"}
              onBack={() => setPracticing(false)}
            />
          )}

          {stage.name === "results" && !practicing && (
            <ResultsScreen
              setup={setup}
              words={stage.words}
              metrics={stage.metrics}
              clarity={stage.clarity}
              samples={samples}
              troubleWords={troubleWords}
              audioUrl={audioUrl}
              coach={coach}
              coachBlockedReason={
                stage.words.length === 0
                  ? "There is no transcript to evaluate. Try recording again."
                  : coachUnavailableReason(settings)
              }
              onRunCoach={() => void runCoach(setup, stage.words, stage.metrics, stage.clarity, settings)}
              onOpenSettings={() => setShowSettings(true)}
              onRestart={restart}
              drillCount={drills.length}
              onStartDrills={() => setPracticing(true)}
            />
          )}
        </>
      )}
    </main>
  );
}
