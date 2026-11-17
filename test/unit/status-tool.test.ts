/**
 * `skillbutler_status` through the harness: the inventory answer, the per-skill
 * answer with its provenance, and the miss that lists the names that do exist.
 *
 * @author mystery4f <40482524+mystery4f@users.noreply.github.com>
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STATUS_TOOL } from "../../src/tools/status.js";
import { createHarness, type Harness } from "../support/extension-harness.js";
import { removeDir, tempDir, writeFileIn } from "../support/temp.js";

let root = "";
let agent = "";
let project = "";
let dirs: string[] = [];
let harness: Harness;

beforeAll(async () => {
  root = await tempDir("skill-pro-root-");
  agent = await tempDir("skill-pro-agent-");
  project = await tempDir("skill-pro-project-");
  dirs = [root, agent, project];
  await writeFileIn(root, "alpha/SKILL.md", "---\nname: alpha\ndescription: First skill.\n---\n");
  await writeFileIn(root, "beta/SKILL.md", "---\nname: beta\n---\n");
  await writeFileIn(
    agent,
    "skill-pro.yml",
    "skills:\n  alpha:\n    hidden: true\n    style: terse\n",
  );
  await writeFileIn(project, ".pi/skill-pro.yml", "skills:\n  beta:\n    weight: 5\n");
  harness = createHarness({
    options: { roots: [root], env: { PI_CODING_AGENT_DIR: agent } },
  });
});

afterAll(async () => {
  harness.dispose();
  for (const dir of dirs) await removeDir(dir);
});

describe("skillbutler_status", () => {
  it("registers the tool with its paths in the description", () => {
    const tool = harness.tools.get(STATUS_TOOL);
    expect(tool).toBeDefined();
    expect(tool?.description).toContain("read when the extension loads");
    expect(tool?.description).toContain("skill-pro.yml");
  });

  it("lists the inventory with the two settings files and the hidden flag", async () => {
    const result = await harness.callTool(STATUS_TOOL, {}, project);
    const text = firstText(result);
    expect(text).toContain("inventory: 2 skills, 1 visible, 1 hidden");
    expect(text).toMatch(/alpha {2}\[hidden\] {2}weight 0/);
    expect(text).toMatch(/beta {2}weight 5/);
    expect(text).toContain("present");
  });

  it("explains one skill and which file each setting came from", async () => {
    const result = await harness.callTool(STATUS_TOOL, { name: "alpha" }, project);
    const text = firstText(result);
    expect(text).toContain("hidden: true");
    expect(text).toContain("style: terse");
    expect(text).toContain("skill-pro.yml");
  });

  it("lists the known names when the name is unknown", async () => {
    const result = await harness.callTool(STATUS_TOOL, { name: "nope" }, project);
    const text = firstText(result);
    expect(text).toContain('No managed skill is named "nope"');
    expect(text).toContain("alpha, beta");
  });
});

function firstText(result: { content: readonly { type: string; text?: string }[] }): string {
  const block = result.content.find((candidate) => candidate.type === "text");
  return block?.text ?? "";
}
