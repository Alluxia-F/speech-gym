import { clarityIssues, comparable, displayWord, type ClarityResult } from "../clarity/clarity";

/** Heading of the section in the Coach's reply that lists drills. The app reads it; the speaker sees the drill screen instead. */
export const DRILLS_HEADING = "## Practice drills";

/** How many clear repetitions finish a drill. */
export const REPS_TO_COMPLETE = 3;

export interface Drill {
  /** The words to say aloud. */
  text: string;
  /** What the drill trains, shown under the text. */
  focus: string;
  source: "coach" | "word" | "sentence";
}

const MAX_COACH_DRILLS = 8;
const MAX_WORD_DRILLS = 6;
const MAX_SENTENCE_DRILLS = 3;

function sectionAfter(reply: string, heading: string): string | null {
  const start = reply.indexOf(heading);
  if (start === -1) return null;
  const from = start + heading.length;
  const next = reply.indexOf("\n## ", from);
  return reply.slice(from, next === -1 ? undefined : next);
}

/** Reads the drills the Coach wrote, one per bullet, in the form "- text to say | what it trains". */
export function parseCoachDrills(reply: string): Drill[] {
  const section = sectionAfter(reply, DRILLS_HEADING);
  if (!section) return [];
  const drills: Drill[] = [];
  for (const line of section.split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (!bullet) continue;
    const [rawText, ...rest] = bullet[1].split("|");
    const text = rawText.replace(/[*_`"“”]/g, "").trim();
    // A drill has to be something the recognizer can check: real words, and not a whole paragraph.
    const wordCount = text.split(/\s+/).filter((t) => comparable(t)).length;
    if (wordCount === 0 || wordCount > 16) continue;
    drills.push({ text, focus: rest.join("|").replace(/[*_`]/g, "").trim(), source: "coach" });
  }
  return drills.slice(0, MAX_COACH_DRILLS);
}

/** Removes the drill list from the Coach's reply, since the drill screen presents it. */
export function stripDrillSection(reply: string): string {
  const start = reply.indexOf(DRILLS_HEADING);
  if (start === -1) return reply;
  const next = reply.indexOf("\n## ", start + DRILLS_HEADING.length);
  return (reply.slice(0, start) + (next === -1 ? "" : reply.slice(next + 1))).trimEnd();
}

/**
 * Builds the drill list for a speech: the Coach's drills first, then each unclear word on
 * its own, then the script sentences those words came from. The word and sentence drills
 * need no language model, so drills are available even without the Coach.
 */
export function buildDrills(clarity: ClarityResult | null, script: string, coachReply: string): Drill[] {
  const drills: Drill[] = [];
  const seen = new Set<string>();
  const add = (drill: Drill) => {
    const key = drill.text.split(/\s+/).map(comparable).filter(Boolean).join(" ");
    if (!key || seen.has(key)) return;
    seen.add(key);
    drills.push(drill);
  };

  parseCoachDrills(coachReply).forEach(add);
  if (!clarity) return drills;

  const issues = clarityIssues(clarity);
  issues.slice(0, MAX_WORD_DRILLS).forEach((issue) =>
    add({
      text: displayWord(issue.expected).toLowerCase(),
      focus: issue.heard ? `Was heard as "${displayWord(issue.heard)}"` : "Was not heard",
      source: "word",
    }),
  );

  const unclear = new Set(issues.map((i) => comparable(i.expected)));
  const sentences = script.split(/(?<=[.?!])\s+/).map((s) => s.trim());
  let added = 0;
  for (const sentence of sentences) {
    if (added >= MAX_SENTENCE_DRILLS) break;
    const tokens = sentence.split(/\s+/).filter((t) => comparable(t));
    if (tokens.length < 3 || tokens.length > 16) continue;
    const hits = tokens.filter((t) => unclear.has(comparable(t))).map((t) => displayWord(t).toLowerCase());
    if (hits.length === 0) continue;
    const before = drills.length;
    add({ text: sentence, focus: `From your script. Watch: ${[...new Set(hits)].join(", ")}`, source: "sentence" });
    if (drills.length > before) added++;
  }
  return drills;
}
