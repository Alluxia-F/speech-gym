import { describe, expect, it } from "vitest";
import type { Word } from "../types";
import { clarityIssues, comparable, compareToScript } from "./clarity";

function heard(text: string): Word[] {
  return text.split(/\s+/).map((t, i) => ({ text: t, start: i * 0.5, end: i * 0.5 + 0.4 }));
}

describe("comparable", () => {
  it("ignores case, punctuation, and quote style", () => {
    expect(comparable("Listen,")).toBe("listen");
    expect(comparable("don’t")).toBe("don't");
    expect(comparable("“Hello!”")).toBe("hello");
  });

  it("treats digits and number words as the same", () => {
    expect(comparable("3")).toBe(comparable("three"));
  });
});

describe("compareToScript", () => {
  it("scores a perfect reading as fully clear", () => {
    const result = compareToScript("The quick brown fox.", heard("the quick brown fox"));
    expect(result.score).toBe(1);
    expect(result.words.every((w) => w.status === "clear")).toBe(true);
  });

  it("flags a word the listener heard differently, with what was heard", () => {
    const result = compareToScript("I think three things matter.", heard("I sink tree things matter."));
    expect(result.words.map((w) => w.status)).toEqual(["clear", "misheard", "misheard", "clear", "clear"]);
    expect(result.words[1].heard).toBe("sink");
    expect(result.words[2].heard).toBe("tree");
    expect(result.words[2].wordIndex).toBe(2);
    expect(result.score).toBeCloseTo(3 / 5);
  });

  it("flags a word the listener did not hear at all", () => {
    const result = compareToScript("We walked to the old library.", heard("We walked to the library."));
    expect(result.words[4]).toMatchObject({ text: "old", status: "missed" });
    expect(result.spokenCount).toBe(6);
    expect(result.clearCount).toBe(5);
  });

  it("ignores fillers and other extra words in the transcript", () => {
    const result = compareToScript("Good evening everyone.", heard("Good um evening you know everyone."));
    expect(result.score).toBe(1);
  });

  it("does not penalize script words the speaker never reached", () => {
    const result = compareToScript("One two three four five six.", heard("one two three"));
    expect(result.words.map((w) => w.status)).toEqual([
      "clear",
      "clear",
      "clear",
      "unreached",
      "unreached",
      "unreached",
    ]);
    expect(result.spokenCount).toBe(3);
    expect(result.score).toBe(1);
  });

  it("handles an empty transcript", () => {
    const result = compareToScript("Hello there.", []);
    expect(result.spokenCount).toBe(0);
    expect(result.score).toBe(0);
  });
});

describe("clarityIssues", () => {
  it("lists misheard and missed words in script order", () => {
    const result = compareToScript("The weather was really rough.", heard("The wetter was rough."));
    expect(clarityIssues(result).map((i) => [i.expected, i.heard])).toEqual([
      ["weather", "wetter"],
      ["really", null],
    ]);
  });
});
