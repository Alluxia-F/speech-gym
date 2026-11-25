import { useState } from "react";
import { ANTHROPIC_MODELS, type AnalysisLanguage, type ProviderId, type Settings } from "../settings";
import { WHISPER_MODELS } from "../stt/whisper";
import type { Language } from "../types";

interface Props {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft({ ...draft, [key]: value });

  return (
    <section className="card">
      <h2>Settings</h2>

      <fieldset>
        <legend>Coach language model</legend>
        <label>
          Provider
          <select value={draft.provider} onChange={(e) => set("provider", e.target.value as ProviderId)}>
            <option value="anthropic">Claude (cloud, needs your API key)</option>
            <option value="ollama">Ollama (local, free, no key)</option>
          </select>
        </label>

        {draft.provider === "anthropic" ? (
          <>
            <label>
              Anthropic API key
              <input
                type="password"
                autoComplete="off"
                value={draft.anthropicKey}
                onChange={(e) => set("anthropicKey", e.target.value)}
                placeholder="sk-ant-..."
              />
            </label>
            <p className="muted small">
              The key is stored only in this browser and is sent only to the Anthropic API. Usage is billed to your
              Anthropic account.
            </p>
            <label>
              Model
              <select value={draft.anthropicModel} onChange={(e) => set("anthropicModel", e.target.value)}>
                {ANTHROPIC_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label>
              Ollama address
              <input value={draft.ollamaUrl} onChange={(e) => set("ollamaUrl", e.target.value)} />
            </label>
            <label>
              Ollama model name
              <input value={draft.ollamaModel} onChange={(e) => set("ollamaModel", e.target.value)} />
            </label>
            <p className="muted small">
              Ollama must be running on this computer with the model already pulled. Small local models give more
              generic feedback than cloud models.
            </p>
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>Coach feedback</legend>
        <label>
          Extra analysis in your first language
          <select
            value={draft.analysisLanguage}
            onChange={(e) => set("analysisLanguage", e.target.value as AnalysisLanguage)}
          >
            <option value="none">None</option>
            <option value="chinese">中文 (Chinese)</option>
          </select>
        </label>
        <p className="muted small">
          When you practice English, the Coach ends its feedback with a section in this language that explains your
          main pronunciation problems and how to fix them.
        </p>
      </fieldset>

      <fieldset>
        <legend>Speech-to-text</legend>
        <label>
          Whisper model
          <select value={draft.whisperModel} onChange={(e) => set("whisperModel", e.target.value)}>
            {WHISPER_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Speech language
          <select value={draft.language} onChange={(e) => set("language", e.target.value as Language)}>
            <option value="auto">Detect automatically</option>
            <option value="english">English</option>
            <option value="chinese">Chinese</option>
          </select>
        </label>
        <p className="muted small">
          The model runs in this browser. It is downloaded the first time you use it and cached afterward.
        </p>
      </fieldset>

      <div className="actions">
        <button
          className="primary"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          Save
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </section>
  );
}
