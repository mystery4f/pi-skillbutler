/**
 * What a named skill adds to the turn (ADR-0005, ADR-0007): one path to read, and
 * one hint when a name answers to nothing. An unnamed turn adds nothing at all.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { describe, expect, it } from "vitest";
import { buildInvocationText, HINT_NAME_LIMIT } from "../../src/invocation/inject.js";

describe("buildInvocationText", () => {
  it("adds nothing when the prompt names nothing", () => {
    expect(
      buildInvocationText({ known: [], unknown: [], arguments: new Map() }, [], [], ["retro"]),
    ).toBeUndefined();
  });

  it("points at the file instead of pasting the skill", () => {
    const text = buildInvocationText(
      { known: ["retro"], unknown: [], arguments: new Map() },
      [{ name: "retro", file: "/skills/retro/SKILL.md" }],
      [],
      ["retro"],
    );
    expect(text).toContain("Read each file before acting on it");
    expect(text).toContain("- $retro → /skills/retro/SKILL.md");
  });

  it("reports a second naming instead of repeating the path", () => {
    const text = buildInvocationText(
      { known: ["retro"], unknown: [], arguments: new Map() },
      [],
      ["retro"],
      ["retro"],
    );
    expect(text).toContain("Already named earlier this session");
    expect(text).toContain("$retro");
    expect(text).not.toContain("SKILL.md");
  });

  it("says so when a name answers to nothing, and offers what exists", () => {
    const text = buildInvocationText(
      { known: [], unknown: ["nope"], arguments: new Map() },
      [],
      [],
      ["retro", "grill-with-docs"],
    );
    expect(text).toContain("Nothing is installed under $nope.");
    expect(text).toContain("Names available: retro, grill-with-docs.");
  });

  it("stops listing names at the hint limit and counts the rest", () => {
    const names = Array.from({ length: HINT_NAME_LIMIT + 5 }, (_, at) => `skill-${at}`);
    const text =
      buildInvocationText({ known: [], unknown: ["nope"], arguments: new Map() }, [], [], names) ??
      "";
    expect(text).toContain(`(${names.length} in total)`);
  });
  it("passes the text after a name as that skill's input", () => {
    const scan = {
      known: ["retro"],
      unknown: [],
      arguments: new Map([["retro", "review sprint 12"]]),
    };
    const text =
      buildInvocationText(
        scan,
        [{ name: "retro", file: "/skills/retro/SKILL.md" }],
        [],
        ["retro"],
      ) ?? "";
    expect(text).toContain("stands in for `$ARGUMENTS`");
    expect(text).toContain("- $retro: review sprint 12");
  });
});
