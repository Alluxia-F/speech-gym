import { describe, expect, it } from "vitest";
import type { Word } from "../types";
import { computeMetrics, countUnits, findFillers, findPauses, formatTime } from "./metrics";
import { pacerSignal, timingResult } from "./pacer";

/** Builds words 0.4s long with 0.1s gaps, unless a start time is given as "word@12.5". */
function words(text: string): Word[] {
  let t = 0;
  return text.split(/\s+/).map((token) => {
    const [word, at] = token.split("@");
    if (at) t = Number(at);
    const w = { text: word, start: t, end: t + 0.4 };
    t += 0.5;
    return w;
  });
}

describe("countUnits", () => {
  it("counts a Latin word as one unit and Chinese characters individually", () => {
    expect(countUnits("Hello,")).toBe(1);
    expect(countUnits("我们今天")).toBe(4);
    expect(countUnits("...")).toBe(0);
  });
});

describe("findFillers", () => {
  it("finds filler sounds and crutch phrases", () => {
    const hits = findFillers(words("Um, I think, you know, it was uh basically fine."));
    expect(hits.map((h) => h.filler)).toEqual(["um", "you know", "uh", "basically"]);
    expect(hits.map((h) => h.category)).toEqual(["sound", "phrase", "sound", "phrase"]);
  });

  it("counts a connector only when it opens a sentence or is doubled", () => {
    const hits = findFillers(words("I came and I saw. So I left. And and then I slept."));
    expect(hits.map((h) => h.filler)).toEqual(["so", "and", "and and"]);
    expect(hits.every((h) => h.category === "connector")).toBe(true);
  });

  it("does not count the first word of the speech as a stall", () => {
    expect(findFillers(words("So today I want to talk."))).toEqual([]);
  });

  it("finds immediate repeats", () => {
    const hits = findFillers(words("I I think we we should go."));
    expect(hits.map((h) => h.filler)).toEqual(["i i", "we we"]);
    expect(hits.every((h) => h.category === "repeat")).toBe(true);
  });

  it("finds Chinese fillers inside character runs", () => {
    const hits = findFillers(words("嗯 我觉得 就是说 那个 问题 然后就是很难"));
    expect(hits.map((h) => h.filler).sort()).toEqual(["嗯", "就是", "就是说", "然后", "那个"].sort());
  });
});

describe("findPauses", () => {
  it("reports gaps of two seconds or more", () => {
    const pauses = findPauses(words("one two three@5 four"));
    expect(pauses).toHaveLength(1);
    expect(pauses[0].afterWordIndex).toBe(1);
    expect(pauses[0].duration).toBeCloseTo(4.1);
  });

  it("finds a pause that Whisper folded into the previous word's end time", () => {
    const list: Word[] = [
      { text: "hard", start: 7.8, end: 8.14 },
      { text: "part", start: 8.14, end: 11 },
      { text: "So", start: 11.2, end: 11.4 },
    ];
    const pauses = findPauses(list);
    expect(pauses).toHaveLength(1);
    expect(pauses[0].afterWordIndex).toBe(1);
    expect(pauses[0].duration).toBeGreaterThan(2);
  });
});

describe("computeMetrics", () => {
  it("computes duration, pace, and filler rate", () => {
    // 120 words over 60 seconds, two of them fillers.
    const list: Word[] = Array.from({ length: 120 }, (_, i) => ({
      text: i === 10 || i === 50 ? "um" : `word${i}`,
      start: i * 0.5,
      end: i * 0.5 + (i === 119 ? 0.5 : 0.4),
    }));
    const m = computeMetrics(list);
    expect(m.durationSeconds).toBeCloseTo(60);
    expect(m.unitsPerMinute).toBeCloseTo(120);
    expect(m.fillerCounts.sound).toBe(2);
    expect(m.fillersPerMinute).toBeCloseTo(2);
    expect(m.topFiller).toEqual({ filler: "um", count: 2 });
  });

  it("handles an empty transcript", () => {
    const m = computeMetrics([]);
    expect(m.durationSeconds).toBe(0);
    expect(m.topFiller).toBeNull();
  });
});

describe("pacer", () => {
  it("signals green at the minimum, yellow halfway, red at the maximum", () => {
    expect(pacerSignal(299, 5, 7)).toBe("none");
    expect(pacerSignal(300, 5, 7)).toBe("green");
    expect(pacerSignal(360, 5, 7)).toBe("yellow");
    expect(pacerSignal(420, 5, 7)).toBe("red");
  });

  it("classifies the final time against the target", () => {
    expect(timingResult(200, 5, 7)).toBe("under");
    expect(timingResult(400, 5, 7)).toBe("within");
    expect(timingResult(500, 5, 7)).toBe("over");
  });
});

describe("formatTime", () => {
  it("formats seconds as m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65.4)).toBe("1:05");
  });
});
