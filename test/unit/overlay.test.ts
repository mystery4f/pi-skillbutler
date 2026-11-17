/**
 * The overlay (ADR-0002): with no preference the turn is byte-identical to what pi
 * would have sent; with a preference the hidden skills leave, the heavy ones rise,
 * and a bounded overview is added as its own section.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { describe, expect, it } from "vitest";
import {
  applyPreferences,
  OVERVIEW_LIMIT,
  OVERVIEW_SECTION,
} from "../../src/preferences/overlay.js";
import type { PreferenceEntry, PreferenceMap } from "../../src/preferences/preferences.js";
import { fakeSkill, promptOptions, skillsOf } from "../support/prompt.js";

function preferences(entries: Record<string, PreferenceEntry>): PreferenceMap {
  return new Map(Object.entries(entries));
}

describe("applyPreferences", () => {
  it("leaves the turn untouched when nothing is configured", () => {
    const options = promptOptions([fakeSkill("alpha"), fakeSkill("beta")]);
    const before = options.skills;
    const result = applyPreferences(options, preferences({}), []);
    expect(result).toEqual({ applied: false, visible: 2, hidden: 0 });
    expect(options.skills).toBe(before);
    expect(options.sections[OVERVIEW_SECTION]).toBeUndefined();
  });

  it("drops a hidden skill from the turn", () => {
    const options = promptOptions([fakeSkill("alpha"), fakeSkill("beta")]);
    const result = applyPreferences(
      options,
      preferences({ alpha: { hidden: true, sources: {} } }),
      [],
    );
    expect(result).toEqual({ applied: true, visible: 1, hidden: 1 });
    expect(skillsOf(options).map((skill) => skill.name)).toEqual(["beta"]);
  });

  it("orders the heavier skills first", () => {
    const options = promptOptions([fakeSkill("alpha"), fakeSkill("beta"), fakeSkill("gamma")]);
    applyPreferences(
      options,
      preferences({
        beta: { weight: 5, sources: {} },
        gamma: { weight: 9, sources: {} },
      }),
      [],
    );
    expect(skillsOf(options).map((skill) => skill.name)).toEqual(["gamma", "beta", "alpha"]);
  });

  it("appends language and style to the description the model reads", () => {
    const options = promptOptions([fakeSkill("alpha", "alpha does things")]);
    applyPreferences(
      options,
      preferences({ alpha: { language: "zh", style: "terse", sources: {} } }),
      [],
    );
    expect(skillsOf(options)[0]?.description).toBe(
      "alpha does things (answer in zh; style: terse)",
    );
  });

  it("writes a bounded overview that names the heavy, hidden and named skills", () => {
    const options = promptOptions([fakeSkill("alpha"), fakeSkill("beta"), fakeSkill("gamma")]);
    applyPreferences(
      options,
      preferences({
        alpha: { hidden: true, sources: {} },
        beta: { weight: 4, sources: {} },
      }),
      ["gamma"],
    );
    const text = options.sections[OVERVIEW_SECTION] ?? "";
    expect(text).toContain("2 of 3 skills visible");
    expect(text).toContain("heaviest first: beta (4)");
    expect(text).toContain("hidden: alpha");
    expect(text).toContain("named this turn: gamma");
    expect(text.length).toBeLessThanOrEqual(OVERVIEW_LIMIT);
  });

  it("cuts the overview at the limit instead of growing the prompt", () => {
    const options = promptOptions([fakeSkill("alpha")]);
    applyPreferences(options, preferences({ alpha: { weight: 1, sources: {} } }), [], 30);
    const text = options.sections[OVERVIEW_SECTION] ?? "";
    expect(text).toHaveLength(30);
    expect(text.endsWith("…")).toBe(true);
  });
});
