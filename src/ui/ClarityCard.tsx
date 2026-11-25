import { playSegment, speakReference } from "../audio/playback";
import { clarityIssues, displayWord, type ClarityResult } from "../clarity/clarity";
import type { TroubleWord } from "../clarity/troubleWords";
import type { Word } from "../types";

interface Props {
  clarity: ClarityResult;
  transcript: Word[];
  samples: Float32Array | null;
  troubleWords: TroubleWord[];
}

/** Plays the moment a transcript word was spoken, with a little room on each side. */
function playWord(samples: Float32Array, word: Word) {
  // Whisper can stretch a word's end time across a following silence, so cap the length.
  const length = Math.min(word.end - word.start, 1.2);
  playSegment(samples, word.start - 0.2, word.start + length + 0.3);
}

export function ClarityCard({ clarity, transcript, samples, troubleWords }: Props) {
  const issues = clarityIssues(clarity);
  const percent = Math.round(clarity.score * 100);
  const repeated = troubleWords.filter((t) => t.count >= 2).slice(0, 12);
  const unreached = clarity.words.filter((w) => w.status === "unreached").length;

  return (
    <section className="card">
      <p className="eyebrow">Pronunciation</p>
      <h2>Clarity check</h2>

      {clarity.spokenCount === 0 ? (
        <p>None of the script was recognized in the recording.</p>
      ) : (
        <>
          <div className="clarity-score">
            <strong>{percent}%</strong>
            <span>
              {clarity.clearCount} of {clarity.spokenCount} words were heard as written.
              {unreached > 0 && ` The last ${unreached} words of the script were not reached and are not counted.`}
            </span>
          </div>

          <h3>Your script</h3>
          <p className="transcript">
            {clarity.words.map((word, i) => {
              const heardWord = word.wordIndex !== undefined ? transcript[word.wordIndex] : undefined;
              const label =
                word.status === "misheard"
                  ? `Heard as "${displayWord(word.heard ?? "")}"`
                  : word.status === "missed"
                    ? "Not heard"
                    : word.status === "unreached"
                      ? "Not reached"
                      : "Heard clearly";
              return (
                <span key={i}>
                  {samples && heardWord ? (
                    <button
                      type="button"
                      className={`word word-${word.status}`}
                      title={`${label}. Select to hear yourself.`}
                      onClick={() => playWord(samples, heardWord)}
                    >
                      {word.text}
                    </button>
                  ) : (
                    <span className={`word word-${word.status}`} title={label}>
                      {word.text}
                    </span>
                  )}{" "}
                </span>
              );
            })}
          </p>
          <p className="muted small">
            <span className="word word-misheard">Heard differently</span>{" "}
            <span className="word word-missed">Not heard</span> Select any word to hear how you said it.
          </p>

          <h3>Words to practice</h3>
          {issues.length === 0 ? (
            <p>Every word you reached was heard as written.</p>
          ) : (
            <ul className="practice">
              {issues.map((issue) => {
                const heardWord = issue.wordIndex !== undefined ? transcript[issue.wordIndex] : undefined;
                const word = displayWord(issue.expected);
                return (
                  <li key={issue.scriptIndex}>
                    <span className="practice-word">{word}</span>
                    <span className="practice-heard">
                      {issue.heard ? (
                        <>
                          heard as <strong>{displayWord(issue.heard)}</strong>
                        </>
                      ) : (
                        "not heard"
                      )}
                    </span>
                    <span className="practice-actions">
                      {samples && heardWord && (
                        <button type="button" onClick={() => playWord(samples, heardWord)}>
                          You
                        </button>
                      )}
                      <button type="button" onClick={() => speakReference(word)}>
                        Reference
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {repeated.length > 0 && (
        <>
          <h3>Unclear in more than one session</h3>
          <ul className="trouble">
            {repeated.map((t) => (
              <li key={t.word}>
                <button type="button" onClick={() => speakReference(t.word)} title="Hear the reference">
                  {t.word} <span>{t.count}×</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="muted small">
        This compares the speech recognizer's transcript with your script. It shows whether a listener could make out
        each word, not whether your accent matches a standard. The recognizer makes its own mistakes, especially with
        names and rare words, so treat a single flag as a hint and a repeated one as a pattern.
      </p>
    </section>
  );
}
