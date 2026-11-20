/**
 * The four settings a skill entry accepts, the merge rule between the two files,
 * and the failure messages a human will actually read.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { describe, expect, it } from "vitest";
import { mergePreferences, parsePreferences } from "../../src/preferences/preferences.js";

const USER = "C:/agent/skillbutler.yml";
const PROJECT = "E:/work/demo/.pi/skillbutler.yml";

const sample = `# full-line comments are allowed
skills:
  grill-with-docs:
    hidden: true
    weight: -2
    language: en
    style: "short sentences"
  retro:
    weight: 3
`;

describe("parsePreferences", () => {
  it("reads every setting and remembers which file it came from", () => {
    const map = parsePreferences(sample, USER);
    expect(map.size).toBe(2);
    expect(map.get("grill-with-docs")).toEqual({
      hidden: true,
      weight: -2,
      language: "en",
      style: "short sentences",
      sources: { hidden: USER, weight: USER, language: USER, style: USER },
    });
    expect(map.get("retro")?.weight).toBe(3);
  });

  it("takes an empty file as no settings", () => {
    expect(parsePreferences("", USER).size).toBe(0);
  });

  it("names an unknown top-level setting", () => {
    expect(() => parsePreferences("overview:\n  limit: 10\n", USER)).toThrow(
      /unknown setting "overview"; this file takes "skills"/,
    );
  });

  it("names an unknown per-skill setting and lists the allowed ones", () => {
    expect(() => parsePreferences("skills:\n  retro:\n    wight: 3\n", USER)).toThrow(
      /skill "retro": unknown setting "wight"; allowed: hidden, weight, language, style/,
    );
  });

  it("refuses a hidden that is not a boolean", () => {
    expect(() => parsePreferences("skills:\n  retro:\n    hidden: yes\n", USER)).toThrow(
      /skill "retro": "hidden" must be true or false, got "yes"/,
    );
  });

  it("refuses a weight that is not a number", () => {
    expect(() => parsePreferences("skills:\n  retro:\n    weight: high\n", USER)).toThrow(
      /skill "retro": "weight" must be a number, got "high"/,
    );
  });

  it("refuses tabs and duplicated keys", () => {
    expect(() => parsePreferences("\tskills:\n", USER)).toThrow(/tabs are not allowed/);
    expect(() => parsePreferences("skills:\n  a:\n    weight: 1\n    weight: 2\n", USER)).toThrow(
      /"weight" is set twice/,
    );
  });

  it("refuses a skill entry that is not a map", () => {
    expect(() => parsePreferences("skills:\n  retro: yes\n", USER)).toThrow(
      /skill "retro" must be a map of settings, got "yes"/,
    );
  });
});

describe("mergePreferences", () => {
  it("overrides one key per project file and keeps the rest of the user entry", () => {
    const user = parsePreferences("skills:\n  retro:\n    style: terse\n    weight: 1\n", USER);
    const project = parsePreferences("skills:\n  retro:\n    weight: 9\n", PROJECT);
    const merged = mergePreferences(user, project);
    expect(merged.get("retro")).toEqual({
      style: "terse",
      weight: 9,
      sources: { style: USER, weight: PROJECT },
    });
  });

  it("keeps a user entry the project file never mentions", () => {
    const user = parsePreferences("skills:\n  retro:\n    hidden: true\n", USER);
    const project = parsePreferences("skills:\n  other:\n    weight: 2\n", PROJECT);
    const merged = mergePreferences(user, project);
    expect(merged.get("retro")?.hidden).toBe(true);
    expect(merged.get("other")?.weight).toBe(2);
  });
});
