import { useEffect, useMemo, useState } from "react";
import { formatTime } from "../analysis/metrics";
import { timingResult } from "../analysis/pacer";
import { extractSpokenPart } from "../coach/prompt";
import type { SpeechMetrics, SpeechSetup, Word } from "../types";
import type { ClarityResult } from "../clarity/clarity";
import type { TroubleWord } from "../clarity/troubleWords";
import { stripDrillSection } from "../practice/drills";
import { ClarityCard } from "./ClarityCard";
import { Markdown } from "./Markdown";

export interface CoachState {
  status: "idle" | "running" | "done" | "error";
  text: string;
  error?: string;
  providerName?: string;
}

interface Props {
  setup: SpeechSetup;
  words: Word[];
  metrics: SpeechMetrics;
  clarity: ClarityResult | null;
  samples: Float32Array | null;
  troubleWords: TroubleWord[];
  audioUrl: string | null;
  coach: CoachState;
  coachBlockedReason: string | null;
  onRunCoach: () => void;
  onOpenSettings: () => void;
  onRestart: () => void;
  drillCount: number;
  onStartDrills: () => void;
}

const TIMING_TEXT = {
  under: "Under the target",
  within: "Within the target",
  over: "Over the target",
} as const;

const CATEGORY_LABELS = {
  sound: "Filler sounds",
  phrase: "Crutch phrases",
  connector: "Connectors used as stalls",
  repeat: "Repeated words",
} as const;

export function ResultsScreen(props: Props) {
  const { setup, words, metrics, audioUrl, coach, coachBlockedReason } = props;
  const timing = timingResult(metrics.durationSeconds, setup.minMinutes, setup.maxMinutes);
  const [speaking, setSpeaking] = useState(false);

  // Stop any speech when leaving the results.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const fillerWordIndexes = useMemo(() => {
    const set = new Set<number>();
    for (const hit of metrics.fillers) {
      for (let i = hit.wordIndex; i < hit.wordIndex + hit.length; i++) set.add(i);
    }
    return set;
  }, [metrics.fillers]);
  const pauseAfter = useMemo(
    () => new Map(metrics.pauses.map((p) => [p.afterWordIndex, p.duration])),
    [metrics.pauses],
  );

  const toggleReadAloud = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const text = extractSpokenPart(coach.text);
    const utterance = new SpeechSynthesisUtterance(text);
    if (/[㐀-鿿]/.test(text)) utterance.lang = "zh-CN";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  };

  return (
    <>
      <section className="card ink">
        <p className="eyebrow">Your results</p>
        <h2>{setup.title || "Untitled speech"}</h2>
        {audioUrl && <audio controls src={audioUrl} />}
        <div className="stats">
          <div className={`stat timing-${timing}`}>
            <span className="stat-label">Pacer</span>
            <span className="stat-value">{formatTime(metrics.durationSeconds)}</span>
            <span className="stat-note">
              {TIMING_TEXT[timing]} ({setup.minMinutes} to {setup.maxMinutes} min)
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Pace</span>
            <span className="stat-value">{Math.round(metrics.unitsPerMinute)}</span>
            <span className="stat-note">words per minute</span>
          </div>
          <div className="stat">
            <span className="stat-label">Spotter</span>
            <span className="stat-value">{metrics.fillers.length}</span>
            <span className="stat-note">fillers, {metrics.fillersPerMinute.toFixed(1)} per minute</span>
          </div>
          {props.clarity && props.clarity.spokenCount > 0 && (
            <div className="stat">
              <span className="stat-label">Clarity</span>
              <span className="stat-value">{Math.round(props.clarity.score * 100)}%</span>
              <span className="stat-note">of words heard as written</span>
            </div>
          )}
          <div className="stat">
            <span className="stat-label">Long pauses</span>
            <span className="stat-value">{metrics.pauses.length}</span>
            <span className="stat-note">2 seconds or longer</span>
          </div>
        </div>
      </section>

      <section className="card coach">
        <div className="coach-head">
          <span className="avatar" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16v10H9l-5 4z" />
            </svg>
          </span>
          <div>
            <p className="eyebrow">Evaluation</p>
            <h2>Coach</h2>
          </div>
        </div>
        {coach.status === "idle" && coachBlockedReason && (
          <>
            <p>{coachBlockedReason}</p>
            <div className="actions">
              <button className="primary" onClick={props.onOpenSettings}>
                Open Settings
              </button>
            </div>
          </>
        )}
        {coach.status === "idle" && !coachBlockedReason && (
          <div className="actions">
            <button className="primary" onClick={props.onRunCoach}>
              Get evaluation
            </button>
          </div>
        )}
        {coach.status === "running" && !coach.text && <p className="muted">The Coach is reviewing your speech.</p>}
        {coach.text && <Markdown text={stripDrillSection(coach.text)} />}
        {coach.status === "error" && (
          <>
            <p className="error">{coach.error}</p>
            <div className="actions">
              <button onClick={props.onRunCoach}>Try again</button>
              <button onClick={props.onOpenSettings}>Open Settings</button>
            </div>
          </>
        )}
        {coach.status === "done" && (
          <div className="actions">
            {"speechSynthesis" in window && (
              <button onClick={toggleReadAloud}>{speaking ? "Stop reading" : "Read aloud"}</button>
            )}
            <span className="muted small">Evaluated by {coach.providerName}</span>
          </div>
        )}
      </section>

      {props.clarity && (
        <ClarityCard clarity={props.clarity} transcript={words} samples={props.samples} troubleWords={props.troubleWords} />
      )}

      <section className="card">
        <p className="eyebrow">Fillers and pauses</p>
        <h2>Spotter report</h2>
        {metrics.fillers.length === 0 ? (
          <p>No fillers detected.</p>
        ) : (
          <>
            <ul className="tally">
              {(Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map((category) => (
                <li key={category}>
                  <strong>{metrics.fillerCounts[category]}</strong>
                  {CATEGORY_LABELS[category]}
                </li>
              ))}
            </ul>
            {metrics.topFiller && metrics.topFiller.count > 1 && (
              <p>
                Most frequent: <span className="filler">{metrics.topFiller.filler}</span>, {metrics.topFiller.count}{" "}
                times
              </p>
            )}
          </>
        )}
        <p className="muted small">
          Speech-to-text often drops sounds such as "um", so filler counts are a lower bound.
        </p>

        <h3>Transcript</h3>
        {words.length === 0 ? (
          <p>No speech was detected in the recording.</p>
        ) : (
          <p className="transcript">
            {words.map((word, i) => (
              <span key={i}>
                <span className={fillerWordIndexes.has(i) ? "filler" : undefined} title={formatTime(word.start)}>
                  {word.text}
                </span>
                {pauseAfter.has(i) && <span className="pause"> [pause {pauseAfter.get(i)!.toFixed(1)}s]</span>}{" "}
              </span>
            ))}
          </p>
        )}
        <p className="muted small">
          <span className="filler">Highlighted</span> words are fillers. Hover over a word to see its time.
        </p>
      </section>

      {props.drillCount > 0 && (
        <section className="card ink drill-cta">
          <div>
            <p className="eyebrow">Next step</p>
            <h2>{props.drillCount} drills ready</h2>
            <p className="muted">
              Practice the words and sounds that were unclear, a few repetitions each, and get checked on every try.
            </p>
          </div>
          <button className="primary" onClick={props.onStartDrills}>
            Start drills
          </button>
        </section>
      )}

      <div className="actions center">
        <button className={props.drillCount > 0 ? undefined : "primary"} onClick={props.onRestart}>
          New speech
        </button>
      </div>
    </>
  );
}
