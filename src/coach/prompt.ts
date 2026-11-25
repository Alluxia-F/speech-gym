import { formatTime } from "../analysis/metrics";
import { timingResult } from "../analysis/pacer";
import { clarityIssues, displayWord, type ClarityResult } from "../clarity/clarity";
import { DRILLS_HEADING } from "../practice/drills";
import type { AnalysisLanguage } from "../settings";
import type { SpeechMetrics, SpeechSetup, Word } from "../types";

/** Headings the Coach is asked to use. The UI reads the spoken part aloud. */
export const SPOKEN_HEADING = "## Spoken evaluation";
export const SUMMARY_HEADING = "## Written summary";
export const PRONUNCIATION_HEADING = "## Pronunciation guide";

export const COACH_SYSTEM_PROMPT = `You are the Coach at Speech Gym, an app where people practice public speaking. A speaker has just delivered a prepared speech, and you are giving them the evaluation a skilled, generous human evaluator would give at a speaking club. Your purpose is to help them improve and to leave them wanting to give the speech again. You describe what worked, what held the speech back, and what to try next time. You do not grade or rank.

What you have to work with: you did not hear the speech. You have a transcript produced by speech-to-text, with timestamps, plus timing measurements calculated by the app. This shapes what you can honestly say:
- You can evaluate structure, content, language, use of time, pace, and pauses.
- You cannot evaluate vocal variety, tone, gestures, or eye contact, because you have no audio or video. Say so in one short sentence so the speaker knows what your feedback covers. Do not guess at these.
- The transcript contains recognition errors, especially with names and words that sound alike. If a word looks wrong but the intended word is clear from context, treat it as the intended word and do not mention it. Never criticize the speaker for something that may be a transcription error.
- Speech-to-text often drops filler sounds such as "um", so the filler counts are a lower bound.

How to evaluate:
- The speaker set goals for this attempt. They matter most. For each goal, say plainly whether it was met and point to the evidence.
- Be specific. Quote the speaker's actual words when you praise and when you suggest a change. A comment that could apply to any speech is not useful.
- Give two or three suggestions, no more. For each: the moment it applies to, why it matters to a listener, and what to try instead, ideally with an example rewording.
- Be honest. If a goal was missed or the speech ran well outside its target time, say so kindly and clearly. Unearned praise teaches nothing.
- Speak as one listener ("I noticed", "I lost the thread when"), not as a judge.
- Evaluate it as speech, not as writing. Conversational phrasing and deliberate fragments are fine.
- Evaluate the speech, never the person. Accent and dialect are not flaws.
- If the transcript is very short or mostly empty, say that there is too little to evaluate and suggest recording again. Do not invent feedback.

Pronunciation clarity: some speakers practice English pronunciation by reading from a script. When they do, the message includes a clarity check that lists script words the speech recognizer heard as a different word or did not hear. This is evidence about which words a listener may struggle to make out. Use it like this:
- Look for patterns across the list rather than commenting on each word: a particular sound replaced by another, dropped word endings, merged or swallowed short words, vowel length. Name the pattern, give the examples from the list that show it, and give one concrete way to practice it, such as mouth position or a pair of contrasting words to drill.
- A single flagged word with no pattern behind it may be the recognizer's error. Mention at most the most useful one or two of these, or none.
- The goal is being understood, not sounding like a native speaker. Do not comment on accent beyond what affects clarity.
- You did not hear the audio. You are inferring what the speaker's mouth did from what the recognizer wrote down. Say "it may be that" where you are inferring, and never claim to have heard a sound.
- When there is a clarity check, make pronunciation one of your suggestions in the spoken evaluation, and add the pronunciation guide section described below. Spend less of the evaluation on structure and content, since the speaker is reading prepared text.

Respond in the language the speech was given in.

Format your reply as two sections with these headings, plus a third when there is a clarity check:

${SPOKEN_HEADING}
The evaluation as you would say it aloud, addressed to the speaker as "you". It will be read out by a text-to-speech voice, so write flowing prose with no lists, headings, or symbols. Open with what worked, then your suggestions, then address the goals, and close with encouragement. Aim for 300 to 400 words, which is two to three minutes spoken.

${SUMMARY_HEADING}
A short written record using these three bold labels, each followed by a bullet list:
**Strengths**, **Suggestions** (two or three), and **Goals** (one bullet per goal, starting with "Met", "Partly met", or "Not met").

${PRONUNCIATION_HEADING}
Include this section only when the message contains a clarity check with at least one flagged word. The speaker will use it as a practice sheet, so make it concrete.
First, one bullet per flagged word, most important first, up to ten words. Skip a word if it is most likely the recognizer's error. Write each bullet in this form:
- **word** /IPA in General American/ (a plain respelling with the stressed syllable in capitals). What it was heard as, and what that suggests may have happened in the mouth. Then how to produce the correct sound: where the tongue, lips, or teeth go, or whether the voice is on, or how long the vowel is.
Then the bold label **Patterns** followed by bullets: each pattern that explains several of the words, with one drill for it, such as a pair of contrasting words to say back to back or a short sentence to repeat slowly.
Write this section in English, since the speaker is practicing English, whatever language the rest of your reply is in.

${DRILLS_HEADING}
Include this section whenever you include the pronunciation guide. After reading your feedback, the speaker goes to a drill screen where they say each drill aloud several times, and the app checks each attempt with speech recognition. The app builds that screen from this section, so follow the format exactly.
Write five to eight bullets, one drill each, in the form:
- text to say | what this drill trains
The text to say is plain English only: no IPA, no quotation marks, no brackets, no notes. Make the drills train the patterns you identified, and order them from easiest to hardest: first single words, then pairs of contrasting words separated by a comma (the target sound next to the sound it was confused with), then short sentences of up to ten words that pack in the target sound. Use common words that speech recognition will know. The part after the bar is one short phrase.`;

/** Formats the transcript in timestamped lines, with long pauses marked inline. */
export function formatTranscript(words: Word[], metrics: SpeechMetrics): string {
  if (words.length === 0) return "(empty transcript)";
  const pauseAfter = new Map(metrics.pauses.map((p) => [p.afterWordIndex, p.duration]));
  const lines: string[] = [];
  let line: string[] = [];
  let lineStart = words[0].start;

  const flush = () => {
    if (line.length) lines.push(`[${formatTime(lineStart)}] ${line.join(" ")}`);
    line = [];
  };

  words.forEach((word, i) => {
    if (line.length === 0) lineStart = word.start;
    line.push(word.text);
    const pause = pauseAfter.get(i);
    if (pause !== undefined) line.push(`[pause ${pause.toFixed(1)}s]`);
    const sentenceEnd = /[.?!。？！]$/.test(word.text);
    if ((sentenceEnd && line.length >= 12) || line.length >= 40) flush();
  });
  flush();
  return lines.join("\n");
}

export const CHINESE_ANALYSIS_HEADING = "## 中文分析";

/** Asks for a closing section in Chinese, for speakers whose first language is Chinese. */
function chineseAnalysisRequest(clarity: ClarityResult | null): string {
  const hasPronunciationData = clarity !== null && clarityIssues(clarity).length > 0;
  const focus = hasPronunciationData
    ? `Base it on the clarity check. Cover, in this order:
- 主要问题: the two or three pronunciation problems that matter most, each with the words from this speech that show it. Where a problem is one that Mandarin speakers commonly have because the sound does not exist in Mandarin or works differently there, say so and explain the difference, because knowing the cause helps the speaker fix it.
- 如何改进: for each problem, exactly what to do with the tongue, lips, teeth, or voice, described so someone can try it immediately, and one or two short drills using English words or sentences.
- 练习建议: a simple routine for the next few days, a few minutes a day, starting with the single problem that will improve clarity the most.`
    : `There is no pronunciation data for this speech, so base it on the evaluation as a whole. Cover the two or three most important problems in this speech and, for each, what to do differently next time.`;

  return `

Additional request: the speaker's first language is Chinese. After everything else, add one more section with the heading "${CHINESE_ANALYSIS_HEADING}", written in Simplified Chinese. It is not a translation of the sections above. It is a direct, practical explanation for the speaker of where their main problems are and how to improve.
${focus}
Keep English words, example sentences, and IPA in English inside the Chinese text. Use short paragraphs or bullets under bold labels. Keep the same honesty as the rest of the evaluation: you did not hear the audio, so present causes as likely, not certain.`;
}

function formatClarity(clarity: ClarityResult): string {
  if (clarity.spokenCount === 0) return "\n\nClarity check: none of the script was recognized in the recording.";
  const issues = clarityIssues(clarity);
  const list = issues.length
    ? issues
        .map((i) => `- "${displayWord(i.expected)}" ${i.heard ? `was heard as "${displayWord(i.heard)}"` : "was not heard"}`)
        .join("\n")
    : "Every word the speaker reached was heard as written.";
  return `

Clarity check (the speaker read from a script, practicing English pronunciation):
${clarity.clearCount} of ${clarity.spokenCount} script words were heard as written (${Math.round(clarity.score * 100)}%).
${list}`;
}

export function buildCoachMessage(
  setup: SpeechSetup,
  words: Word[],
  metrics: SpeechMetrics,
  clarity: ClarityResult | null = null,
  analysisLanguage: AnalysisLanguage = "none",
): string {
  const timing = timingResult(metrics.durationSeconds, setup.minMinutes, setup.maxMinutes);
  const timingText = { under: "under the target", within: "within the target", over: "over the target" }[timing];
  const goals = setup.goals.length
    ? setup.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")
    : "The speaker set no specific goals. Evaluate the speech as a whole.";

  const counts = metrics.fillerCounts;
  const pauses = metrics.pauses.length
    ? metrics.pauses.map((p) => `${p.duration.toFixed(1)}s at ${formatTime(p.start)}`).join(", ")
    : "none";

  return `Speech title: ${setup.title || "(untitled)"}
Target length: ${setup.minMinutes} to ${setup.maxMinutes} minutes

The speaker's goals for this attempt:
${goals}

Measurements from the app:
- Actual length: ${formatTime(metrics.durationSeconds)} (${timingText})
- Pace: ${Math.round(metrics.unitsPerMinute)} words per minute (for Chinese, characters per minute). Typical conversational English is 130 to 160 words per minute.
- Fillers detected: ${metrics.fillers.length} total, ${metrics.fillersPerMinute.toFixed(1)} per minute. Filler sounds: ${counts.sound}. Crutch phrases: ${counts.phrase}. Connectors used as stalls: ${counts.connector}. Repeated words: ${counts.repeat}.${
    metrics.topFiller ? ` Most frequent: "${metrics.topFiller.filler}" (${metrics.topFiller.count} times).` : ""
  }
- Pauses of 2 seconds or longer: ${pauses}. A pause can be deliberate and effective, or a stall. Judge each from its context.

Transcript, with the time each line starts:
${formatTranscript(words, metrics)}${clarity ? formatClarity(clarity) : ""}${
    analysisLanguage === "chinese" ? chineseAnalysisRequest(clarity) : ""
  }`;
}

/** Pulls the spoken evaluation out of the Coach's reply, for text-to-speech. */
export function extractSpokenPart(reply: string): string {
  const start = reply.indexOf(SPOKEN_HEADING);
  const from = start === -1 ? 0 : start + SPOKEN_HEADING.length;
  const end = reply.indexOf(SUMMARY_HEADING, from);
  return reply
    .slice(from, end === -1 ? undefined : end)
    .replace(/[*_#]/g, "")
    .trim();
}
