/**
 * What pi already knows (ADR-0006): the rendered prompt is the only place a skill
 * from outside the managed roots appears, so reading it back is how the popup can
 * label one as unmanaged.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { describe, expect, it } from "vitest";
import { parseHostSkills } from "../../src/skills/host.js";

const PROMPT = [
  "## Skills",
  "<available_skills>",
  "<skill>",
  "  <name>retro</name>",
  "  <description>Review the session &amp; write it down</description>",
  "  <location>/home/u/.pi/agent/skills/retro/SKILL.md</location>",
  "</skill>",
  "<skill>",
  "  <name>grill</name>",
  "  <description>Interview with &lt;docs&gt;</description>",
  "  <location>/opt/skills/grill/SKILL.md</location>",
  "</skill>",
  "</available_skills>",
].join("\n");

describe("parseHostSkills", () => {
  it("reads every block, unescaping the text", () => {
    expect(parseHostSkills(PROMPT)).toEqual([
      {
        name: "retro",
        description: "Review the session & write it down",
        file: "/home/u/.pi/agent/skills/retro/SKILL.md",
      },
      {
        name: "grill",
        description: "Interview with <docs>",
        file: "/opt/skills/grill/SKILL.md",
      },
    ]);
  });

  it("finds nothing in a prompt without a skills block", () => {
    expect(parseHostSkills("You are pi.")).toEqual([]);
  });

  it("skips a block with no location, which a name cannot point at", () => {
    const prompt = "<skill><name>x</name><description>d</description><location></location></skill>";
    expect(parseHostSkills(prompt)).toEqual([]);
  });
});
