/**
 * The write path (ADR-0003, ADR-0009): `set` and `unset` only ever write the user
 * file, they rewrite it from the parsed map, and a value that does not fit its key
 * is refused with the file, the skill and the value in the message.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { describe, expect, it } from "vitest";
import { PreferenceError } from "../../src/preferences/errors.js";
import { parsePreferences } from "../../src/preferences/preferences.js";
import {
  parseSettingValue,
  serializePreferences,
  withoutSetting,
  withSetting,
} from "../../src/preferences/writer.js";

const FILE = "/home/u/.pi/agent/skillbutler.yml";

describe("parseSettingValue", () => {
  it("takes true and false for hidden", () => {
    expect(parseSettingValue("hidden", "true", FILE, "alpha")).toBe(true);
    expect(parseSettingValue("hidden", "false", FILE, "alpha")).toBe(false);
  });

  it("refuses a hidden value that is neither, naming what it wanted", () => {
    expect(() => parseSettingValue("hidden", "yes", FILE, "alpha")).toThrow(PreferenceError);
    expect(() => parseSettingValue("hidden", "yes", FILE, "alpha")).toThrow(
      'must be true or false, got "yes"',
    );
  });

  it("takes a finite number for weight and refuses the rest", () => {
    expect(parseSettingValue("weight", "2.5", FILE, "alpha")).toBe(2.5);
    expect(() => parseSettingValue("weight", "heavy", FILE, "alpha")).toThrow("must be a number");
  });

  it("keeps a string setting as written", () => {
    expect(parseSettingValue("style", "terse and plain", FILE, "alpha")).toBe("terse and plain");
  });
});

describe("withSetting", () => {
  it("writes a file this package owns, and reads back into the same map", () => {
    const text = withSetting(undefined, FILE, "alpha", "weight", 3);
    expect(text.startsWith("# Written by /skillbutler.")).toBe(true);
    const parsed = parsePreferences(text, FILE);
    expect(parsed.get("alpha")?.weight).toBe(3);
  });

  it("keeps the settings a skill already had", () => {
    const first = withSetting(undefined, FILE, "alpha", "weight", 3);
    const second = withSetting(first, FILE, "alpha", "hidden", true);
    expect(parsePreferences(second, FILE).get("alpha")).toMatchObject({ weight: 3, hidden: true });
  });
});

describe("withoutSetting", () => {
  it("removes one setting and keeps the rest", () => {
    const source = ["skills:", "  alpha:", "    weight: 3", "    hidden: true", ""].join("\n");
    const text = withoutSetting(source, FILE, "alpha", "hidden");
    expect(parsePreferences(text, FILE).get("alpha")).toMatchObject({ weight: 3 });
    expect(parsePreferences(text, FILE).get("alpha")?.hidden).toBeUndefined();
  });

  it("drops the entry once its last setting is gone", () => {
    const source = ["skills:", "  alpha:", "    weight: 3", ""].join("\n");
    expect(withoutSetting(source, FILE, "alpha", "weight")).toContain("skills: {}");
  });

  it("says which setting was not there", () => {
    expect(() => withoutSetting("skills: {}\n", FILE, "alpha", "weight")).toThrow(
      'skill "alpha" has no "weight" setting to remove',
    );
  });
});

describe("serializePreferences", () => {
  it("orders the skills by name so a rewrite is stable", () => {
    const map = parsePreferences(
      ["skills:", "  beta:", "    weight: 1", "  alpha:", "    weight: 2", ""].join("\n"),
      FILE,
    );
    const text = serializePreferences(map);
    expect(text.indexOf("alpha:")).toBeLessThan(text.indexOf("beta:"));
    expect(text.endsWith("\n")).toBe(true);
  });
});
