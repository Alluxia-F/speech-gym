import { describe, expect, it } from "vitest";
import { compareToScript } from "../clarity/clarity";
import type { Word } from "../types";
import { buildDrills, parseCoachDrills, stripDrillSection } from "./drills";

const heard = (text: string): Word[] =>
  text.split(/\s+/).map((t, i) => ({ text: t, start: i * 0.5, end: i * 0.5 + 0.4 }));

const REPLY = `## Spoken evaluation
You did well.

## Pronunciation guide
- **think** /θɪŋk/ ...

## Practice drills
- think | tongue between the teeth for th
- **think, sink** | th against s
- "I think three things matter." | th in a sentence
- | no text here
Not a bullet.

## 中文分析
主要问题是 th。`;

describe("parseCoachDrills", () => {
  it("reads one drill per bullet and drops formatting marks", () => {
    expect(parseCoachDrills(REPLY)).toEqual([
      { text: "think", focus: "tongue between the teeth for th", source: "coach" },
      { text: "think, sink", focus: "th against s", source: "coach" },
      { text: "I think three things matter.", focus: "th in a sentence", source: "coach" },
    ]);
  });

  it("returns nothing when the reply has no drill section", () => {
    expect(parseCoachDrills("## Spoken evaluation\nHello.")).toEqual([]);
  });
});

describe("stripDrillSection", () => {
  it("removes the drill list and keeps the sections around it", () => {
    const stripped = stripDrillSection(REPLY);
    expect(stripped).not.toContain("Practice drills");
    expect(stripped).not.toContain("th against s");
    expect(stripped).toContain("## Pronunciation guide");
    expect(stripped).toContain("## 中文分析");
  });

  it("removes a drill section that is still being streamed", () => {
    expect(stripDrillSection("## Written summary\nGood.\n\n## Practice drills\n- thi")).toBe("## Written summary\nGood.");
  });
});

describe("buildDrills", () => {
  const script = "Today I think three things matter. The first is health. Thank you.";
  const clarity = compareToScript(script, heard("Today I sink tree things matter. The first is hells. Thank you."));

  it("makes word and sentence drills without the Coach", () => {
    const drills = buildDrills(clarity, script, "");
    expect(drills.map((d) => d.text)).toEqual([
      "think",
      "three",
      "health",
      "Today I think three things matter.",
      "The first is health.",
    ]);
    expect(drills[0].focus).toBe('Was heard as "sink"');
    expect(drills[3].focus).toContain("think, three");
  });

  it("puts the Coach's drills first and skips duplicates", () => {
    const drills = buildDrills(clarity, script, REPLY);
    expect(drills.slice(0, 3).every((d) => d.source === "coach")).toBe(true);
    // "think" already came from the Coach, so it is not added again as a word drill.
    expect(drills.filter((d) => d.text.toLowerCase() === "think")).toHaveLength(1);
    expect(drills.map((d) => d.text)).toContain("three");
  });

  it("returns no drills for a free speech with no Coach drills", () => {
    expect(buildDrills(null, "", "")).toEqual([]);
  });
});
